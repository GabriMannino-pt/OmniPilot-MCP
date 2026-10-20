import { DomEngine, DomInspectionResult } from "./domEngine.js";
import { VisionEngine, ScreenshotResult } from "./visionEngine.js";
import { DomElementInfo } from "../execution/browserDriver.js";
import { AnnotationItem } from "./visualAnnotator.js";

export interface GroundedElement {
  id: string;
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
  }): Promise<DualPerceptionSnapshot> {
    const target = options?.target ?? "browser";

    // 1. Inspect DOM
    const dom = await this.domEngine.inspect(options?.selector);

    // 2. Prepare visual grounding for interactive elements
    const groundedElements: GroundedElement[] = [];
    const annotations: AnnotationItem[] = [];

    dom.elements.forEach((el, index) => {
      if (el.isInteractive && el.boundingBox) {
        const id = `el_${index + 1}`;
        groundedElements.push({
          id,
          element: el,
          centerCoordinate: this.visionEngine.getCenterCoordinate(el.boundingBox),
        });

        if (options?.annotateInteractive) {
          annotations.push({
            box: el.boundingBox,
            label: `${id}: ${el.role || el.tagName} "${(el.text || el.name || '').slice(0, 15)}"`,
            color: "#3b82f6", // Blue for interactive elements
          });
        }
      }
    });

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
