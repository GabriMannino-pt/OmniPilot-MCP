import { RiskTier } from "../mcp/schemas.js";

export interface ActionPayload {
  toolName: string;
  params: Record<string, any>;
}

export interface RiskEvaluation {
  tier: RiskTier;
  reason: string;
  requiresHITL: boolean;
  sensitiveTokensFound?: string[];
}

/**
 * Keywords and patterns that escalate actions to Tier 3 (Critical / Irreversible)
 */
const CRITICAL_KEYWORDS = [
  "delete",
  "remove",
  "cancella",
  "elimina",
  "invia",
  "send",
  "submit",
  "pay",
  "paga",
  "payment",
  "bonifico",
  "transfer",
  "checkout",
  "purchase",
  "buy",
  "destroy",
  "drop",
  "terminate",
  "publish",
  "pubblica",
  "archive",
  "ordine",
  "order",
];

export class RiskEngine {
  private customCriticalKeywords: Set<string>;

  constructor(customKeywords: string[] = []) {
    this.customCriticalKeywords = new Set([
      ...CRITICAL_KEYWORDS,
      ...customKeywords.map((k) => k.toLowerCase()),
    ]);
  }

  /**
   * Evaluates the risk tier for a requested tool action
   */
  public evaluateAction(action: ActionPayload): RiskEvaluation {
    const { toolName, params } = action;

    // Explicit approval requests are Tier 3 by design
    if (toolName === "omnipilot_request_approval") {
      return {
        tier: RiskTier.TIER_3_CRITICAL,
        reason: "Explicit Human-In-The-Loop approval request triggered",
        requiresHITL: true,
      };
    }

    // Tier 1: Read-Only Actions
    if (
      toolName === "omnipilot_take_screenshot" ||
      toolName === "omnipilot_inspect_dom"
    ) {
      return {
        tier: RiskTier.TIER_1_SAFE,
        reason: "Read-only inspection action with zero side effects",
        requiresHITL: false,
      };
    }

    // Check mutating actions for Tier 3 keywords
    const matchedTokens: string[] = [];

    // Check selector in click / type
    if (typeof params.selector === "string") {
      const lower = params.selector.toLowerCase();
      for (const keyword of this.customCriticalKeywords) {
        if (lower.includes(keyword)) {
          matchedTokens.push(`selector contains '${keyword}'`);
        }
      }
    }

    // Check text input in type_text
    if (typeof params.text === "string" && !params.isSecret) {
      const lower = params.text.toLowerCase();
      for (const keyword of this.customCriticalKeywords) {
        if (lower.includes(keyword)) {
          matchedTokens.push(`input text contains '${keyword}'`);
        }
      }
    }

    // Secret credential entry is critical
    if (params.isSecret === true) {
      return {
        tier: RiskTier.TIER_3_CRITICAL,
        reason: "Secret credential / sensitive token input detected",
        requiresHITL: true,
        sensitiveTokensFound: ["isSecret: true"],
      };
    }

    if (matchedTokens.length > 0) {
      return {
        tier: RiskTier.TIER_3_CRITICAL,
        reason: `Potential irreversible action detected: ${matchedTokens.join(", ")}`,
        requiresHITL: true,
        sensitiveTokensFound: matchedTokens,
      };
    }

    // Tier 2: Mutating but Low Risk (form fill, non-critical clicks, typing)
    if (
      toolName === "omnipilot_click_element" ||
      toolName === "omnipilot_click_coordinate" ||
      toolName === "omnipilot_type_text"
    ) {
      return {
        tier: RiskTier.TIER_2_LOW_RISK,
        reason: "Mutating action classified as recoverable or non-critical",
        requiresHITL: false,
      };
    }

    // Default fallback to Tier 2 with logging
    return {
      tier: RiskTier.TIER_2_LOW_RISK,
      reason: `Unclassified action ${toolName} defaulted to Tier 2`,
      requiresHITL: false,
    };
  }

  /**
   * Add dynamic critical keywords (e.g., from domain specific business rules)
   */
  public addCriticalKeyword(keyword: string): void {
    this.customCriticalKeywords.add(keyword.toLowerCase());
  }
}
