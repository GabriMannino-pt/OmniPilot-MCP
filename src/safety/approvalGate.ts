import { EventEmitter } from "node:events";
import { BoundingBox } from "../mcp/schemas.js";

export interface ApprovalRequest {
  id: string;
  timestamp: string;
  actionSummary: string;
  tier: number;
  boundingBox?: BoundingBox;
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

export class ApprovalGate extends EventEmitter {
  private pendingRequests: Map<string, {
    request: ApprovalRequest;
    resolve: (approved: boolean) => void;
  }> = new Map();

  private auditLogs: AuditLogEntry[] = [];
  private autoApprove: boolean = false;
  private defaultTimeoutMs: number = 30000;

  constructor(options?: { autoApprove?: boolean; timeoutMs?: number }) {
    super();
    if (options?.autoApprove !== undefined) {
      this.autoApprove = options.autoApprove;
    }
    if (options?.timeoutMs !== undefined) {
      this.defaultTimeoutMs = options.timeoutMs;
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
    timeoutMs: number = this.defaultTimeoutMs
  ): Promise<{ approved: boolean; requestId: string }> {
    const id = `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const request: ApprovalRequest = {
      id,
      timestamp: new Date().toISOString(),
      actionSummary,
      tier,
      boundingBox,
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

  public getAuditLogs(): AuditLogEntry[] {
    return [...this.auditLogs];
  }

  public getPendingRequests(): ApprovalRequest[] {
    return Array.from(this.pendingRequests.values()).map((p) => ({ ...p.request }));
  }
}
