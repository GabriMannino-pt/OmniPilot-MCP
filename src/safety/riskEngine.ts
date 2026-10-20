import { RiskTier, BoundingBox } from "../mcp/schemas.js";

export interface HitTestedElement {
  selector?: string;
  tagName?: string;
  text?: string;
  name?: string;
  role?: string;
  type?: string;
  formSubmitText?: string;
  boundingBox?: BoundingBox;
}

export interface ActionPayload {
  toolName: string;
  params: Record<string, any>;
  urlContext?: string;
  elementText?: string;
  hitElement?: HitTestedElement | null;
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
 * Matched using token-boundary rules to prevent substring false positives (e.g. 'border' != 'order')
 */
const CRITICAL_KEYWORDS = [
  // Deletion / Destruction
  "delete",
  "cancella",
  "cancellazione",
  "elimina",
  "eliminazione",
  "rimuovi",
  "remove",
  "destroy",
  "drop",
  "truncate",
  "terminate",
  "purge",
  "wipe",

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
  "addebito",
  "charge",

  // Irreversible External Communication & Submission
  "send",
  "invia",
  "spedisci",
  "dispatch",
  "broadcast",
  "publish",
  "pubblica",
  "post",
  "submit",
  "conferma",
  "confirm",

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
  /\bcheckout\b/i,
  /\bpayment\b/i,
  /\bpagamento\b/i,
  /\bbonifico\b/i,
  /\bbanking\b/i,
  /\badmin\/delete\b/i,
  /\bcart\/submit\b/i,
];

/**
 * Checks if `text` contains `keyword` as a distinct word/token
 * (splits camelCase and treats -, _, ., #, /, spaces as token delimiters,
 * avoiding Scunthorpe false positives like '#border-box' matching 'order')
 */
function extractTokenSet(text: string): Set<string> {
  const normalized = text
    .slice(0, 4096)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase();
  const matches = normalized.match(/[a-z0-9]+/g);
  return new Set(matches || []);
}

function hasKeywordToken(text: string, tokenSet: Set<string>, keyword: string): boolean {
  if (/^[a-z0-9]+$/.test(keyword)) {
    return tokenSet.has(keyword);
  }
  const normalized = text.slice(0, 4096).replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  const escaped = keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i");
  return regex.test(normalized);
}

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
    const { toolName, params, urlContext, elementText, hitElement } = action;
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
            suggestedBoundingBox: hitElement?.boundingBox,
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

    // 4. Navigation check (Safe unless dangerous scheme like javascript:, file://, vbscript:, or cloud metadata SSRF)
    if (toolName === "omnipilot_navigate") {
      const targetUrl = String(params.url || "").trim();
      if (/^(javascript|vbscript|file):/i.test(targetUrl) || /169\.254\.169\.254|metadata\.google\.internal/i.test(targetUrl)) {
        return {
          tier: RiskTier.TIER_3_CRITICAL,
          reason: "Blocked potentially unsafe URI scheme or SSRF cloud metadata endpoint",
          requiresHITL: true,
          matchedRules: ["rule:unsafe_navigation_scheme"],
          sensitiveTokensFound: [targetUrl.slice(0, 40)],
        };
      }
      return {
        tier: RiskTier.TIER_1_SAFE,
        reason: "Standard browser page navigation",
        requiresHITL: false,
        matchedRules: ["rule:navigation_safe"],
      };
    }

    // 5. Secret credentials or passwords (or typing into a password input field)
    if (params.isSecret === true || hitElement?.type === "password") {
      return {
        tier: RiskTier.TIER_3_CRITICAL,
        reason: "Secret credential / sensitive token input detected",
        requiresHITL: true,
        matchedRules: ["rule:secret_credential_masking"],
        sensitiveTokensFound: ["isSecret: true"],
        suggestedBoundingBox: hitElement?.boundingBox,
      };
    }

    // 6. Sensitive URL Context Check (only when clicking submit/buttons or submitting via Enter)
    if (urlContext && (toolName !== "omnipilot_type_text" || params.pressEnter === true)) {
      for (const pattern of SENSITIVE_URL_PATTERNS) {
        if (pattern.test(urlContext)) {
          matchedRules.push(`url_pattern:${pattern.source}`);
          sensitiveTokens.push(`URL context matches sensitive route: ${urlContext}`);
        }
      }
    }

    // 7. Selector inspection (only for click actions or pressEnter submits; typing into a draft field shouldn't fail just because the form exists)
    if (typeof params.selector === "string" && (toolName === "omnipilot_click_element" || params.pressEnter === true)) {
      const selTokens = extractTokenSet(params.selector);
      for (const keyword of this.customKeywords) {
        if (hasKeywordToken(params.selector, selTokens, keyword)) {
          sensitiveTokens.push(`selector contains '${keyword}'`);
        }
      }
    } else if (typeof params.selector === "string" && toolName === "omnipilot_type_text") {
      // For typing without Enter, still check if the input selector itself is a critical credential/card field
      const selTokens = extractTokenSet(params.selector);
      for (const kw of ["cvv", "cvc", "iban", "card", "carta", "password", "pin", "secret", "token"]) {
        if (hasKeywordToken(params.selector, selTokens, kw)) {
          sensitiveTokens.push(`sensitive input selector '${kw}'`);
        }
      }
    }

    // 8. Pre-Flight DOM Hit-Test Element Inspection (catches obfuscated CSS selectors & XY coordinate clicks!)
    const combinedElementText = [
      elementText,
      hitElement?.text,
      hitElement?.name,
      hitElement?.selector,
      params.pressEnter ? hitElement?.formSubmitText : undefined,
    ]
      .filter(Boolean)
      .join(" ");

    if (combinedElementText && (toolName === "omnipilot_click_element" || toolName === "omnipilot_click_coordinate" || params.pressEnter === true)) {
      const elemTokens = extractTokenSet(combinedElementText);
      for (const keyword of this.customKeywords) {
        if (hasKeywordToken(combinedElementText, elemTokens, keyword)) {
          sensitiveTokens.push(`target element contains '${keyword}'`);
        }
      }
    }

    // 9. Text payload inspection (for destructive commands typed directly)
    if (typeof params.text === "string" && !params.isSecret) {
      const textTokens = extractTokenSet(params.text);
      for (const keyword of ["delete", "cancella", "elimina", "drop", "truncate", "destroy", "wipe", "purge"]) {
        if (hasKeywordToken(params.text, textTokens, keyword)) {
          sensitiveTokens.push(`input text contains '${keyword}'`);
        }
      }
    }

    // If critical tokens were matched, escalate to Tier 3
    if (sensitiveTokens.length > 0) {
      return {
        tier: RiskTier.TIER_3_CRITICAL,
        reason: `Potential irreversible action detected: ${sensitiveTokens.join(", ")}`,
        requiresHITL: true,
        matchedRules: ["rule:semantic_intent_escalation", ...matchedRules],
        sensitiveTokensFound: sensitiveTokens,
        suggestedBoundingBox: hitElement?.boundingBox,
      };
    }

    // 10. Standard mutating actions -> Tier 2 (Low Risk / Recoverable)
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
