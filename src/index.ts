#!/usr/bin/env node
import { OmniPilotMcpServer } from "./mcp/mcpServer.js";

export * from "./mcp/mcpServer.js";
export * from "./mcp/schemas.js";
export * from "./mcp/handlers/toolsHandler.js";
export * from "./mcp/handlers/resourcesHandler.js";
export * from "./mcp/handlers/promptsHandler.js";
export * from "./safety/riskEngine.js";
export * from "./safety/approvalGate.js";
export * from "./perception/domEngine.js";
export * from "./perception/visionEngine.js";
export * from "./perception/dualPerception.js";
export * from "./execution/browserDriver.js";
export * from "./execution/desktopDriver.js";

async function main() {
  const server = new OmniPilotMcpServer();

  process.on("SIGINT", async () => {
    await server.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await server.close();
    process.exit(0);
  });

  try {
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
