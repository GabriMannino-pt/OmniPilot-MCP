import { describe, it, expect } from "vitest";
import { ApprovalGate } from "../../src/safety/approvalGate.js";

describe("ApprovalGate (Human-in-the-Loop Event Gate)", () => {
  it("should auto-approve when autoApprove is enabled", async () => {
    const gate = new ApprovalGate({ autoApprove: true });
    const result = await gate.requestApproval("Send email blast", 3);

    expect(result.approved).toBe(true);
    expect(result.requestId).toBeDefined();
  });

  it("should suspend execution and emit approval:requested event until resolved", async () => {
    const gate = new ApprovalGate({ autoApprove: false });
    let emittedEvent: any = null;

    gate.on("approval:requested", (req) => {
      emittedEvent = req;
      // Simulate asynchronous human review and approval
      setTimeout(() => {
        gate.resolveApproval(req.id, true);
      }, 50);
    });

    const result = await gate.requestApproval("Delete production cluster", 3, {
      x: 100,
      y: 200,
      width: 50,
      height: 30,
    });

    expect(emittedEvent).not.toBeNull();
    expect(emittedEvent.actionSummary).toBe("Delete production cluster");
    expect(emittedEvent.boundingBox).toEqual({ x: 100, y: 200, width: 50, height: 30 });
    expect(result.approved).toBe(true);
  });

  it("should handle rejection correctly", async () => {
    const gate = new ApprovalGate({ autoApprove: false });

    gate.on("approval:requested", (req) => {
      setTimeout(() => {
        gate.resolveApproval(req.id, false);
      }, 50);
    });

    const result = await gate.requestApproval("Drop database tables", 3);
    expect(result.approved).toBe(false);
  });

  it("should time out if no approval response is given", async () => {
    const gate = new ApprovalGate({ autoApprove: false, timeoutMs: 100 });
    const result = await gate.requestApproval("Transfer funds", 3);

    expect(result.approved).toBe(false);
  });

  it("should accurately maintain structured audit logs", () => {
    const gate = new ApprovalGate();

    gate.recordAuditLog({
      toolName: "omnipilot_take_screenshot",
      params: { target: "browser" },
      tier: 1,
      requiresHITL: false,
      success: true,
      executionDurationMs: 15,
    });

    gate.recordAuditLog({
      toolName: "omnipilot_click_element",
      params: { selector: "button#confirm" },
      tier: 3,
      requiresHITL: true,
      approvalStatus: "approved",
      success: true,
      executionDurationMs: 320,
    });

    const logs = gate.getAuditLogs();
    expect(logs.length).toBe(2);
    expect(logs[0]?.toolName).toBe("omnipilot_take_screenshot");
    expect(logs[1]?.approvalStatus).toBe("approved");
  });
});
