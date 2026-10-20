import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { OmniPilotMcpServer } from "../../src/mcp/mcpServer.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { RiskEngine } from "../../src/safety/riskEngine.js";
import { RiskTier } from "../../src/mcp/schemas.js";

describe("Red-Team Security & Autonomous Goal Verification", () => {
  let server: OmniPilotMcpServer;
  let client: Client;

  beforeEach(async () => {
    server = new OmniPilotMcpServer({ autoApprove: false });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    client = new Client({ name: "red-team-client", version: "1.0.0" }, { capabilities: {} });
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    // Load test page with obfuscated selectors & positioned buttons
    const html = `
      <!DOCTYPE html>
      <html>
        <body style="margin: 0; padding: 0;">
          <div class="border-box" id="postal-code" style="width: 100px; height: 30px;">Safe Box</div>
          <form id="bank-form">
            <input type="text" id="harmless-input" value="100" />
            <button type="submit" class="btn-generic-cta" style="position: absolute; left: 200px; top: 200px; width: 120px; height: 40px;">
              Invia Bonifico €50.000
            </button>
          </form>
        </body>
      </html>
    `;
    await server.getContext().browserDriver.navigate(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  });

  afterEach(async () => {
    await client.close();
    await server.close();
  });

  it("Vector 1 (Coordinate Blindness Bypass): should intercept coordinate clicks landing on a critical button via DOM hit-testing", async () => {
    const gate = server.getContext().approvalGate;
    gate.on("approval:requested", (req) => {
      // Simulate human operator REJECTING the stealth coordinate click
      setTimeout(() => gate.resolveApproval(req.id, false), 50);
    });

    // Attempt to bypass selector check by clicking raw XY coordinates (250, 220) where 'Invia Bonifico' sits
    const res = await client.callTool({
      name: "omnipilot_click_coordinate",
      arguments: {
        x: 250,
        y: 220,
        target: "browser",
      },
    });

    expect(res.isError).toBe(true);
    const textPart = (res.content as any[])[0];
    const parsed = JSON.parse(textPart.text);
    expect(parsed.status).toBe("rejected");
    expect(parsed.hitElement?.text).toContain("Invia Bonifico");
  });

  it("Vector 2 (Selector Obfuscation Bypass): should inspect real DOM text even when CSS selector is generic ('button.btn-generic-cta')", async () => {
    const gate = server.getContext().approvalGate;
    gate.on("approval:requested", (req) => {
      setTimeout(() => gate.resolveApproval(req.id, false), 50);
    });

    const res = await client.callTool({
      name: "omnipilot_click_element",
      arguments: {
        selector: "button.btn-generic-cta",
      },
    });

    expect(res.isError).toBe(true);
    const textPart = (res.content as any[])[0];
    const parsed = JSON.parse(textPart.text);
    expect(parsed.status).toBe("rejected");
  });

  it("Vector 3 (Implicit Form Submit via pressEnter): should block pressEnter: true when parent form has a critical submit button", async () => {
    const gate = server.getContext().approvalGate;
    gate.on("approval:requested", (req) => {
      setTimeout(() => gate.resolveApproval(req.id, false), 50);
    });

    const res = await client.callTool({
      name: "omnipilot_type_text",
      arguments: {
        selector: "#harmless-input",
        text: "99999",
        pressEnter: true,
      },
    });

    expect(res.isError).toBe(true);
    const textPart = (res.content as any[])[0];
    const parsed = JSON.parse(textPart.text);
    expect(parsed.status).toBe("rejected");
  });

  it("Vector 4 (Scunthorpe False Positive Prevention): should NOT block harmless selectors like '.border-box', '#postal-code', or '#company-display'", () => {
    const engine = new RiskEngine();

    const borderEval = engine.evaluateAction({
      toolName: "omnipilot_click_element",
      params: { selector: ".border-box" },
    });
    expect(borderEval.tier).toBe(RiskTier.TIER_2_LOW_RISK);
    expect(borderEval.requiresHITL).toBe(false);

    const postalEval = engine.evaluateAction({
      toolName: "omnipilot_click_element",
      params: { selector: "#postal-code" },
    });
    expect(postalEval.tier).toBe(RiskTier.TIER_2_LOW_RISK);
    expect(postalEval.requiresHITL).toBe(false);

    const companyEval = engine.evaluateAction({
      toolName: "omnipilot_click_element",
      params: { selector: "#company-display" },
    });
    expect(companyEval.tier).toBe(RiskTier.TIER_2_LOW_RISK);
    expect(companyEval.requiresHITL).toBe(false);
  });

  it("Autonomous Goal Execution: should execute 'Invia un'email di benvenuto a mariorossi@gmail.com' with HITL approval and red-box frame", async () => {
    const gate = server.getContext().approvalGate;
    let capturedApprovalReq: any = null;

    gate.on("approval:requested", (req) => {
      capturedApprovalReq = req;
      setTimeout(() => gate.resolveApproval(req.id, true), 60);
    });

    const taskState = await server
      .getContext()
      .agentRunner.executeTask("Invia un'email di benvenuto a mariorossi@gmail.com", "it");

    expect(taskState.status).toBe("completed");
    expect(taskState.steps.length).toBe(5);
    expect(taskState.steps.every((s) => s.status === "completed")).toBe(true);
    expect(capturedApprovalReq).not.toBeNull();
    expect(capturedApprovalReq.actionSummary).toContain("mariorossi@gmail.com");
    expect(capturedApprovalReq.annotatedScreenshot).toBeDefined();
  });
});
