#!/usr/bin/env node
import { OmniPilotMcpServer } from "./mcp/mcpServer.js";
import { RiskEngine } from "./safety/riskEngine.js";
import { ApprovalGate } from "./safety/approvalGate.js";

async function runCliShowcase() {
  console.log("==================================================================");
  console.log("   🚀 OmniPilot-MCP — Executive Agent Showcase & Diagnostics");
  console.log("==================================================================\n");

  const riskEngine = new RiskEngine();
  const approvalGate = new ApprovalGate({ autoApprove: false, timeoutMs: 5000 });
  const server = new OmniPilotMcpServer({ riskEngine, approvalGate });
  const ctx = server.getContext();

  console.log("🔹 [1/4] Verifying Core MCP Engine & Dual Perception...");
  const snapshot = await ctx.visionEngine.capture("browser", "base64");
  console.log(`  ✓ Browser frame captured (${snapshot.data.length} bytes base64)`);

  const dom = await ctx.domEngine.inspect();
  console.log(`  ✓ DOM & Accessibility tree extracted (${dom.elements.length} elements found)\n`);

  console.log("🔹 [2/4] Testing 3-Tier Risk Engine Classification...");
  const actionsToTest = [
    { toolName: "omnipilot_take_screenshot", params: { target: "browser" } },
    { toolName: "omnipilot_type_text", params: { selector: "#user_notes", text: "Report bozza 2026" } },
    { toolName: "omnipilot_click_element", params: { selector: "button#delete_account" } },
    { toolName: "omnipilot_click_element", params: { selector: "button#submit_payment" } },
    { toolName: "omnipilot_type_text", params: { selector: "#cvv", text: "123", isSecret: true } },
  ];

  for (const action of actionsToTest) {
    const evalResult = riskEngine.evaluateAction(action);
    const tierBadge =
      evalResult.tier === 1
        ? "[TIER 1 - SAFE]"
        : evalResult.tier === 2
        ? "[TIER 2 - LOW RISK]"
        : "[TIER 3 - CRITICAL]";
    console.log(`  ${tierBadge} Action: ${action.toolName} -> ${evalResult.reason}`);
  }
  console.log("");

  console.log("🔹 [3/4] Testing HITL Approval Gate Event Bus...");
  approvalGate.on("approval:requested", (req) => {
    console.log(`  🛑 [HITL Event] Approval Requested: "${req.actionSummary}" (Tier: ${req.tier})`);
    setTimeout(() => {
      console.log(`  ✅ [HITL Event] Simulated Human Approval for Request ID: ${req.id}`);
      approvalGate.resolveApproval(req.id, true);
    }, 400);
  });

  const approvalPromise = approvalGate.requestApproval(
    "Invia conferma ordine su SAP Gestionale",
    3,
    { x: 450, y: 320, width: 120, height: 40 }
  );

  const approvalResult = await approvalPromise;
  console.log(`  Approval Outcome: ${approvalResult.approved ? "APPROVED" : "REJECTED"} (ID: ${approvalResult.requestId})\n`);

  console.log("🔹 [4/4] Inspecting Audit Trail...");
  approvalGate.recordAuditLog({
    toolName: "omnipilot_request_approval",
    params: { actionSummary: "Invia conferma ordine su SAP Gestionale" },
    tier: 3,
    requiresHITL: true,
    approvalStatus: "approved",
    executionDurationMs: 412,
    success: true,
  });

  const logs = approvalGate.getAuditLogs();
  console.log(`  ✓ Total Audit Entries Recorded: ${logs.length}`);
  console.log(`  ✓ Latest Audit Entry: ${JSON.stringify(logs[logs.length - 1])}\n`);

  console.log("==================================================================");
  console.log("   ✨ OmniPilot-MCP Phase 1 Scaffolding & Core MCP Verified!");
  console.log("==================================================================");
  await server.close();
}

runCliShowcase().catch((err) => {
  console.error("Showcase error:", err);
  process.exit(1);
});
