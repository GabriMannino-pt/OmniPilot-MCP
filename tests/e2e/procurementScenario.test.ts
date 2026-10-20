import { describe, it, expect } from "vitest";
import { runProcurementScenario } from "../../src/scenarios/procurementScenario.js";

describe("E2E Scenario: Procurement Report Extraction & Guarded Email Dispatch", () => {
  it("should autonomously navigate, extract report table, fill draft, and trigger HITL guardrail", async () => {
    const result = await runProcurementScenario({ autoApprove: false, headless: true });

    expect(result.success).toBe(true);
    expect(result.invoicesExtracted.length).toBe(2);
    expect(result.invoicesExtracted[0]?.id).toBe("INV-2026-881");
    expect(result.invoicesExtracted[1]?.id).toBe("INV-2026-882");

    expect(result.draftPrepared).toBe(true);
    expect(result.hitlTriggered).toBe(true);
    expect(result.hitlApproved).toBe(true);
    expect(result.auditTrailCount).toBeGreaterThanOrEqual(2);
  });
});
