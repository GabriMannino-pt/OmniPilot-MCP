import * as fs from "node:fs";
import * as path from "node:path";
import { BrowserDriver } from "../execution/browserDriver.js";
import { DesktopDriver } from "../execution/desktopDriver.js";
import { BoundingBox } from "../mcp/schemas.js";
import { VisualAnnotator, AnnotationItem } from "./visualAnnotator.js";

export interface ScreenshotResult {
  target: "browser" | "desktop";
  format: "base64" | "path";
  data: string;
  filePath?: string;
  timestamp: string;
  annotated?: boolean;
}

export class VisionEngine {
  constructor(
    private browserDriver: BrowserDriver,
    private desktopDriver: DesktopDriver
  ) {}

  public async capture(
    target: "browser" | "desktop" = "browser",
    format: "base64" | "path" = "base64",
    fullPage: boolean = false,
    annotations?: AnnotationItem[]
  ): Promise<ScreenshotResult> {
    const timestamp = new Date().toISOString();
    let base64Data: string;

    if (target === "browser") {
      base64Data = await this.browserDriver.takeScreenshot(fullPage);
    } else {
      base64Data = await this.desktopDriver.takeScreenshot();
    }

    if (annotations && annotations.length > 0) {
      base64Data = await VisualAnnotator.annotateImage(base64Data, annotations);
    }

    let savedFilePath: string | undefined = undefined;
    if (format === "path") {
      const screenshotsDir = path.resolve(process.cwd(), "screenshots");
      if (!fs.existsSync(screenshotsDir)) {
        fs.mkdirSync(screenshotsDir, { recursive: true });
      }
      const fileName = `omnipilot_${target}_${Date.now()}.png`;
      savedFilePath = path.join(screenshotsDir, fileName);
      fs.writeFileSync(savedFilePath, Buffer.from(base64Data, "base64"));
    }

    return {
      target,
      format,
      data: base64Data,
      filePath: savedFilePath,
      timestamp,
      annotated: Boolean(annotations && annotations.length > 0),
    };
  }

  /**
   * Helper to compute center coordinates of a bounding box
   */
  public getCenterCoordinate(box: BoundingBox): { x: number; y: number } {
    return {
      x: Math.round(box.x + box.width / 2),
      y: Math.round(box.y + box.height / 2),
    };
  }
}
