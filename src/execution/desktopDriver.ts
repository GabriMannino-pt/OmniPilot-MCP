export interface DesktopDriverConfig {
  primaryDisplayWidth?: number;
  primaryDisplayHeight?: number;
}

export class DesktopDriver {
  private config: DesktopDriverConfig;

  constructor(config: DesktopDriverConfig = { primaryDisplayWidth: 1920, primaryDisplayHeight: 1080 }) {
    this.config = config;
  }

  public async takeScreenshot(): Promise<string> {
    // Phase 1: Return placeholder base64 desktop capture
    // Phase 2: Live desktop screenshot
    return Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">
        <rect width="1920" height="1080" fill="#1e293b"/>
        <text x="960" y="540" fill="#f8fafc" font-family="sans-serif" font-size="36" text-anchor="middle">
          OmniPilot Desktop Screen (${this.config.primaryDisplayWidth}x${this.config.primaryDisplayHeight})
        </text>
      </svg>`
    ).toString("base64");
  }

  public async clickCoordinate(
    x: number,
    y: number,
    button: "left" | "right" | "middle" = "left",
    clickCount: number = 1
  ): Promise<{ clicked: boolean; x: number; y: number; button: string; clickCount: number }> {
    return {
      clicked: true,
      x,
      y,
      button,
      clickCount,
    };
  }

  public getDisplayResolution(): { width: number; height: number } {
    return {
      width: this.config.primaryDisplayWidth ?? 1920,
      height: this.config.primaryDisplayHeight ?? 1080,
    };
  }
}
