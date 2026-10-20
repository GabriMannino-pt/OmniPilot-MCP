import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  NavigateInputSchema,
  TakeScreenshotInputSchema,
  InspectDomInputSchema,
  ClickElementInputSchema,
  ClickCoordinateInputSchema,
  TypeTextInputSchema,
  RequestApprovalInputSchema,
  ExecuteTaskInputSchema,
  RiskTier,
} from "../schemas.js";
import { BrowserDriver } from "../../execution/browserDriver.js";
import { DesktopDriver } from "../../execution/desktopDriver.js";
import { DomEngine } from "../../perception/domEngine.js";
import { VisionEngine } from "../../perception/visionEngine.js";
import { DualPerceptionEngine } from "../../perception/dualPerception.js";
import { RiskEngine } from "../../safety/riskEngine.js";
import { ApprovalGate } from "../../safety/approvalGate.js";
import { AgentRunner } from "../../agent/agentRunner.js";

export interface ToolsContext {
  browserDriver: BrowserDriver;
  desktopDriver: DesktopDriver;
  domEngine: DomEngine;
  visionEngine: VisionEngine;
  dualPerception: DualPerceptionEngine;
  riskEngine: RiskEngine;
  approvalGate: ApprovalGate;
  agentRunner: AgentRunner;
}

