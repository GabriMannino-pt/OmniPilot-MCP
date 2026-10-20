import { OmniPilotMcpServer } from "../src/mcp/mcpServer.js";
import { DualPerceptionEngine } from "../src/perception/dualPerception.js";
import { VisualAnnotator } from "../src/perception/visualAnnotator.js";
import fs from "fs";
import path from "path";

async function main() {
  const server = new OmniPilotMcpServer();
  const ctx = server.getContext();
  const dual = new DualPerceptionEngine(ctx.domEngine, ctx.visionEngine);
  
  const html = `
    <!DOCTYPE html>
    <html lang="it">
      <head>
        <meta charset="utf-8">
        <title>OmniPilot Cockpit - Enterprise ERP</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b1120; color: #f8fafc; margin: 0; padding: 40px; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1e293b; padding-bottom: 20px; margin-bottom: 30px; }
          .logo { font-size: 22px; font-weight: 800; color: #38bdf8; display: flex; align-items: center; gap: 10px; }
          .badge-tier { background: #ef4444; color: white; padding: 6px 14px; border-radius: 9999px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
          .card { background: #131d31; border: 1px solid #24324f; border-radius: 12px; padding: 28px; margin-bottom: 24px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th { text-align: left; padding: 12px 16px; background: #0b1120; color: #38bdf8; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #24324f; }
          td { padding: 14px 16px; border-bottom: 1px solid #1e293b; font-size: 14px; }
          .status-ok { background: #065f46; color: #6ee7b7; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; }
          .actions { display: flex; gap: 16px; margin-top: 28px; justify-content: flex-end; }
          button { padding: 12px 24px; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 14px; border: none; }
          .btn-draft { background: #334155; color: #e2e8f0; }
          .btn-critical { background: #dc2626; color: white; box-shadow: 0 4px 14px rgba(220,38,38,0.4); }
          .alert-box { background: rgba(239, 68, 68, 0.12); border: 1px solid #ef4444; border-radius: 8px; padding: 16px 20px; margin-top: 24px; display: flex; align-items: center; gap: 12px; color: #fca5a5; font-size: 14px; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">⚡ OmniPilot-MCP — Autonomous Executive Cockpit v0.2.0</div>
          <div class="badge-tier">Pre-Execution Visual Firewall Active</div>
        </div>
        <div class="card">
          <h2 style="margin:0 0 8px 0; color:#f1f5f9; font-size:20px;">📊 Liquidazione Fatture Fornitori Q4 2026</h2>
          <p style="margin:0; color:#94a3b8; font-size:14px;">Riconciliazione contabile autonoma con verifica di sicurezza Human-in-the-Loop.</p>
          <table>
            <thead>
              <tr><th>ID Fattura</th><th>Fornitore</th><th>Importo</th><th>Stato Validazione</th></tr>
            </thead>
            <tbody>
              <tr><td>INV-2026-881</td><td>Cloud Matrix Servers Ltd</td><td>€ 18.500,00</td><td><span class="status-ok">Verificato algebricamente</span></td></tr>
              <tr><td>INV-2026-882</td><td>CyberShield Security SpA</td><td>€ 6.000,00</td><td><span class="status-ok">Verificato algebricamente</span></td></tr>
            </tbody>
          </table>
          <div class="alert-box">
            <span style="font-size:20px;">🛑</span>
            <span><strong>GUARDRAIL TIER 3 BLOCCANTE:</strong> Il click su "Invia Bonifico Definitivo" richiede autorizzazione esplicita. Target intercettato e congelato prima dell'esecuzione.</span>
          </div>
          <div class="actions">
            <button class="btn-draft" id="btn-draft">Salva Bozza (Tier 2 - Safe)</button>
            <button class="btn-critical" id="btn-bonifico">⚠️ Invia Bonifico € 24.500 (Tier 3 - HITL)</button>
          </div>
        </div>
      </body>
    </html>
  `;
  
  await ctx.browserDriver.navigate("data:text/html;charset=utf-8," + encodeURIComponent(html));
  const snap = await dual.getSnapshot({ annotateInteractive: true });
  
  const target = snap.groundedElements.find(e => e.element.selector.includes("btn-bonifico"));
  const box = target ? target.element.boundingBox : { x: 500, y: 380, width: 320, height: 44 };
  
  const annotated = await VisualAnnotator.annotateImage(snap.screenshot.data, [
    { box, label: "🛑 TIER 3 HITL GUARDRAIL: BLOCKED PRE-CLICK", color: "#ef4444" }
  ]);
  
  const outDir = path.resolve("d:/omnipilot-mcp/screenshots");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "omnipilot-firewall-showcase.png");
  fs.writeFileSync(outPath, Buffer.from(annotated, "base64"));
  console.log("SUCCESS_GENERATED:" + outPath);
  await ctx.browserDriver.close();
}

main().catch(console.error);
