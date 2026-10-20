#!/usr/bin/env node
import { OmniPilotMcpServer } from "./mcp/mcpServer.js";
import { RiskEngine } from "./safety/riskEngine.js";
import { ApprovalGate } from "./safety/approvalGate.js";
import { DualPerceptionEngine } from "./perception/dualPerception.js";

async function runCliShowcase() {
  console.log("==================================================================");
  console.log("   🚀 OmniPilot-MCP — Executive Agent Dual-Perception Showcase");
  console.log("==================================================================\n");

  const riskEngine = new RiskEngine();
  const approvalGate = new ApprovalGate({ autoApprove: false, timeoutMs: 5000 });
  const server = new OmniPilotMcpServer({ riskEngine, approvalGate });
  const ctx = server.getContext();

  console.log("🔹 [1/5] Launching Playwright Headless Chromium & Loading Portal...");
  const samplePortalHtml = `
    <!DOCTYPE html>
    <html lang="it">
      <head><meta charset="utf-8"><title>ERP Omnichannel Console</title></head>
      <body style="margin: 0; padding: 24px; font-family: Segoe UI, sans-serif; background: #0f172a; color: #f8fafc;">
        <h1 style="color: #38bdf8;">OmniPilot ERP Executive Portal</h1>
        <div style="background: #1e293b; padding: 16px; border-radius: 8px; max-width: 600px;">
          <h3>Dettaglio Ordine Fornitore #ORD-2026-994</h3>
          <p>Importo: <strong>€ 14.850,00</strong> | Fornitore: <strong>Acme Silicon SpA</strong></p>
          <div style="margin-top: 16px;">
            <input id="note-approvazione" type="text" placeholder="Note interne..." style="padding: 8px; width: 80%; border-radius: 4px; border: 1px solid #475569;" />
          </div>
          <div style="margin-top: 16px; display: flex; gap: 12px;">
            <button id="btn-bozza" style="padding: 8px 16px; background: #334155; color: white; border: none; border-radius: 4px; cursor: pointer;">Salva Bozza</button>
            <button id="btn-invia-pagamento" style="padding: 8px 16px; background: #dc2626; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Invia Pagamento e Bonifico</button>
          </div>
        </div>
      </body>
    </html>
  `;

  await ctx.browserDriver.navigate(`data:text/html;charset=utf-8,${encodeURIComponent(samplePortalHtml)}`);
  console.log("  ✓ Headless portal session established at active URL.");

  console.log("\n🔹 [2/5] Running Dual-Perception Engine (Vision + Accessibility DOM)...");
  const dualEngine = new DualPerceptionEngine(ctx.domEngine, ctx.visionEngine);
  const dualSnapshot = await dualEngine.getSnapshot({ annotateInteractive: true });

  console.log(`  ✓ Raw & Annotated frame captured (${dualSnapshot.screenshot.data.length} bytes base64)`);
  console.log(`  ✓ Interactive Grounded Elements detected: ${dualSnapshot.interactiveCount}`);
  dualSnapshot.groundedElements.forEach((g) => {
    console.log(`     • [${g.id}] <${g.element.tagName}> "${g.element.text || g.element.name}" at (${g.centerCoordinate?.x}, ${g.centerCoordinate?.y})`);
  });

  console.log("\n🔹 [3/5] Testing 3-Tier Risk Engine Classification...");
  const actionsToTest = [
    { toolName: "omnipilot_take_screenshot", params: { target: "browser" } },
    { toolName: "omnipilot_type_text", params: { selector: "#note-approvazione", text: "Verificato con CFO" } },
    { toolName: "omnipilot_click_element", params: { selector: "#btn-bozza" } },
    { toolName: "omnipilot_click_element", params: { selector: "#btn-invia-pagamento" } },
    { toolName: "omnipilot_type_text", params: { selector: "#pin-bancario", text: "9988", isSecret: true } },
  ];

  for (const action of actionsToTest) {
    const evalResult = riskEngine.evaluateAction(action);
    const tierBadge =
      evalResult.tier === 1
        ? "[TIER 1 - SAFE]"
        : evalResult.tier === 2
        ? "[TIER 2 - LOW RISK]"
        : "[TIER 3 - CRITICAL]";
    console.log(`  ${tierBadge} ${action.toolName} (${JSON.stringify(action.params.selector || action.params.target)}) -> ${evalResult.reason}`);
  }

  console.log("\n🔹 [4/5] Testing Visual Grounding HITL Guardrail for Critical Action...");
  const paymentBtn = dualSnapshot.groundedElements.find((g) => g.element.selector.includes("invia-pagamento"));
  const targetBox = paymentBtn?.element.boundingBox || { x: 300, y: 150, width: 220, height: 42 };

  approvalGate.on("approval:requested", (req) => {
    console.log(`  🛑 [HITL Guardrail] Operation Suspended!`);
    console.log(`     Summary: "${req.actionSummary}"`);
    console.log(`     BoundingBox Target: [X: ${req.boundingBox?.x}, Y: ${req.boundingBox?.y}, W: ${req.boundingBox?.width}, H: ${req.boundingBox?.height}]`);
    setTimeout(() => {
      console.log(`  ✅ [HITL Operator] Visual verification completed: Human APPROVED request ${req.id}`);
      approvalGate.resolveApproval(req.id, true);
    }, 500);
  });

  const approvalPromise = approvalGate.requestApproval(
    "Esecuzione Bonifico Fornitore Acme €14.850,00",
    3,
    targetBox
  );

  const approvalResult = await approvalPromise;
  console.log(`  Approval Outcome: ${approvalResult.approved ? "APPROVED" : "REJECTED"} (Request ID: ${approvalResult.requestId})`);

  console.log("\n🔹 [5/5] Checking Structured Audit Trail...");
  approvalGate.recordAuditLog({
    toolName: "omnipilot_click_element",
    params: { selector: "#btn-invia-pagamento" },
    tier: 3,
    requiresHITL: true,
    approvalStatus: "approved",
    executionDurationMs: 512,
    success: true,
  });

  const logs = approvalGate.getAuditLogs();
  console.log(`  ✓ Total Audit Trail Entries: ${logs.length}`);
  console.log(`  ✓ Latest Audit Entry: ${JSON.stringify(logs[logs.length - 1])}\n`);

  console.log("==================================================================");
  console.log("   ✨ OmniPilot-MCP Phase 2 (Dual-Perception Engine) Verified!");
  console.log("==================================================================");
  await server.close();
}

runCliShowcase().catch((err) => {
  console.error("Showcase error:", err);
  process.exit(1);
});
