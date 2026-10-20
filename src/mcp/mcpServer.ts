import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { BrowserDriver } from "../execution/browserDriver.js";
import { DesktopDriver } from "../execution/desktopDriver.js";
import { DomEngine } from "../perception/domEngine.js";
import { VisionEngine } from "../perception/visionEngine.js";
import { RiskEngine } from "../safety/riskEngine.js";
import { ApprovalGate } from "../safety/approvalGate.js";
import { registerAllTools, ToolsContext } from "./handlers/toolsHandler.js";
import { registerAllResources } from "./handlers/resourcesHandler.js";
import { registerAllPrompts } from "./handlers/promptsHandler.js";

export interface OmniPilotServerOptions {
  name?: string;
  version?: string;
  browserDriver?: BrowserDriver;
  desktopDriver?: DesktopDriver;
  riskEngine?: RiskEngine;
  approvalGate?: ApprovalGate;
  autoApprove?: boolean;
}

export class OmniPilotMcpServer {
  private server: McpServer;
  private ctx: ToolsContext;

  constructor(options: OmniPilotServerOptions = {}) {
    const name = options.name ?? "omnipilot-mcp";
    const version = options.version ?? "0.1.0";

    this.server = new McpServer({
      name,
      version,
    });

    const browserDriver = options.browserDriver ?? new BrowserDriver();
    const desktopDriver = options.desktopDriver ?? new DesktopDriver();
    const domEngine = new DomEngine(browserDriver);
    const visionEngine = new VisionEngine(browserDriver, desktopDriver);
    const riskEngine = options.riskEngine ?? new RiskEngine();
    const approvalGate =
      options.approvalGate ??
      new ApprovalGate({ autoApprove: options.autoApprove ?? false });

    this.ctx = {
      browserDriver,
      desktopDriver,
      domEngine,
      visionEngine,
      riskEngine,
      approvalGate,
    };

    // Register all protocol modules
    registerAllTools(this.server, this.ctx);
    registerAllResources(this.server, this.ctx);
    registerAllPrompts(this.server, this.ctx);
  }

  public getContext(): ToolsContext {
    return this.ctx;
  }

  public getMcpServer(): McpServer {
    return this.server;
  }

  public async connect(transport: Transport): Promise<void> {
    await this.server.connect(transport);
  }

  public async startStdio(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }

  public async close(): Promise<void> {
    await this.server.close();
    await this.ctx.browserDriver.close();
  }
}
