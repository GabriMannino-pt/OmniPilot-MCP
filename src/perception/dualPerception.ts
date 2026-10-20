import { DomEngine, DomInspectionResult } from "./domEngine.js";
import { VisionEngine, ScreenshotResult } from "./visionEngine.js";
import { DomElementInfo } from "../execution/browserDriver.js";
import { AnnotationItem } from "./visualAnnotator.js";
import { BoundingBox } from "../mcp/schemas.js";

export interface GroundedElement {
  id: string;
  markId: number;
  element: DomElementInfo;
  centerCoordinate?: { x: number; y: number };
}

export interface DualPerceptionSnapshot {
  timestamp: string;
  activeUrl: string;
  screenshot: ScreenshotResult;
  dom: DomInspectionResult;
  groundedElements: GroundedElement[];
  interactiveCount: number;
}

export class DualPerceptionEngine {
  constructor(
    private domEngine: DomEngine,
    private visionEngine: VisionEngine
  ) {}

  public async getSnapshot(options?: {
    target?: "browser" | "desktop";
    selector?: string;
    annotateInteractive?: boolean;
    highlightBox?: { box: BoundingBox; label: string; color?: string };
  }): Promise<DualPerceptionSnapshot> {
    const target = options?.target ?? "browser";

    // 1. Inspect DOM & inject Set-of-Mark IDs
    const dom = await this.domEngine.inspect(options?.selector);

    // 2. Prepare visual grounding for interactive elements
    const groundedElements: GroundedElement[] = [];
    const annotations: AnnotationItem[] = [];

    dom.elements.forEach((el, index) => {
      if (el.isInteractive && el.boundingBox) {
        const markId = el.markId ?? index + 1;
        const id = `el_${markId}`;
        groundedElements.push({
          id,
          markId,
          element: el,
          centerCoordinate: this.visionEngine.getCenterCoordinate(el.boundingBox),
        });

        if (options?.annotateInteractive) {
          const shortDesc = (el.text || el.name || "").slice(0, 16);
          annotations.push({
            box: el.boundingBox,
            label: `[${markId}] ${el.tagName}${shortDesc ? ` "${shortDesc}"` : ""}`,
            color: "#3b82f6", // Set-of-Mark Blue
          });
        }
      }
    });

    if (options?.highlightBox) {
      annotations.push({
        box: options.highlightBox.box,
        label: options.highlightBox.label,
        color: options.highlightBox.color || "#ef4444",
      });
    }

    // 3. Capture screenshot (optionally annotated)
    const screenshot = await this.visionEngine.capture(
      target,
      "base64",
      false,
      annotations.length > 0 ? annotations : undefined
    );

    return {
      timestamp: new Date().toISOString(),
      activeUrl: dom.activeUrl,
      screenshot,
      dom,
      groundedElements,
      interactiveCount: groundedElements.length,
    };
  }
}
