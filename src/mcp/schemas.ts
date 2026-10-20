import { z } from "zod";

/**
 * Risk levels defined in the 3-Tier Risk Engine
 */
export enum RiskTier {
  TIER_1_SAFE = 1,
  TIER_2_LOW_RISK = 2,
  TIER_3_CRITICAL = 3,
}

export const RiskTierEnum = z.nativeEnum(RiskTier);

/**
 * Bounding Box schema for visual grounding and HITL modal highlighting
 */
export const BoundingBoxSchema = z.object({
  x: z.number().describe("X coordinate in pixels"),
  y: z.number().describe("Y coordinate in pixels"),
  width: z.number().describe("Width in pixels"),
  height: z.number().describe("Height in pixels"),
});

export type BoundingBox = z.infer<typeof BoundingBoxSchema>;

/**
 * Tool 1: omnipilot_take_screenshot
 */
export const TakeScreenshotInputSchema = z.object({
  target: z
    .enum(["browser", "desktop"])
    .default("browser")
    .describe("Target canvas: active browser tab or whole desktop display"),
  format: z
    .enum(["base64", "path"])
    .default("base64")
    .describe("Output representation format"),
  fullPage: z
    .boolean()
    .optional()
    .default(false)
    .describe("Whether to capture full scrollable page (browser only)"),
});

export type TakeScreenshotInput = z.infer<typeof TakeScreenshotInputSchema>;

/**
 * Tool 2: omnipilot_inspect_dom
 */
export const InspectDomInputSchema = z.object({
  selector: z
    .string()
    .optional()
    .describe("Optional CSS selector to scope the inspection subtree"),
  includeAccessibility: z
    .boolean()
    .optional()
    .default(true)
    .describe("Include ARIA accessibility tree with roles and semantic attributes"),
  maxDepth: z
    .number()
    .int()
    .positive()
    .optional()
    .default(5)
    .describe("Maximum traversal depth for tree generation"),
});

export type InspectDomInput = z.infer<typeof InspectDomInputSchema>;

/**
 * Tool 3: omnipilot_click_element
 */
export const ClickElementInputSchema = z.object({
  selector: z
    .string()
    .min(1)
    .describe("CSS or XPath selector of the interactive DOM element"),
  waitForNavigation: z
    .boolean()
    .optional()
    .default(false)
    .describe("Whether to wait for page navigation or network idle after click"),
  timeoutMs: z
    .number()
    .int()
    .positive()
    .optional()
    .default(5000)
    .describe("Timeout in milliseconds"),
});

export type ClickElementInput = z.infer<typeof ClickElementInputSchema>;

/**
 * Tool 4: omnipilot_click_coordinate
 */
export const ClickCoordinateInputSchema = z.object({
  x: z.number().describe("X screen or canvas coordinate"),
  y: z.number().describe("Y screen or canvas coordinate"),
  button: z
    .enum(["left", "right", "middle"])
    .optional()
    .default("left")
    .describe("Mouse button to trigger"),
  clickCount: z
    .number()
    .int()
    .min(1)
    .max(3)
    .optional()
    .default(1)
    .describe("Number of consecutive clicks (e.g., 2 for double-click)"),
});

export type ClickCoordinateInput = z.infer<typeof ClickCoordinateInputSchema>;

/**
 * Tool 5: omnipilot_type_text
 */
export const TypeTextInputSchema = z.object({
  text: z.string().describe("Text payload to input"),
  selector: z
    .string()
    .optional()
    .describe("Optional target DOM element selector to focus before typing"),
  pressEnter: z
    .boolean()
    .optional()
    .default(false)
    .describe("Press Enter key immediately after typing"),
  isSecret: z
    .boolean()
    .optional()
    .default(false)
    .describe("Mask characters in logs for credentials/tokens"),
  clearExisting: z
    .boolean()
    .optional()
    .default(false)
    .describe("Clear input content before writing"),
});

export type TypeTextInput = z.infer<typeof TypeTextInputSchema>;

/**
 * Tool 6: omnipilot_request_approval (HITL Guardrail)
 */
export const RequestApprovalInputSchema = z.object({
  actionSummary: z
    .string()
    .min(1)
    .describe("Clear explanation of the critical action intended"),
  tier: z
    .literal(3)
    .or(z.literal(RiskTier.TIER_3_CRITICAL))
    .default(3)
    .describe("Safety risk tier (3 = Critical/Irreversible)"),
  boundingBox: BoundingBoxSchema.optional().describe(
    "Optional bounding box on screen highlighting the critical element"
  ),
  contextDetails: z
    .record(z.any())
    .optional()
    .describe("Arbitrary structured metadata about the operation"),
});

export type RequestApprovalInput = z.infer<typeof RequestApprovalInputSchema>;
