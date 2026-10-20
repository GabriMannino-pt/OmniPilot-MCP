import { BrowserDriver } from "../execution/browserDriver.js";
import { DesktopDriver } from "../execution/desktopDriver.js";
import { BoundingBox } from "../mcp/schemas.js";

export interface ScreenshotResult {
  target: "browser" | "desktop";
  format: "base64" | "path";
  data: string;
  timestamp: string;
  width?: number;
  height?: number;
}

export class VisionEngine {
  constructor(
    private browserDriver: BrowserDriver,
    private desktopDriver: DesktopDriver
  ) {}

  public async capture(
    target: "browser" | "desktop" = "browser",
    format: "base64" | "path" = "base64",
    fullPage: boolean = false
  ): Promise<ScreenshotResult> {
    const timestamp = new Date().toISOString();
    let base64Data: string;

    if (target === "browser") {
      base64Data = await this.browserDriver.takeScreenshot(fullPage);
    } else {
      base64Data = await this.desktopDriver.takeScreenshot();
    }

    return {
      target,
      format,
      data: base64Data,
      timestamp,
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
