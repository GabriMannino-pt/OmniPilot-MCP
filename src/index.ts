#!/usr/bin/env node
import { OmniPilotMcpServer } from "./mcp/mcpServer.js";
import { DashboardServer } from "./server/dashboardApi.js";

export * from "./mcp/mcpServer.js";
export * from "./mcp/schemas.js";
export * from "./mcp/handlers/toolsHandler.js";
export * from "./mcp/handlers/resourcesHandler.js";
export * from "./mcp/handlers/promptsHandler.js";
export * from "./safety/riskEngine.js";
export * from "./safety/approvalGate.js";
export * from "./perception/domEngine.js";
export * from "./perception/visionEngine.js";
export * from "./perception/visualAnnotator.js";
export * from "./perception/dualPerception.js";
export * from "./execution/browserDriver.js";
export * from "./execution/desktopDriver.js";
export * from "./agent/agentRunner.js";
export * from "./server/dashboardApi.js";

async function main() {
  const server = new OmniPilotMcpServer();
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const dashboard = new DashboardServer(server, { port });

  process.on("SIGINT", async () => {
    await dashboard.close();
    await server.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await dashboard.close();
    await server.close();
    process.exit(0);
  });

  try {
    // Start embedded Web Control Dashboard in the same process (Zero Split-Brain)
    if (process.env.OMNIPILOT_DISABLE_DASHBOARD !== "true") {
      await dashboard.start().catch((err) => {
        console.error(`[OmniPilot-MCP] Dashboard port ${port} busy, continuing MCP Stdio only: ${err.message}`);
      });
    }

    await server.startStdio();
    console.error("[OmniPilot-MCP] Server running via Stdio transport standard 2024-11-05.");
  } catch (error) {
    console.error("[OmniPilot-MCP] Fatal startup error:", error);
    process.exit(1);
  }
}

// Auto-run if executed as CLI entrypoint
if (process.argv[1] && (process.argv[1].endsWith("index.ts") || process.argv[1].endsWith("index.js"))) {
  main().catch((err) => {
    console.error("[OmniPilot-MCP] Unhandled startup failure:", err);
    process.exit(1);
  });
}
