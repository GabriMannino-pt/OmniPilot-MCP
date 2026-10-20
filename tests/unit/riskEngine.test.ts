import { describe, it, expect } from "vitest";
import { RiskEngine } from "../../src/safety/riskEngine.js";
import { RiskTier } from "../../src/mcp/schemas.js";

describe("RiskEngine (3-Tier Safety Engine)", () => {
  const engine = new RiskEngine();

  it("should classify screenshot capture as Tier 1 Safe", () => {
    const result = engine.evaluateAction({
      toolName: "omnipilot_take_screenshot",
      params: { target: "browser" },
    });

    expect(result.tier).toBe(RiskTier.TIER_1_SAFE);
    expect(result.requiresHITL).toBe(false);
  });

  it("should classify DOM inspection as Tier 1 Safe", () => {
    const result = engine.evaluateAction({
      toolName: "omnipilot_inspect_dom",
      params: { includeAccessibility: true },
    });

    expect(result.tier).toBe(RiskTier.TIER_1_SAFE);
    expect(result.requiresHITL).toBe(false);
  });

  it("should classify standard typing and non-critical clicks as Tier 2 Low Risk", () => {
    const clickResult = engine.evaluateAction({
      toolName: "omnipilot_click_element",
      params: { selector: "div.tab-navigation" },
    });
    expect(clickResult.tier).toBe(RiskTier.TIER_2_LOW_RISK);
    expect(clickResult.requiresHITL).toBe(false);

    const typeResult = engine.evaluateAction({
      toolName: "omnipilot_type_text",
      params: { selector: "input.search-bar", text: "Product Catalog 2026" },
    });
    expect(typeResult.tier).toBe(RiskTier.TIER_2_LOW_RISK);
    expect(typeResult.requiresHITL).toBe(false);
  });

  it("should escalate actions containing critical keywords to Tier 3 Critical", () => {
    const actions = [
      { toolName: "omnipilot_click_element", params: { selector: "button#delete_project" } },
      { toolName: "omnipilot_click_element", params: { selector: "button.submit-order" } },
      { toolName: "omnipilot_click_element", params: { selector: "a.pay-now" } },
      { toolName: "omnipilot_type_text", params: { selector: "input", text: "cancella tutto il database" } },
    ];

    for (const action of actions) {
      const evalResult = engine.evaluateAction(action);
      expect(evalResult.tier).toBe(RiskTier.TIER_3_CRITICAL);
      expect(evalResult.requiresHITL).toBe(true);
      expect(evalResult.sensitiveTokensFound?.length).toBeGreaterThan(0);
    }
  });

  it("should escalate secret credentials typing to Tier 3 Critical", () => {
    const result = engine.evaluateAction({
      toolName: "omnipilot_type_text",
      params: { selector: "#password", text: "SuperSecret!", isSecret: true },
    });

    expect(result.tier).toBe(RiskTier.TIER_3_CRITICAL);
    expect(result.requiresHITL).toBe(true);
  });

  it("should classify omnipilot_request_approval as Tier 3 Critical", () => {
    const result = engine.evaluateAction({
      toolName: "omnipilot_request_approval",
      params: { actionSummary: "Final invoice dispatch" },
    });

    expect(result.tier).toBe(RiskTier.TIER_3_CRITICAL);
    expect(result.requiresHITL).toBe(true);
  });

  it("should allow registering custom critical keywords", () => {
    const customEngine = new RiskEngine(["revoca", "approva_bonifico"]);
    const result = customEngine.evaluateAction({
      toolName: "omnipilot_click_element",
      params: { selector: "#btn_approva_bonifico" },
    });

    expect(result.tier).toBe(RiskTier.TIER_3_CRITICAL);
    expect(result.requiresHITL).toBe(true);
  });
});
