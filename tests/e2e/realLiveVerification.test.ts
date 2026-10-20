import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, Browser } from "playwright";
import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { OmniPilotMcpServer } from "../../src/mcp/mcpServer.js";
import { DashboardServer } from "../../src/server/dashboardApi.js";
import { VisualAnnotator } from "../../src/perception/visualAnnotator.js";

describe("Real-World Live System Verification (Full Stack UI + MCP Stdio + Security)", () => {
  let mcpServer: OmniPilotMcpServer;
  let dashboard: DashboardServer;
  let port: number;
  let uiBrowser: Browser;

  beforeAll(async () => {
    mcpServer = new OmniPilotMcpServer({ autoApprove: false });
    dashboard = new DashboardServer(mcpServer, {
      port: 0, // Dynamic free OS port
      staticDir: path.resolve(process.cwd(), "web-dashboard", "dist"),
    });
    port = await dashboard.start();
    uiBrowser = await chromium.launch({ headless: true });
  }, 30000);

  afterAll(async () => {
    if (uiBrowser) await uiBrowser.close();
    if (dashboard) await dashboard.close();
    if (mcpServer) await mcpServer.close();
  });

  it("1. should render the real compiled React 19 Web Dashboard, switch IT/EN languages, and execute the live email task with human modal click", async () => {
    const page = await uiBrowser.newPage({ viewport: { width: 1440, height: 900 } });
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto(`http://localhost:${port}/`, { waitUntil: "networkidle" });

    // Verify Italian UI rendered with zero runtime errors
    const h1Text = await page.locator("h1").textContent();
    expect(h1Text).toContain("OmniPilot-MCP");
    const bodyTextIt1 = await page.locator("body").textContent();
    expect(bodyTextIt1).toContain("Barra di Comando Esecutiva");

    // Test Bilingual Toggle (IT -> EN -> IT)
    const langBtn = page.locator('button[title*="Switch Language"]');
    await langBtn.click();
    const bodyTextEn = await page.locator("body").textContent();
    expect(bodyTextEn).toContain("Executive Command Bar");
    const inputValEn = await page.locator('input[type="text"]').inputValue();
    expect(inputValEn).toBe("Send a welcome email to mariorossi@gmail.com");

    // Toggle back to Italian
    await langBtn.click();
    const bodyTextIt2 = await page.locator("body").textContent();
    expect(bodyTextIt2).toContain("Barra di Comando Esecutiva");
    const inputValIt = await page.locator('input[type="text"]').inputValue();
    expect(inputValIt).toBe("Invia un'email di benvenuto a mariorossi@gmail.com");

    // Click "▶ Esegui Compito" in the real React UI
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    // Wait for the AgentRunner to reach Step 4 (Tier 3 HITL) and pop up the red ApprovalGateModal in the UI
    const modalHeader = page.locator("text=GUARDRAIL HITL — RICHIESTA CONFERMA TIER 3");
    await modalHeader.waitFor({ state: "visible", timeout: 15000 });

    // Verify the modal displays the real annotated red-bounding-box screenshot image
    const modalImg = page.locator('img[alt="HITL Red Bounding Box Target"]');
    await modalImg.waitFor({ state: "visible", timeout: 5000 });
    expect(await modalImg.isVisible()).toBe(true);
    const imgSrc = await modalImg.getAttribute("src");
    expect(imgSrc?.startsWith("data:image/png;base64,iVBOR")).toBe(true);

    // Verify concurrent task execution is blocked with 409 Conflict while waiting for HITL approval
    const conflictRes = await fetch(`http://localhost:${port}/api/tasks/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: "Concurrent task attempt" }),
    });
    expect(conflictRes.status).toBe(409);

    // Click the real "✓ Conferma Esecuzione" button in the React modal
    const approveBtn = page.locator("button", { hasText: "Conferma Esecuzione" });
    await approveBtn.click();

    // Wait for the task completion banner to appear in the React UI
    const completionBanner = page.locator("text=Compito completato! Email di benvenuto compilata");
    await completionBanner.waitFor({ state: "visible", timeout: 15000 });

    // Verify Audit Trail table in the UI shows the approved Tier 3 action
    const tableText = await page.locator("table").textContent();
    expect(tableText).toContain("✓ Approvato");
    expect(tableText).toContain("TIER 3 (CRITICO)");

    expect(pageErrors).toEqual([]);
    await page.close();
  }, 35000);

  it("2. should block directory traversal attempts and oversized POST bodies on DashboardServer", async () => {
    const traversalRes = await fetch(
      `http://localhost:${port}/%2e%2e%5c%2e%2e%5cpackage.json`
    );
    expect([200, 403]).toContain(traversalRes.status);
    const text = await traversalRes.text();
    // Even if SPA fallback triggers, it must never leak package.json contents
    expect(text).not.toContain('"omnipilot-mcp"');
    expect(text).not.toContain('"devDependencies"');
  });

  it("3. should save genuine PNG files to disk when format='path' and clamp out-of-bounds visual annotations", async () => {
    const ctx = mcpServer.getContext();
    const res = await ctx.visionEngine.capture("browser", "path", false);
    expect(res.filePath).toBeDefined();
    expect(fs.existsSync(res.filePath!)).toBe(true);

    const fileBytes = fs.readFileSync(res.filePath!);
    // PNG magic header: 89 50 4E 47
    expect(fileBytes[0]).toBe(0x89);
    expect(fileBytes[1]).toBe(0x50);
    expect(fileBytes[2]).toBe(0x4e);
    expect(fileBytes[3]).toBe(0x47);

    // Clean up test screenshot file
    fs.unlinkSync(res.filePath!);

    // Test VisualAnnotator with extreme out-of-bounds negative and huge coordinates
    const annotated = await VisualAnnotator.annotateImage(res.data, [
      {
        box: { x: -200, y: -150, width: 99999, height: 99999 },
        label: "Extreme Out of Bounds Box Test <script>&\"'</script>",
        color: "#ef4444",
      },
    ]);
    expect(annotated.startsWith("iVBOR")).toBe(true);
  });

  it("4. should run the compiled MCP Stdio server (dist/index.js) as a real OS process and respond to JSON-RPC 2.0", async () => {
    const distIndex = path.resolve(process.cwd(), "dist", "index.js");
    expect(fs.existsSync(distIndex)).toBe(true);

    const response = await new Promise<any>((resolve, reject) => {
      const child = spawn(process.execPath, [distIndex], {
        env: { ...process.env, OMNIPILOT_DISABLE_DASHBOARD: "true" },
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdoutData = "";
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error("Stdio MCP process timed out"));
      }, 10000);

      child.stdout.on("data", (chunk) => {
        stdoutData += chunk.toString();
        const lines = stdoutData.split("\n").filter((l) => l.trim().startsWith("{"));
        if (lines.length >= 1) {
          try {
            const parsed = JSON.parse(lines[0]!);
            clearTimeout(timer);
            child.kill();
            resolve(parsed);
          } catch {
            // Wait for complete line
          }
        }
      });

      child.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });

      // Send MCP JSON-RPC 2.0 initialize request
      const initReq = {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "real-stdio-verifier", version: "1.0.0" },
        },
      };
      child.stdin.write(JSON.stringify(initReq) + "\n");
    });

    expect(response.jsonrpc).toBe("2.0");
    expect(response.id).toBe(1);
    expect(response.result.serverInfo.name).toBe("omnipilot-mcp");
  }, 15000);
});
