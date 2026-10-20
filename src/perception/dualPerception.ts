import { DomEngine, DomInspectionResult } from "./domEngine.js";
import { VisionEngine, ScreenshotResult } from "./visionEngine.js";

export interface DualPerceptionSnapshot {
  timestamp: string;
  screenshot: ScreenshotResult;
  dom: DomInspectionResult;
  interactiveElementsCount: number;
}

export class DualPerceptionEngine {
  constructor(
    private domEngine: DomEngine,
    private visionEngine: VisionEngine
  ) {}

  public async getSnapshot(options?: {
    target?: "browser" | "desktop";
    selector?: string;
  }): Promise<DualPerceptionSnapshot> {
    const target = options?.target ?? "browser";
    const [screenshot, dom] = await Promise.all([
      this.visionEngine.capture(target, "base64"),
      this.domEngine.inspect(options?.selector),
    ]);

    const interactiveCount = dom.elements.filter((e) => e.isInteractive).length;

    return {
      timestamp: new Date().toISOString(),
      screenshot,
      dom,
      interactiveElementsCount: interactiveCount,
    };
  }
}
