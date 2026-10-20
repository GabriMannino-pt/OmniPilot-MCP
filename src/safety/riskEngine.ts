import { RiskTier, BoundingBox } from "../mcp/schemas.js";

export interface ActionPayload {
  toolName: string;
  params: Record<string, any>;
  urlContext?: string;
  elementText?: string;
}

export interface RiskRule {
  id: string;
  name: string;
  match: (action: ActionPayload) => boolean;
  tier: RiskTier;
  reason: string;
}

export interface RiskEvaluation {
  tier: RiskTier;
  reason: string;
  requiresHITL: boolean;
  matchedRules: string[];
  sensitiveTokensFound?: string[];
  suggestedBoundingBox?: BoundingBox;
}

/**
 * Built-in sensitive action patterns (Italian & English)
 */
const CRITICAL_KEYWORDS = [
  // Deletion / Destruction
  "delete",
  "cancella",
  "elimina",
  "rimuovi",
  "remove",
  "destroy",
  "drop",
  "truncate",
  "terminate",
  "purge",

  // Financial & Orders
  "pay",
  "paga",
  "payment",
  "pagamento",
  "bonifico",
  "transfer",
  "wire",
  "checkout",
  "purchase",
  "acquista",
  "compra",
  "buy",
  "order",
  "ordine",
  "invoice",
  "fattura",

  // Irreversible External Communication
  "send",
  "invia",
  "spedisci",
  "dispatch",
  "broadcast",
  "publish",
  "pubblica",
  "post",

  // System & Security modifications
  "revoke",
  "revoca",
  "grant",
  "authorize",
  "autorizza",
  "reset",
  "shutdown",
];

const SENSITIVE_URL_PATTERNS = [
  /checkout/i,
  /payment/i,
  /pagamento/i,
  /bonifico/i,
  /banking/i,
  /admin\/delete/i,
  /cart\/submit/i,
];

export class RiskEngine {
  private customKeywords: Set<string>;
  private customRules: RiskRule[] = [];

  constructor(customKeywords: string[] = []) {
    this.customKeywords = new Set([
      ...CRITICAL_KEYWORDS,
      ...customKeywords.map((k) => k.toLowerCase()),
    ]);
  }

  /**
   * Register custom enterprise risk rule
   */
  public addRule(rule: RiskRule): void {
    this.customRules.push(rule);
  }

  /**
   * Evaluates the risk tier for a requested tool action
   */
  public evaluateAction(action: ActionPayload): RiskEvaluation {
    const { toolName, params, urlContext, elementText } = action;
    const matchedRules: string[] = [];
    const sensitiveTokens: string[] = [];

    // 1. Explicit approval requests are always Tier 3
    if (toolName === "omnipilot_request_approval") {
      return {
        tier: RiskTier.TIER_3_CRITICAL,
        reason: "Explicit Human-In-The-Loop approval request triggered",
        requiresHITL: true,
        matchedRules: ["rule:explicit_request_approval"],
        suggestedBoundingBox: params.boundingBox,
      };
    }

    // 2. Custom enterprise rules evaluation
    for (const rule of this.customRules) {
      if (rule.match(action)) {
        matchedRules.push(rule.id);
        if (rule.tier === RiskTier.TIER_3_CRITICAL) {
          return {
            tier: RiskTier.TIER_3_CRITICAL,
            reason: rule.reason,
            requiresHITL: true,
            matchedRules,
          };
        }
      }
    }

    // 3. Tier 1: Read-Only Actions (No Side Effects)
    if (
      toolName === "omnipilot_take_screenshot" ||
      toolName === "omnipilot_inspect_dom"
    ) {
      return {
        tier: RiskTier.TIER_1_SAFE,
        reason: "Read-only inspection action with zero side effects",
        requiresHITL: false,
        matchedRules: ["rule:read_only_default"],
      };
    }

    // 4. Sensitive URL Context Check (e.g., executing mutations on banking/checkout pages)
    if (urlContext) {
      for (const pattern of SENSITIVE_URL_PATTERNS) {
        if (pattern.test(urlContext)) {
          matchedRules.push(`url_pattern:${pattern.source}`);
          sensitiveTokens.push(`URL context matches sensitive route: ${urlContext}`);
        }
      }
    }

    // 5. Selector text inspection
    if (typeof params.selector === "string") {
      const lower = params.selector.toLowerCase();
      for (const keyword of this.customKeywords) {
        if (lower.includes(keyword)) {
          sensitiveTokens.push(`selector contains '${keyword}'`);
        }
      }
    }

    // 6. Direct element text inspection if provided
    if (elementText) {
      const lower = elementText.toLowerCase();
      for (const keyword of this.customKeywords) {
        if (lower.includes(keyword)) {
          sensitiveTokens.push(`element text contains '${keyword}'`);
        }
      }
    }

    // 7. Text payload inspection (for typing)
    if (typeof params.text === "string" && !params.isSecret) {
      const lower = params.text.toLowerCase();
      for (const keyword of this.customKeywords) {
        if (lower.includes(keyword)) {
          sensitiveTokens.push(`typed text contains '${keyword}'`);
        }
      }
    }

    // 8. Secret credentials or passwords
    if (params.isSecret === true) {
      return {
        tier: RiskTier.TIER_3_CRITICAL,
        reason: "Secret credential / sensitive token input detected",
        requiresHITL: true,
        matchedRules: ["rule:secret_credential_masking"],
        sensitiveTokensFound: ["isSecret: true"],
      };
    }

    // If critical tokens were matched, escalate to Tier 3
    if (sensitiveTokens.length > 0) {
      return {
        tier: RiskTier.TIER_3_CRITICAL,
        reason: `Potential irreversible action detected: ${sensitiveTokens.join(", ")}`,
        requiresHITL: true,
        matchedRules: ["rule:keyword_intent_escalation", ...matchedRules],
        sensitiveTokensFound: sensitiveTokens,
      };
    }

    // 9. Standard mutating actions -> Tier 2 (Low Risk / Recoverable)
    if (
      toolName === "omnipilot_click_element" ||
      toolName === "omnipilot_click_coordinate" ||
      toolName === "omnipilot_type_text"
    ) {
      return {
        tier: RiskTier.TIER_2_LOW_RISK,
        reason: "Mutating action classified as recoverable or non-critical",
        requiresHITL: false,
        matchedRules: ["rule:mutating_low_risk_default"],
      };
    }

    // Fallback to Tier 2 with logging
    return {
      tier: RiskTier.TIER_2_LOW_RISK,
      reason: `Unclassified action ${toolName} defaulted to Tier 2`,
      requiresHITL: false,
      matchedRules: ["rule:default_fallback"],
    };
  }

  public addCriticalKeyword(keyword: string): void {
    this.customKeywords.add(keyword.toLowerCase());
  }
}