export function registerAllTools(server: McpServer, ctx: ToolsContext): void {
  /**
   * Tool 0: omnipilot_navigate
   */
  server.registerTool(
    "omnipilot_navigate",
    {
      title: "OmniPilot Navigate URL",
      description:
        "Navigates the active browser session to a target URL or web application.",
      inputSchema: NavigateInputSchema.shape,
    },
    async (args) => {
      const startTime = Date.now();
      const risk = ctx.riskEngine.evaluateAction({
        toolName: "omnipilot_navigate",
        params: args,
      });

      if (risk.requiresHITL) {
        const approval = await ctx.approvalGate.requestApproval(
          `Navigate to sensitive URI: ${args.url} (${risk.reason})`,
          risk.tier,
          undefined,
          { url: args.url }
        );
        if (!approval.approved) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  status: "rejected",
                  reason: "Navigation blocked by HITL safety policy",
                }),
              },
            ],
            isError: true,
          };
        }
      }

      try {
        const finalUrl = await ctx.browserDriver.navigate(args.url, args.waitUntil);
        ctx.approvalGate.recordAuditLog({
          toolName: "omnipilot_navigate",
          params: args,
          tier: risk.tier,
          requiresHITL: risk.requiresHITL,
          executionDurationMs: Date.now() - startTime,
          success: true,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "success",
                action: "navigate",
                activeUrl: finalUrl,
                tier: RiskTier[risk.tier],
              }),
            },
          ],
        };
      } catch (err: any) {
        ctx.approvalGate.recordAuditLog({
          toolName: "omnipilot_navigate",
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
              text: `Error navigating to "${args.url}": ${err.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  /**
   * Tool 1: omnipilot_take_screenshot
   */
  server.registerTool(
    "omnipilot_take_screenshot",
    {
      title: "OmniPilot Take Screenshot",
      description:
        "Captures an instant screenshot of the active browser tab or desktop display, optionally annotated with Set-of-Mark (SoM) badges.",
      inputSchema: TakeScreenshotInputSchema.shape,
    },
    async (args) => {
      const startTime = Date.now();
      const risk = ctx.riskEngine.evaluateAction({
        toolName: "omnipilot_take_screenshot",
        params: args,
      });

      try {
        let result;
        if (args.annotateInteractive && args.target === "browser") {
          const snap = await ctx.dualPerception.getSnapshot({
            target: "browser",
            annotateInteractive: true,
          });
          result = snap.screenshot;
        } else {
          result = await ctx.visionEngine.capture(
            args.target,
            args.format,
            args.fullPage
          );
        }

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
                  annotated: result.annotated ?? false,
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
                  filePath: result.filePath,
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
      title: "OmniPilot Inspect DOM & Set-of-Mark",
      description:
        "Extracts the semantic ARIA accessibility tree and interactive DOM elements with Set-of-Mark (markId) and bounding boxes.",
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
        "Deterministically clicks a DOM element by CSS selector or Set-of-Mark ID, performing pre-flight DOM safety inspection.",
      inputSchema: ClickElementInputSchema.shape,
    },
    async (args) => {
      const startTime = Date.now();
      const effectiveSelector = args.markId
        ? `[data-omnipilot-mark="${args.markId}"]`
        : args.selector;

      // Pre-Flight DOM Inspection to read actual button text, attributes, and bounding box
      const [hitElement, urlContext] = await Promise.all([
        ctx.browserDriver.inspectTargetSelector(effectiveSelector),
        ctx.browserDriver.getActiveUrl(),
      ]);

      const risk = ctx.riskEngine.evaluateAction({
        toolName: "omnipilot_click_element",
        params: { ...args, selector: effectiveSelector },
        urlContext,
        hitElement,
      });

      // Human-In-The-Loop gate check if escalated to Tier 3
      if (risk.requiresHITL) {
        let annotatedScreenshot: string | undefined = undefined;
        const targetBox = hitElement?.boundingBox;
        if (targetBox) {
          try {
            const cap = await ctx.visionEngine.capture("browser", "base64", false, [
              {
                box: targetBox,
                label: `🛑 TIER 3 HITL: ${hitElement?.text || effectiveSelector}`,
                color: "#ef4444",
              },
            ]);
            annotatedScreenshot = cap.data;
          } catch {
            // Non-blocking fallback
          }
        }

        const approval = await ctx.approvalGate.requestApproval(
          `Click on critical DOM element "${hitElement?.text || effectiveSelector}" (${risk.reason})`,
          risk.tier,
          targetBox,
          { selector: effectiveSelector, hitElement, risk },
          undefined,
          annotatedScreenshot
        );

        if (!approval.approved) {
          ctx.approvalGate.recordAuditLog({
            toolName: "omnipilot_click_element",
            params: { ...args, selector: effectiveSelector },
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
          effectiveSelector,
          args.waitForNavigation,
          hitElement?.text
        );

        ctx.approvalGate.recordAuditLog({
          toolName: "omnipilot_click_element",
          params: { ...args, selector: effectiveSelector },
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
          params: { ...args, selector: effectiveSelector },
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
              text: `Error clicking element "${effectiveSelector}": ${err.message}`,
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
        "Moves the cursor to (X, Y) coordinates and clicks, performing pre-flight DOM hit-testing on browser targets to prevent safety bypasses.",
      inputSchema: ClickCoordinateInputSchema.shape,
    },
    async (args) => {
      const startTime = Date.now();
      const target = args.target ?? "browser";

      // Pre-Flight Coordinate Hit-Testing inside browser
      let hitElement = null;
      let urlContext: string | undefined = undefined;
      if (target === "browser") {
        [hitElement, urlContext] = await Promise.all([
          ctx.browserDriver.inspectElementAtPoint(args.x, args.y),
          ctx.browserDriver.getActiveUrl(),
        ]);
      }

      const risk = ctx.riskEngine.evaluateAction({
        toolName: "omnipilot_click_coordinate",
        params: args,
        urlContext,
        hitElement,
      });

      if (risk.requiresHITL) {
        const targetBox = hitElement?.boundingBox || {
          x: Math.max(0, args.x - 40),
          y: Math.max(0, args.y - 20),
          width: 80,
          height: 40,
        };

        let annotatedScreenshot: string | undefined = undefined;
        try {
          const cap = await ctx.visionEngine.capture(target, "base64", false, [
            {
              box: targetBox,
              label: `🛑 TIER 3 HITL @ (${args.x}, ${args.y})`,
              color: "#ef4444",
            },
          ]);
          annotatedScreenshot = cap.data;
        } catch {
          // Non-blocking fallback
        }

        const approval = await ctx.approvalGate.requestApproval(
          `Coordinate click at (${args.x}, ${args.y}) hits critical target "${hitElement?.text || hitElement?.selector || "element"}" (${risk.reason})`,
          risk.tier,
          targetBox,
          { x: args.x, y: args.y, hitElement, risk },
          undefined,
          annotatedScreenshot
        );

        if (!approval.approved) {
          ctx.approvalGate.recordAuditLog({
            toolName: "omnipilot_click_coordinate",
            params: args,
            tier: risk.tier,
            requiresHITL: true,
            approvalStatus: "rejected",
            executionDurationMs: Date.now() - startTime,
            success: false,
            error: "Coordinate click blocked by HITL safety policy",
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  status: "rejected",
                  reason: "Coordinate click blocked by HITL safety policy",
                  details: risk.reason,
                  hitElement,
                }),
              },
            ],
            isError: true,
          };
        }
      }

      try {
        const result =
          target === "browser"
            ? await ctx.browserDriver.clickCoordinate(
                args.x,
                args.y,
                args.button,
                args.clickCount
              )
            : await ctx.desktopDriver.clickCoordinate(
                args.x,
                args.y,
                args.button,
                args.clickCount
              );

        ctx.approvalGate.recordAuditLog({
          toolName: "omnipilot_click_coordinate",
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
                action: "click_coordinate",
                target,
                result,
                hitElement,
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
          requiresHITL: risk.requiresHITL,
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
        "Types text or fills form inputs deterministically, checking form submission context when pressEnter is enabled.",
      inputSchema: TypeTextInputSchema.shape,
    },
    async (args) => {
      const startTime = Date.now();
      const effectiveSelector = args.markId
        ? `[data-omnipilot-mark="${args.markId}"]`
        : args.selector;

      const [hitElement, urlContext] = await Promise.all([
        effectiveSelector
          ? ctx.browserDriver.inspectTargetSelector(effectiveSelector)
          : Promise.resolve(null),
        ctx.browserDriver.getActiveUrl(),
      ]);

      const risk = ctx.riskEngine.evaluateAction({
        toolName: "omnipilot_type_text",
        params: { ...args, selector: effectiveSelector },
        urlContext,
        hitElement,
      });

      if (risk.requiresHITL) {
        const approval = await ctx.approvalGate.requestApproval(
          `Type sensitive text or submit critical form (${risk.reason})`,
          risk.tier,
          hitElement?.boundingBox,
          { isSecret: args.isSecret, selector: effectiveSelector, pressEnter: args.pressEnter }
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
                  details: risk.reason,
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
          effectiveSelector,
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
        "HITL Guardrail: Suspends execution, generates an annotated frame with a red bounding box on the target element, and awaits human confirmation.",
      inputSchema: RequestApprovalInputSchema.shape,
    },
    async (args) => {
      const startTime = Date.now();

      // Capture annotated visual frame with red bounding box
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
        args.contextDetails,
        undefined,
        annotatedFrame
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

  /**
   * Tool 7: omnipilot_execute_task (Autonomous Goal Runner)
   */
  server.registerTool(
    "omnipilot_execute_task",
    {
      title: "OmniPilot Execute Autonomous Task",
      description:
        "Executes a complete high-level instruction in natural language (e.g. 'Invia un'email di benvenuto a mariorossi@gmail.com') with automatic 3-Tier HITL protection.",
      inputSchema: ExecuteTaskInputSchema.shape,
    },
    async (args) => {
      try {
        const taskState = await ctx.agentRunner.executeTask(args.goal, args.language);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(taskState, null, 2),
            },
          ],
          isError: taskState.status === "failed" || taskState.status === "rejected",
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error executing autonomous task "${args.goal}": ${err.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
