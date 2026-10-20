export interface DomElementInfo {
  selector: string;
  tagName: string;
  text?: string;
  role?: string;
  name?: string;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  attributes?: Record<string, string>;
  isInteractive?: boolean;
}

export interface AccessibilityNode {
  role: string;
  name?: string;
  value?: string;
  description?: string;
  children?: AccessibilityNode[];
}

export interface BrowserDriverConfig {
  headless?: boolean;
  viewportWidth?: number;
  viewportHeight?: number;
}

export class BrowserDriver {
  private activeUrl: string = "about:blank";
  private isInitialized: boolean = false;

  constructor(private config: BrowserDriverConfig = { headless: true, viewportWidth: 1280, viewportHeight: 800 }) {}

  public async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  public async navigate(url: string): Promise<void> {
    this.activeUrl = url;
  }

  public async getActiveUrl(): Promise<string> {
    return this.activeUrl;
  }

  public async takeScreenshot(_fullPage: boolean = false): Promise<string> {
    // Phase 1: Return structured base64 dummy frame or canvas
    // Phase 2 will plug live Playwright page.screenshot()
    return Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
        <rect width="800" height="600" fill="#0f172a"/>
        <text x="400" y="300" fill="#38bdf8" font-family="sans-serif" font-size="24" text-anchor="middle">
          OmniPilot Browser Canvas (Viewport: ${this.config.viewportWidth}x${this.config.viewportHeight})
        </text>
      </svg>`
    ).toString("base64");
  }

  public async inspectDom(
    selector?: string,
    _includeAccessibility: boolean = true
  ): Promise<{ selector?: string; nodes: DomElementInfo[]; accessibilityTree?: AccessibilityNode }> {
    return {
      selector,
      nodes: [
        {
          selector: selector || "body",
          tagName: "BODY",
          text: "OmniPilot Mock DOM Ready",
          role: "document",
          isInteractive: false,
        },
      ],
      accessibilityTree: {
        role: "WebArea",
        name: "OmniPilot Canvas",
        children: [
          {
            role: "button",
            name: "Submit Order",
          },
        ],
      },
    };
  }

  public async clickElement(
    selector: string,
    _waitForNavigation: boolean = false
  ): Promise<{ clicked: boolean; selector: string }> {
    return { clicked: true, selector };
  }

  public async typeText(
    text: string,
    selector?: string,
    _pressEnter: boolean = false,
    _clearExisting: boolean = false
  ): Promise<{ typed: boolean; length: number; selector?: string }> {
    return { typed: true, length: text.length, selector };
  }

  public async close(): Promise<void> {
    this.isInitialized = false;
  }

  public getStatus(): { isInitialized: boolean; activeUrl: string; config: BrowserDriverConfig } {
    return {
      isInitialized: this.isInitialized,
      activeUrl: this.activeUrl,
      config: this.config,
    };
  }
}
