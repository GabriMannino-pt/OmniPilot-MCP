import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ToolsContext } from "./toolsHandler.js";

export function registerAllResources(server: McpServer, ctx: ToolsContext): void {
  /**
   * Resource 1: omnipilot://status
   */
  server.registerResource(
    "OmniPilot Runtime Status",
    "omnipilot://status",
    {
      mimeType: "application/json",
      description: "Live operational status of OmniPilot-MCP engine, active drivers, and risk state.",
    },
    async (uri) => {
      const payload = {
        name: "omnipilot-mcp",
        version: "0.2.0",
        timestamp: new Date().toISOString(),
        status: "operational",
        drivers: {
          browser: ctx.browserDriver.getStatus(),
          desktop: ctx.desktopDriver.getDisplayResolution(),
        },
        safety: {
          pendingApprovals: ctx.approvalGate.getPendingRequests().length,
          totalAuditLogsRecorded: ctx.approvalGate.getAuditLogs().length,
        },
        currentTask: ctx.agentRunner.getCurrentTask(),
      };

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(payload, null, 2),
          },
        ],
      };
    }
  );

  /**
   * Resource 2: omnipilot://audit-log
   */
  server.registerResource(
    "OmniPilot Audit Log",
    "omnipilot://audit-log",
    {
      mimeType: "application/json",
      description: "Structured log of all actions evaluated by the 3-Tier Risk Engine and HITL decisions.",
    },
    async (uri) => {
      const logs = ctx.approvalGate.getAuditLogs();
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(logs, null, 2),
          },
        ],
      };
    }
  );
}
