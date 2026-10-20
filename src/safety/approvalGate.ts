import { EventEmitter } from "node:events";
import * as readline from "node:readline";
import { BoundingBox } from "../mcp/schemas.js";

export interface ApprovalRequest {
  id: string;
  timestamp: string;
  actionSummary: string;
  tier: number;
  boundingBox?: BoundingBox;
  annotatedScreenshot?: string;
  contextDetails?: Record<string, any>;
  status: "pending" | "approved" | "rejected" | "timed_out";
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  toolName: string;
  params: Record<string, any>;
  tier: number;
  requiresHITL: boolean;
  approvalStatus?: "approved" | "rejected" | "bypassed" | "none";
  executionDurationMs?: number;
  success: boolean;
  error?: string;
}

export interface ApprovalGateOptions {
  autoApprove?: boolean;
  timeoutMs?: number;
  enableCliPrompt?: boolean;
}

export class ApprovalGate extends EventEmitter {
  private pendingRequests: Map<
    string,
    {
      request: ApprovalRequest;
      resolve: (approved: boolean) => void;
    }
  > = new Map();

  private auditLogs: AuditLogEntry[] = [];
  private autoApprove: boolean = false;
  private defaultTimeoutMs: number = 60000;
  private enableCliPrompt: boolean = false;

  constructor(options?: ApprovalGateOptions) {
    super();
    if (options?.autoApprove !== undefined) {
      this.autoApprove = options.autoApprove;
    }
    if (options?.timeoutMs !== undefined) {
      this.defaultTimeoutMs = options.timeoutMs;
    }
    if (options?.enableCliPrompt !== undefined) {
      this.enableCliPrompt = options.enableCliPrompt;
    }
  }

  public setAutoApprove(enabled: boolean): void {
    this.autoApprove = enabled;
  }

  /**
   * Request human approval for a critical action
   */
  public async requestApproval(
    actionSummary: string,
    tier: number = 3,
    boundingBox?: BoundingBox,
    contextDetails?: Record<string, any>,
    timeoutMs: number = this.defaultTimeoutMs,
    annotatedScreenshot?: string
  ): Promise<{ approved: boolean; requestId: string }> {
    const id = `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const request: ApprovalRequest = {
      id,
      timestamp: new Date().toISOString(),
      actionSummary,
      tier,
      boundingBox,
      annotatedScreenshot,
      contextDetails,
      status: "pending",
    };

    if (this.autoApprove) {
      request.status = "approved";
      this.emit("approval:decided", { ...request });
      return { approved: true, requestId: id };
    }

    return new Promise((resolve) => {
      let timer: NodeJS.Timeout | null = null;

      const finish = (approved: boolean, status: ApprovalRequest["status"]) => {
        if (timer) clearTimeout(timer);
        this.pendingRequests.delete(id);
        request.status = status;
        this.emit("approval:decided", { ...request });
        resolve({ approved, requestId: id });
      };

      timer = setTimeout(() => {
        finish(false, "timed_out");
      }, timeoutMs);

      this.pendingRequests.set(id, {
        request,
        resolve: (approved: boolean) => finish(approved, approved ? "approved" : "rejected"),
      });

      this.emit("approval:requested", { ...request });

      // If interactive CLI prompt is enabled and running in terminal
      if (this.enableCliPrompt && process.stdin.isTTY) {
        this.promptInCli(request);
      }
    });
  }

  /**
   * Interactive CLI prompt for human terminal operators
   */
  private promptInCli(request: ApprovalRequest): void {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.error("\n=======================================================");
    console.error("🛑 [HITL CONFIRMATION REQUIRED]");
    console.error(`Action: ${request.actionSummary}`);
    console.error(`Risk Tier: ${request.tier} (Critical / Irreversible)`);
    if (request.boundingBox) {
      console.error(`Target Coordinates: (${request.boundingBox.x}, ${request.boundingBox.y}) [${request.boundingBox.width}x${request.boundingBox.height}px]`);
    }
    console.error("=======================================================");

    rl.question("👉 Do you authorize this action? [y/N]: ", (answer) => {
      rl.close();
      const approved = answer.trim().toLowerCase() === "y" || answer.trim().toLowerCase() === "yes";
      this.resolveApproval(request.id, approved);
    });
  }

  /**
   * Resolves a pending approval from UI / CLI / Client
   */
  public resolveApproval(requestId: string, approved: boolean): boolean {
    const entry = this.pendingRequests.get(requestId);
    if (!entry) return false;
    entry.resolve(approved);
    return true;
  }

  /**
   * Records an audit log entry
   */
  public recordAuditLog(entry: Omit<AuditLogEntry, "id" | "timestamp">): AuditLogEntry {
    const log: AuditLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    this.auditLogs.push(log);
    this.emit("audit:logged", log);
    return log;
  }

  public getAuditLogs(filter?: { tier?: number; successOnly?: boolean }): AuditLogEntry[] {
    let logs = [...this.auditLogs];
    if (filter?.tier !== undefined) {
      logs = logs.filter((l) => l.tier === filter.tier);
    }
    if (filter?.successOnly) {
      logs = logs.filter((l) => l.success);
    }
    return logs;
  }

  public exportAuditLogsJson(): string {
    return JSON.stringify(this.auditLogs, null, 2);
  }

  public getPendingRequests(): ApprovalRequest[] {
    return Array.from(this.pendingRequests.values()).map((p) => ({ ...p.request }));
  }
}
