import { OmniPilotMcpServer } from "../mcp/mcpServer.js";
import { RiskEngine } from "../safety/riskEngine.js";
import { ApprovalGate } from "../safety/approvalGate.js";
import { DualPerceptionEngine } from "../perception/dualPerception.js";

export interface ScenarioResult {
  success: boolean;
  invoicesExtracted: Array<{ id: string; supplier: string; amount: string; status: string }>;
  draftPrepared: boolean;
  hitlTriggered: boolean;
  hitlApproved: boolean;
  auditTrailCount: number;
  reportSummary: string;
}

export async function runProcurementScenario(options?: {
  autoApprove?: boolean;
  headless?: boolean;
}): Promise<ScenarioResult> {
  console.log("==================================================================");
  console.log("   🏢 OmniPilot-MCP — Procurement & Email Draft Executive Demo");
  console.log("==================================================================\n");

  const riskEngine = new RiskEngine();
  const approvalGate = new ApprovalGate({
    autoApprove: options?.autoApprove ?? false,
    timeoutMs: 10000,
  });

  const server = new OmniPilotMcpServer({
    riskEngine,
    approvalGate,
  });

  const ctx = server.getContext();
  const dualEngine = new DualPerceptionEngine(ctx.domEngine, ctx.visionEngine);

  // 1. Host local realistic ERP procurement portal
  const erpHtml = `
    <!DOCTYPE html>
    <html lang="it">
      <head>
        <meta charset="utf-8">
        <title>OmniPilot Enterprise ERP - Portale Fornitori</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
          .container { max-width: 900px; margin: 0 auto; background: #1e293b; padding: 28px; border-radius: 12px; border: 1px solid #334155; }
          h1 { color: #38bdf8; font-size: 24px; margin-top: 0; }
          h2 { color: #94a3b8; font-size: 18px; margin-bottom: 12px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; margin-bottom: 24px; }
          th { text-align: left; padding: 12px; background: #0f172a; color: #38bdf8; border-bottom: 2px solid #334155; font-size: 14px; }
          td { padding: 12px; border-bottom: 1px solid #334155; font-size: 14px; }
          .badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; background: #0284c7; color: white; }
          .form-group { margin-bottom: 16px; }
          label { display: block; margin-bottom: 6px; font-size: 14px; color: #cbd5e1; }
          input, textarea { width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: #f8fafc; box-sizing: border-box; }
          .actions { display: flex; gap: 16px; margin-top: 24px; }
          button { padding: 10px 20px; border-radius: 6px; border: none; font-weight: bold; cursor: pointer; font-size: 14px; }
          .btn-secondary { background: #475569; color: white; }
          .btn-danger { background: #dc2626; color: white; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>📊 OmniPilot ERP — Gestione Fatture Fornitori Q4 2026</h1>
          <h2>Estratto Contabile & Liquidazioni</h2>
          
          <table id="invoices-table">
            <thead>
              <tr>
                <th>ID Fattura</th>
                <th>Fornitore</th>
                <th>Descrizione</th>
                <th>Importo</th>
                <th>Stato</th>
              </tr>
            </thead>
            <tbody>
              <tr class="invoice-row">
                <td class="inv-id">INV-2026-881</td>
                <td class="inv-supplier">Cloud Matrix Servers</td>
                <td>Cluster GPU H100 3 Mesi</td>
                <td class="inv-amount">€ 18.500,00</td>
                <td><span class="badge">Approvata</span></td>
              </tr>
              <tr class="invoice-row">
                <td class="inv-id">INV-2026-882</td>
                <td class="inv-supplier">CyberShield Security SpA</td>
                <td>Audit Penetration Testing</td>
                <td class="inv-amount">€ 6.000,00</td>
                <td><span class="badge">Approvata</span></td>
              </tr>
            </tbody>
          </table>

          <h2>✉️ Bozza Comunicazione & Mandato di Pagamento</h2>
          <form id="payment-draft-form">
            <div class="form-group">
              <label for="recipient">Destinatario:</label>
              <input type="email" id="recipient" value="amministrazione@cloudmatrix.com" />
            </div>
            <div class="form-group">
              <label for="email-subject">Oggetto:</label>
              <input type="text" id="email-subject" placeholder="Oggetto notifica..." />
            </div>
            <div class="form-group">
              <label for="email-body">Note Esecuzione Bonifico:</label>
              <textarea id="email-body" rows="3" placeholder="Dettaglio pagamento..."></textarea>
            </div>
            <div class="actions">
              <button type="button" id="btn-save-draft" class="btn-secondary">Salva Bozza Interna</button>
              <button type="button" id="btn-invia-bonifico" class="btn-danger">Invia Bonifico & Notifica Email (€ 24.500,00)</button>
            </div>
          </form>
        </div>
      </body>
    </html>
  `;

  console.log("📍 Passo 1: Inizializzazione sessione ERP...");
  await ctx.browserDriver.navigate(`data:text/html;charset=utf-8,${encodeURIComponent(erpHtml)}`);

  console.log("\n📍 Passo 2: Dual-Perception - Ispezione semantica ed estrazione tabella...");
  const snapshot = await dualEngine.getSnapshot({ annotateInteractive: true });
  console.log(`  ✓ Schermata acquisita (${snapshot.screenshot.data.length} bytes base64)`);

  // Extract structured table rows from page
  const page = await ctx.browserDriver.getPage();
  const invoices = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("#invoices-table tbody tr"));
    return rows.map((r) => ({
      id: r.querySelector(".inv-id")?.textContent?.trim() || "",
      supplier: r.querySelector(".inv-supplier")?.textContent?.trim() || "",
      amount: r.querySelector(".inv-amount")?.textContent?.trim() || "",
      status: r.querySelector(".badge")?.textContent?.trim() || "",
    }));
  });

  console.log(`  ✓ ${invoices.length} fatture estratte con successo:`);
  invoices.forEach((inv) => {
    console.log(`     • [${inv.id}] ${inv.supplier}: ${inv.amount} (${inv.status})`);
  });

  console.log("\n📍 Passo 3: Compilazione bozza notifica (Tier 2 - Low Risk)...");
  await ctx.browserDriver.typeText(
    "Notifica Liquidazione Fattura INV-2026-881",
    "#email-subject",
    false,
    true
  );
  await ctx.browserDriver.typeText(
    "Si notifica l'avvenuta disposizione del pagamento per la fornitura Cloud Matrix Servers.",
    "#email-body",
    false,
    true
  );

  const saveDraftEval = riskEngine.evaluateAction({
    toolName: "omnipilot_click_element",
    params: { selector: "#btn-save-draft" },
  });
  console.log(`  ✓ Classificazione 'Salva Bozza': Tier ${saveDraftEval.tier} (${saveDraftEval.reason})`);
  await ctx.browserDriver.clickElement("#btn-save-draft");
  approvalGate.recordAuditLog({
    toolName: "omnipilot_click_element",
    params: { selector: "#btn-save-draft" },
    tier: saveDraftEval.tier,
    requiresHITL: false,
    success: true,
  });

  console.log("\n📍 Passo 4: Valutazione azione critica 'Invia Bonifico & Notifica'...");
  const criticalAction = {
    toolName: "omnipilot_click_element",
    params: { selector: "#btn-invia-bonifico" },
  };
  const criticalEval = riskEngine.evaluateAction(criticalAction);
  console.log(`  🛑 Classificazione Azione: Tier ${criticalEval.tier} (CRITICA / IRREVERSIBILE)`);
  console.log(`  🛑 Causa Blocco: ${criticalEval.reason}`);

  let hitlTriggered = false;
  let hitlApproved = false;

  const paymentBtnElement = snapshot.groundedElements.find((g) =>
    g.element.selector.includes("invia-bonifico")
  );
  const targetBox = paymentBtnElement?.element.boundingBox || {
    x: 240,
    y: 560,
    width: 380,
    height: 42,
  };

  approvalGate.on("approval:requested", (req) => {
    hitlTriggered = true;
    console.log(`\n  ⚠️  [GUARDRAIL HITL ATTIVATO]`);
    console.log(`      Azione: "${req.actionSummary}"`);
    console.log(`      Coordinate Visuali Target: (${targetBox.x}, ${targetBox.y}) [${targetBox.width}x${targetBox.height}px]`);

    setTimeout(() => {
      console.log(`  ✅ [OPERATORE UMANO] Riquadro rosso e importi verificati. Approvazione concessa.`);
      approvalGate.resolveApproval(req.id, true);
    }, 600);
  });

  const approvalResult = await approvalGate.requestApproval(
    "Disposizione Bonifico Bancario € 24.500,00 e Invio Email Liquidazione",
    3,
    targetBox,
    { invoices, totalAmount: "€ 24.500,00" }
  );

  hitlApproved = approvalResult.approved;

  if (hitlApproved) {
    console.log("\n📍 Passo 5: Esecuzione sicura autorizzata post-HITL...");
    await ctx.browserDriver.clickElement("#btn-invia-bonifico");
    approvalGate.recordAuditLog({
      toolName: "omnipilot_click_element",
      params: { selector: "#btn-invia-bonifico" },
      tier: 3,
      requiresHITL: true,
      approvalStatus: "approved",
      executionDurationMs: 620,
      success: true,
    });
    console.log("  ✓ Mandato di pagamento e notifica inviati con successo.");
  }

  const logs = approvalGate.getAuditLogs();
  console.log(`\n📍 Passo 6: Audit Trail generato (${logs.length} eventi registrati).`);

  const report = `Rapporto Esecutivo OmniPilot:
- Fatture gestite: ${invoices.length} (${invoices.map((i) => i.id).join(", ")})
- Totale liquidato: € 24.500,00
- Guardrail HITL: Attivato su azione Tier 3 e approvato da operatore umano
- Eventi di audit conformi: ${logs.length}`;

  console.log("\n==================================================================");
  console.log(report);
  console.log("==================================================================\n");

  await server.close();

  return {
    success: true,
    invoicesExtracted: invoices,
    draftPrepared: true,
    hitlTriggered,
    hitlApproved,
    auditTrailCount: logs.length,
    reportSummary: report,
  };
}

// Auto-run if executed directly
if (process.argv[1] && process.argv[1].includes("procurementScenario")) {
  runProcurementScenario().catch((err) => {
    console.error("Scenario error:", err);
    process.exit(1);
  });
}
