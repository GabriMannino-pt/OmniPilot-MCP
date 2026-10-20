import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { OmniPilotMcpServer } from "../../src/mcp/mcpServer.js";
import { DashboardServer } from "../../src/server/dashboardApi.js";

describe("DashboardServer (REST / Web Control API)", () => {
  let mcpServer: OmniPilotMcpServer;
  let dashboard: DashboardServer;
  const testPort = 3188;

  beforeAll(async () => {
    mcpServer = new OmniPilotMcpServer({ autoApprove: false });
    dashboard = new DashboardServer(mcpServer, { port: testPort });
    await dashboard.start();
  });

  afterAll(async () => {
    await dashboard.close();
    await mcpServer.close();
  });

  it("should respond to GET /api/status with system metadata", async () => {
    const res = await fetch(`http://localhost:${testPort}/api/status`);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.status).toBe("operational");
    expect(json.browser).toBeDefined();
    expect(json.version).toBe("0.1.0");
  });

  it("should respond to GET /api/screenshot with DualPerception snapshot", async () => {
    const res = await fetch(`http://localhost:${testPort}/api/screenshot?annotate=true`);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.status).toBe("success");
    expect(json.snapshot).toBeDefined();
    expect(json.snapshot.screenshot.data).toBeDefined();
  });

  it("should return and resolve pending approvals", async () => {
    // 1. Trigger a background approval request
    const approvalPromise = mcpServer.getContext().approvalGate.requestApproval("Test Dashboard Action", 3);

    // 2. Query pending approvals
    const listRes = await fetch(`http://localhost:${testPort}/api/approvals`);
    const listJson = await listRes.json();
    expect(listJson.approvals.length).toBeGreaterThan(0);
    const pendingReq = listJson.approvals[0];

    // 3. Resolve it via POST
    const resolveRes = await fetch(`http://localhost:${testPort}/api/approvals/${pendingReq.id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved: true }),
    });
    const resolveJson = await resolveRes.json();
    expect(resolveJson.success).toBe(true);

    const result = await approvalPromise;
    expect(result.approved).toBe(true);
  });

  it("should respond to GET /api/audit-logs", async () => {
    const res = await fetch(`http://localhost:${testPort}/api/audit-logs`);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(Array.isArray(json.auditLogs)).toBe(true);
  });
});
