import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import { OmniPilotMcpServer } from "../mcp/mcpServer.js";
import { DualPerceptionEngine } from "../perception/dualPerception.js";

export interface DashboardServerOptions {
  port?: number;
  staticDir?: string;
}

export class DashboardServer {
  private server: http.Server | null = null;
  private port: number;
  private staticDir: string;
  private dualEngine: DualPerceptionEngine;

  constructor(
    private mcpServer: OmniPilotMcpServer,
    options?: DashboardServerOptions
  ) {
    this.port = options?.port ?? 3000;
    this.staticDir =
      options?.staticDir ??
      path.resolve(process.cwd(), "web-dashboard", "dist");

    const ctx = this.mcpServer.getContext();
    this.dualEngine = ctx.dualPerception;
  }

  public async start(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        // Set CORS headers for local dev / Vite dev server
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");

        if (req.method === "OPTIONS") {
          res.writeHead(204);
          res.end();
          return;
        }

        const url = new URL(req.url || "/", `http://localhost:${this.port}`);
        const pathname = url.pathname;
        const ctx = this.mcpServer.getContext();

        try {
          // --- API Endpoints ---
          if (pathname === "/api/status" && req.method === "GET") {
            const status = {
              status: "operational",
              timestamp: new Date().toISOString(),
              version: "0.1.0",
              browser: ctx.browserDriver.getStatus(),
              desktop: ctx.desktopDriver.getDisplayResolution(),
              pendingApprovalsCount: ctx.approvalGate.getPendingRequests().length,
              totalAuditLogs: ctx.approvalGate.getAuditLogs().length,
              currentTask: ctx.agentRunner.getCurrentTask(),
            };
            this.sendJson(res, 200, status);
            return;
          }

          if (pathname === "/api/tasks/current" && req.method === "GET") {
            this.sendJson(res, 200, {
              task: ctx.agentRunner.getCurrentTask(),
            });
            return;
          }

          if (pathname === "/api/tasks/execute" && req.method === "POST") {
            const body = await this.readJsonBody(req);
            const goal = String(body?.goal || "").trim();
            const language = body?.language === "en" ? "en" : "it";

            if (!goal) {
              this.sendJson(res, 400, { error: "Missing 'goal' instruction" });
              return;
            }

            // Launch task asynchronously so UI can observe live steps & approve HITL
            ctx.agentRunner.executeTask(goal, language).catch((err) => {
              console.error("[OmniPilot AgentRunner] Task error:", err);
            });

            // Wait briefly so initial task state is populated
            await new Promise((r) => setTimeout(r, 50));

            this.sendJson(res, 200, {
              started: true,
              task: ctx.agentRunner.getCurrentTask(),
            });
            return;
          }

          if (pathname === "/api/screenshot" && req.method === "GET") {
            const annotate = url.searchParams.get("annotate") === "true";
            const target = (url.searchParams.get("target") as "browser" | "desktop") || "browser";

            const snapshot = await this.dualEngine.getSnapshot({
              target,
              annotateInteractive: annotate,
            });

            this.sendJson(res, 200, {
              status: "success",
              snapshot,
            });
            return;
          }

          if (pathname === "/api/approvals" && req.method === "GET") {
            const pending = ctx.approvalGate.getPendingRequests();
            this.sendJson(res, 200, { approvals: pending });
            return;
          }

          if (
            pathname.startsWith("/api/approvals/") &&
            pathname.endsWith("/resolve") &&
            req.method === "POST"
          ) {
            const parts = pathname.split("/");
            const requestId = parts[3];
            const body = await this.readJsonBody(req);
            const approved = Boolean(body?.approved);

            if (!requestId) {
              this.sendJson(res, 400, { error: "Missing requestId" });
              return;
            }

            const resolved = ctx.approvalGate.resolveApproval(requestId, approved);
            this.sendJson(res, 200, {
              success: resolved,
              requestId,
              approved,
            });
            return;
          }

          if (pathname === "/api/audit-logs" && req.method === "GET") {
            const tierParam = url.searchParams.get("tier");
            const filterTier = tierParam ? parseInt(tierParam, 10) : undefined;
            const logs = ctx.approvalGate.getAuditLogs({ tier: filterTier });
            this.sendJson(res, 200, { auditLogs: logs });
            return;
          }

          // --- Static Files / SPA Fallback ---
          this.serveStatic(req, res, pathname);
        } catch (err: any) {
          console.error("Dashboard server error:", err);
          this.sendJson(res, 500, { error: err.message });
        }
      });

      this.server.listen(this.port, () => {
        console.error(`[OmniPilot Dashboard] Server listening on http://localhost:${this.port}`);
        resolve(this.port);
      });

      this.server.on("error", (err) => {
        reject(err);
      });
    });
  }

  public async close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  private sendJson(res: http.ServerResponse, statusCode: number, data: any): void {
    const payload = JSON.stringify(data);
    res.writeHead(statusCode, {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload),
    });
    res.end(payload);
  }

  private async readJsonBody(req: http.IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (err) {
          reject(err);
        }
      });
      req.on("error", reject);
    });
  }

  private serveStatic(_req: http.IncomingMessage, res: http.ServerResponse, pathname: string): void {
    if (!fs.existsSync(this.staticDir)) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>OmniPilot-MCP Dashboard</title>
            <style>
              body { font-family: Segoe UI, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; }
              h1 { color: #38bdf8; }
              .card { background: #1e293b; padding: 24px; border-radius: 8px; border: 1px solid #334155; max-width: 600px; }
              a { color: #38bdf8; }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>🚀 OmniPilot-MCP Control API Operational</h1>
              <p>API endpoints active:</p>
              <ul>
                <li><a href="/api/status">/api/status</a></li>
                <li><a href="/api/tasks/current">/api/tasks/current</a></li>
                <li><a href="/api/screenshot?annotate=true">/api/screenshot?annotate=true</a></li>
                <li><a href="/api/approvals">/api/approvals</a></li>
                <li><a href="/api/audit-logs">/api/audit-logs</a></li>
              </ul>
            </div>
          </body>
        </html>
      `);
      return;
    }

    let filePath = path.join(this.staticDir, pathname === "/" ? "index.html" : pathname);
    if (!fs.existsSync(filePath)) {
      filePath = path.join(this.staticDir, "index.html");
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".html": "text/html",
      ".js": "application/javascript",
      ".css": "text/css",
      ".json": "application/json",
      ".png": "image/png",
      ".svg": "image/svg+xml",
      ".ico": "image/x-icon",
    };

    const contentType = mimeTypes[ext] || "application/octet-stream";
    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(500);
        res.end("Internal Server Error");
      } else {
        res.writeHead(200, { "Content-Type": contentType });
        res.end(content);
      }
    });
  }
}
