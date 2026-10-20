#!/usr/bin/env node
import { OmniPilotMcpServer } from "../mcp/mcpServer.js";
import { DashboardServer } from "./dashboardApi.js";

async function main() {
  const mcpServer = new OmniPilotMcpServer();
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const dashboard = new DashboardServer(mcpServer, { port });

  // Navigate to default welcome portal
  const samplePortalHtml = `
    <!DOCTYPE html>
    <html lang="it">
      <head><meta charset="utf-8"><title>OmniPilot Executive Cockpit</title></head>
      <body style="margin: 0; padding: 32px; font-family: Segoe UI, sans-serif; background: #0f172a; color: #f8fafc;">
        <h1 style="color: #38bdf8;">OmniPilot-MCP Live Canvas Active</h1>
        <p style="color: #94a3b8;">Dual-Perception Engine in ascolto su porta ${port}.</p>
        <div style="background: #1e293b; padding: 20px; border-radius: 8px; margin-top: 20px; max-width: 500px;">
          <h3>Pannello Controlli</h3>
          <p>Compila e salva la richiesta:</p>
          <input id="test-input" placeholder="Note operative..." style="padding: 8px; width: 90%; border-radius: 4px; border: 1px solid #475569;" />
          <div style="margin-top: 14px; display: flex; gap: 10px;">
            <button id="btn-save" style="padding: 8px 16px; background: #0284c7; color: white; border: none; border-radius: 4px; cursor: pointer;">Salva Bozza (Tier 2)</button>
            <button id="btn-delete" style="padding: 8px 16px; background: #dc2626; color: white; border: none; border-radius: 4px; cursor: pointer;">Cancella Dati (Tier 3)</button>
          </div>
        </div>
      </body>
    </html>
  `;
  await mcpServer.getContext().browserDriver.navigate(`data:text/html;charset=utf-8,${encodeURIComponent(samplePortalHtml)}`);

  await dashboard.start();
  console.log(`\n==================================================================`);
  console.log(`   🚀 OmniPilot-MCP Web Control Dashboard Online!`);
  console.log(`   URL: http://localhost:${port}`);
  console.log(`==================================================================\n`);

  process.on("SIGINT", async () => {
    await dashboard.close();
    await mcpServer.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Dashboard startup failed:", err);
  process.exit(1);
});
