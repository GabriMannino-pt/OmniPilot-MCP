import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  TakeScreenshotInputSchema,
  InspectDomInputSchema,
  ClickElementInputSchema,
  ClickCoordinateInputSchema,
  TypeTextInputSchema,
  RequestApprovalInputSchema,
  RiskTier,
} from "../schemas.js";
import { BrowserDriver } from "../../execution/browserDriver.js";
import { DesktopDriver } from "../../execution/desktopDriver.js";
import { DomEngine } from "../../perception/domEngine.js";
import { VisionEngine } from "../../perception/visionEngine.js";
import { RiskEngine } from "../../safety/riskEngine.js";
import { ApprovalGate } from "../../safety/approvalGate.js";

export interface ToolsContext {
  browserDriver: BrowserDriver;
  desktopDriver: DesktopDriver;
  domEngine: DomEngine;
  visionEngine: VisionEngine;
  riskEngine: RiskEngine;
  approvalGate: ApprovalGate;
}

export function registerAllTools(server: McpServer, ctx: ToolsContext): void {
  /**
   * Tool 1: omnipilot_take_screenshot
   */
  server.registerTool(
    "omnipilot_take_screenshot",
    {
      title: "OmniPilot Take Screenshot",
      description:
        "Scatta uno screenshot istantaneo dello schermo desktop o della scheda browser attiva.",
      inputSchema: TakeScreenshotInputSchema.shape,
    },
    async (args) => {
      const startTime = Date.now();
      const risk = ctx.riskEngine.evaluateAction({
        toolName: "omnipilot_take_screenshot",
        params: args,
      });

      try {
        const result = await ctx.visionEngine.capture(
          args.target,
          args.format,
          args.fullPage
        );

        ctx.approvalGate.recordAuditLog({
          toolName: "omnipilot_take_screenshot",
          params: args,
          tier: risk.tier,
          requiresHITL: false,
          executionDurationMs: Date.now() - startTime,
          success: true,
        });

        if (args.format === "base64") {
          return {
            content: [
              {
                type: "image",
                data: result.data,
                mimeType: "image/png",
              },
              {
                type: "text",
                text: JSON.stringify({
                  status: "success",
                  target: args.target,
                  timestamp: result.timestamp,
                  tier: RiskTier[risk.tier],
                }),
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  status: "success",
                  target: args.target,
                  format: "path",
                  filePath: result.data,
                  timestamp: result.timestamp,
                  tier: RiskTier[risk.tier],
                }),
              },
            ],
          };
        }
      } catch (err: any) {
        ctx.approvalGate.recordAuditLog({
          toolName: "omnipilot_take_screenshot",
          params: args,
          tier: risk.tier,
          requiresHITL: false,
          executionDurationMs: Date.now() - startTime,
          success: false,
          error: err.message,
        });
        return {
          content: [
            {
              type: "text",
              text: `Error taking screenshot: ${err.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  /**
   * Tool 2: omnipilot_inspect_dom
   */
  server.registerTool(
    "omnipilot_inspect_dom",
    {
      title: "OmniPilot Inspect DOM",
      description:
        "Estrae l'albero di accessibilità semantico del DOM (ruoli, etichette ARIA, coordinate bounding box).",
      inputSchema: InspectDomInputSchema.shape,
    },
    async (args) => {
      const startTime = Date.now();
      const risk = ctx.riskEngine.evaluateAction({
        toolName: "omnipilot_inspect_dom",
        params: args,
      });

      try {
        const domResult = await ctx.domEngine.inspect(
          args.selector,
          args.includeAccessibility
        );

        ctx.approvalGate.recordAuditLog({
          toolName: "omnipilot_inspect_dom",
          params: args,
          tier: risk.tier,
          requiresHITL: false,
          executionDurationMs: Date.now() - startTime,
          success: true,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "success",
                  dom: domResult,
                  tier: RiskTier[risk.tier],
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        ctx.approvalGate.recordAuditLog({
          toolName: "omnipilot_inspect_dom",
          params: args,
          tier: risk.tier,
          requiresHITL: false,
          executionDurationMs: Date.now() - startTime,
          success: false,
          error: err.message,
        });
        return {
          content: [
            {
              type: "text",
              text: `Error inspecting DOM: ${err.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  /**
   * Tool 3: omnipilot_click_element
   */
  server.registerTool(
    "omnipilot_click_element",
    {
      title: "OmniPilot Click DOM Element",
      description:
        "Esegue un click deterministico su un elemento del DOM garantendo il corretto trigger degli eventi JavaScript.",
      inputSchema: ClickElementInputSchema.shape,
    },
    async (args) => {
      const startTime = Date.now();
      const risk = ctx.riskEngine.evaluateAction({
        toolName: "omnipilot_click_element",
        params: args,
      });

      // Human-In-The-Loop gate check if escalated to Tier 3
      if (risk.requiresHITL) {
        const approval = await ctx.approvalGate.requestApproval(
          `Click on critical DOM element: "${args.selector}" (${risk.reason})`,
          risk.tier,
          undefined,
          { selector: args.selector, risk }
        );

        if (!approval.approved) {
          ctx.approvalGate.recordAuditLog({
            toolName: "omnipilot_click_element",
            params: args,
            tier: risk.tier,
            requiresHITL: true,
            approvalStatus: "rejected",
            executionDurationMs: Date.now() - startTime,
            success: false,
            error: "Action rejected or timed out by Human-in-the-Loop gate",
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  status: "rejected",
                  reason: "Operation blocked by HITL safety policy",
                  details: risk.reason,
                }),
              },
            ],
            isError: true,
          };
        }
      }

      try {
        const result = await ctx.browserDriver.clickElement(
          args.selector,
          args.waitForNavigation
        );

        ctx.approvalGate.recordAuditLog({
          toolName: "omnipilot_click_element",
          params: args,
          tier: risk.tier,
          requiresHITL: risk.requiresHITL,
          approvalStatus: risk.requiresHITL ? "approved" : "none",
          executionDurationMs: Date.now() - startTime,
          success: true,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "success",
                action: "click_element",
                result,
                tier: RiskTier[risk.tier],
              }),
            },
          ],
        };
      } catch (err: any) {
        ctx.approvalGate.recordAuditLog({
          toolName: "omnipilot_click_element",
          params: args,
          tier: risk.tier,
          requiresHITL: risk.requiresHITL,
          executionDurationMs: Date.now() - startTime,
          success: false,
          error: err.message,
        });
        return {
          content: [
            {
              type: "text",
              text: `Error clicking element "${args.selector}": ${err.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  /**
   * Tool 4: omnipilot_click_coordinate
   */
  server.registerTool(
    "omnipilot_click_coordinate",
    {
      title: "OmniPilot Click Coordinates",
      description:
        "Muove il cursore virtuale alle coordinate XY ed esegue il click a livello OS/Canvas.",
      inputSchema: ClickCoordinateInputSchema.shape,
    },
    async (args) => {
      const startTime = Date.now();
      const risk = ctx.riskEngine.evaluateAction({
        toolName: "omnipilot_click_coordinate",
        params: args,
      });

      try {
        const result = await ctx.desktopDriver.clickCoordinate(
          args.x,
          args.y,
          args.button,
          args.clickCount
        );

        ctx.approvalGate.recordAuditLog({
          toolName: "omnipilot_click_coordinate",
          params: args,
          tier: risk.tier,
          requiresHITL: false,
          executionDurationMs: Date.now() - startTime,
          success: true,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "success",
                action: "click_coordinate",
                result,
                tier: RiskTier[risk.tier],
              }),
            },
          ],
        };
      } catch (err: any) {
        ctx.approvalGate.recordAuditLog({
          toolName: "omnipilot_click_coordinate",
          params: args,
          tier: risk.tier,
          requiresHITL: false,
          executionDurationMs: Date.now() - startTime,
          success: false,
          error: err.message,
        });
        return {
          content: [
            {
              type: "text",
              text: `Error clicking coordinate (${args.x}, ${args.y}): ${err.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  /**
   * Tool 5: omnipilot_type_text
   */
  server.registerTool(
    "omnipilot_type_text",
    {
      title: "OmniPilot Type Text",
      description:
        "Digita testo simulando la pressione di tasti umani o compilando direttamente input di form.",
      inputSchema: TypeTextInputSchema.shape,
    },
    async (args) => {
      const startTime = Date.now();
      const risk = ctx.riskEngine.evaluateAction({
        toolName: "omnipilot_type_text",
        params: args,
      });

      if (risk.requiresHITL) {
        const approval = await ctx.approvalGate.requestApproval(
          `Type sensitive text or credential (${risk.reason})`,
          risk.tier,
          undefined,
          { isSecret: args.isSecret, selector: args.selector }
        );

        if (!approval.approved) {
          ctx.approvalGate.recordAuditLog({
            toolName: "omnipilot_type_text",
            params: { ...args, text: args.isSecret ? "[REDACTED]" : args.text },
            tier: risk.tier,
            requiresHITL: true,
            approvalStatus: "rejected",
            executionDurationMs: Date.now() - startTime,
            success: false,
            error: "Action rejected by Human-in-the-Loop gate",
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  status: "rejected",
                  reason: "Text typing blocked by HITL safety policy",
                }),
              },
            ],
            isError: true,
          };
        }
      }

      try {
        const result = await ctx.browserDriver.typeText(
          args.text,
          args.selector,
          args.pressEnter,
          args.clearExisting
        );

        ctx.approvalGate.recordAuditLog({
          toolName: "omnipilot_type_text",
          params: { ...args, text: args.isSecret ? "[REDACTED]" : args.text },
          tier: risk.tier,
          requiresHITL: risk.requiresHITL,
          approvalStatus: risk.requiresHITL ? "approved" : "none",
          executionDurationMs: Date.now() - startTime,
          success: true,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "success",
                action: "type_text",
                result,
                tier: RiskTier[risk.tier],
              }),
            },
          ],
        };
      } catch (err: any) {
        ctx.approvalGate.recordAuditLog({
          toolName: "omnipilot_type_text",
          params: { ...args, text: args.isSecret ? "[REDACTED]" : args.text },
          tier: risk.tier,
          requiresHITL: risk.requiresHITL,
          executionDurationMs: Date.now() - startTime,
          success: false,
          error: err.message,
        });
        return {
          content: [
            {
              type: "text",
              text: `Error typing text: ${err.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  /**
   * Tool 6: omnipilot_request_approval (HITL Guardrail)
   */
  server.registerTool(
    "omnipilot_request_approval",
    {
      title: "OmniPilot Request Approval",
      description:
        "Guardrail HITL: Sospende l'esecuzione, genera una richiesta di autorizzazione esplicita con bounding box per azioni Tier 3 critiche.",
      inputSchema: RequestApprovalInputSchema.shape,
    },
    async (args) => {
      const startTime = Date.now();

      // Optionally capture annotated visual frame with red bounding box
      let annotatedFrame: string | undefined = undefined;
      if (args.boundingBox) {
        try {
          const capture = await ctx.visionEngine.capture("browser", "base64", false, [
            {
              box: args.boundingBox,
              label: `TIER 3: ${args.actionSummary.slice(0, 30)}`,
              color: "#ef4444",
            },
          ]);
          annotatedFrame = capture.data;
        } catch {
          // Non-blocking visual decoration fallback
        }
      }

      const approval = await ctx.approvalGate.requestApproval(
        args.actionSummary,
        args.tier,
        args.boundingBox,
        args.contextDetails
      );

      ctx.approvalGate.recordAuditLog({
        toolName: "omnipilot_request_approval",
        params: args,
        tier: RiskTier.TIER_3_CRITICAL,
        requiresHITL: true,
        approvalStatus: approval.approved ? "approved" : "rejected",
        executionDurationMs: Date.now() - startTime,
        success: approval.approved,
      });

      const contents: any[] = [];
      if (annotatedFrame) {
        contents.push({
          type: "image",
          data: annotatedFrame,
          mimeType: "image/png",
        });
      }

      contents.push({
        type: "text",
        text: JSON.stringify({
          status: approval.approved ? "approved" : "rejected",
          requestId: approval.requestId,
          actionSummary: args.actionSummary,
          boundingBox: args.boundingBox,
          tier: "TIER_3_CRITICAL",
        }),
      });

      return {
        content: contents,
      };
    }
  );
}
