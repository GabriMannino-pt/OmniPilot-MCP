import { chromium, Browser, BrowserContext, Page } from "playwright";
import { BoundingBox } from "../mcp/schemas.js";

export interface DomElementInfo {
  selector: string;
  tagName: string;
  text?: string;
  role?: string;
  name?: string;
  boundingBox?: BoundingBox;
  attributes?: Record<string, string>;
  isInteractive?: boolean;
}

export interface AccessibilitySnapshot {
  rawYaml?: string;
  summary?: string;
}

export interface BrowserDriverConfig {
  headless?: boolean;
  viewportWidth?: number;
  viewportHeight?: number;
}

export class BrowserDriver {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private activeUrl: string = "about:blank";
  private isInitialized: boolean = false;
  private config: BrowserDriverConfig;

  constructor(config: BrowserDriverConfig = { headless: true, viewportWidth: 1280, viewportHeight: 800 }) {
    this.config = config;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized && this.page) {
      return;
    }

    this.browser = await chromium.launch({
      headless: this.config.headless ?? true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    this.context = await this.browser.newContext({
      viewport: {
        width: this.config.viewportWidth ?? 1280,
        height: this.config.viewportHeight ?? 800,
      },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OmniPilot/0.1",
    });

    this.page = await this.context.newPage();
    this.activeUrl = this.page.url();
    this.isInitialized = true;
  }

  private async ensurePage(): Promise<Page> {
    if (!this.isInitialized || !this.page) {
      await this.initialize();
    }
    return this.page!;
  }

  public async navigate(url: string): Promise<string> {
    const page = await this.ensurePage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    this.activeUrl = page.url();
    return this.activeUrl;
  }

  public async getActiveUrl(): Promise<string> {
    if (!this.page) return this.activeUrl;
    return this.page.url();
  }

  public async takeScreenshot(fullPage: boolean = false): Promise<string> {
    const page = await this.ensurePage();
    const buffer = await page.screenshot({
      fullPage,
      type: "png",
    });
    return buffer.toString("base64");
  }

  public async inspectDom(
    selector?: string,
    includeAccessibility: boolean = true
  ): Promise<{
    selector?: string;
    nodes: DomElementInfo[];
    accessibilityAria?: string;
  }> {
    const page = await this.ensurePage();

    let accessibilityAria: string | undefined = undefined;
    if (includeAccessibility) {
      try {
        const rootLocator = selector ? page.locator(selector) : page.locator(":root");
        accessibilityAria = await rootLocator.ariaSnapshot();
      } catch (err: any) {
        accessibilityAria = `[ARIA Snapshot Warning: ${err.message}]`;
      }
    }

    const nodes: DomElementInfo[] = await page.evaluate(
      `(({ targetSelector }) => {
        const root = targetSelector ? document.querySelector(targetSelector) : document.body;
        if (!root) return [];

        const interactiveTags = new Set(["BUTTON", "A", "INPUT", "SELECT", "TEXTAREA"]);
        const elements = [];
        const allCandidates = root.querySelectorAll("*");

        const getSelector = (el) => {
          if (el.id) return "#" + el.id;
          const tag = el.tagName.toLowerCase();
          const className = el.className && typeof el.className === "string"
            ? "." + el.className.trim().split(/\\s+/).slice(0, 2).join(".")
            : "";
          return tag + className;
        };

        const candidateList = [root, ...Array.from(allCandidates)];

        for (const el of candidateList) {
          const tagName = el.tagName;
          const isInteractive =
            interactiveTags.has(tagName) ||
            el.hasAttribute("onclick") ||
            el.getAttribute("role") === "button" ||
            el.getAttribute("role") === "link" ||
            el.getAttribute("tabindex") === "0";

          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            const attributes = {};
            for (let i = 0; i < el.attributes.length; i++) {
              const attr = el.attributes[i];
              if (attr && ["id", "name", "type", "role", "aria-label", "placeholder", "href"].includes(attr.name)) {
                attributes[attr.name] = attr.value;
              }
            }

            const textContent = el.innerText || el.textContent || "";
            const cleanText = textContent.trim().slice(0, 100);

            elements.push({
              selector: getSelector(el),
              tagName,
              text: cleanText,
              role: el.getAttribute("role") || (interactiveTags.has(tagName) ? tagName.toLowerCase() : undefined),
              name: el.getAttribute("aria-label") || el.getAttribute("name") || cleanText || undefined,
              boundingBox: {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
              },
              attributes,
              isInteractive,
            });
          }
        }

        return elements;
      })({ targetSelector: ${JSON.stringify(selector || null)} })`
    );

    return {
      selector,
      nodes,
      accessibilityAria,
    };
  }

  public async clickElement(
    selector: string,
    waitForNavigation: boolean = false
  ): Promise<{ clicked: boolean; selector: string; finalUrl: string }> {
    const page = await this.ensurePage();
    const locator = page.locator(selector).first();
    await locator.waitFor({ state: "visible", timeout: 8000 });

    if (waitForNavigation) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: "load", timeout: 10000 }).catch(() => {}),
        locator.click({ timeout: 5000 }),
      ]);
    } else {
      await locator.click({ timeout: 5000 });
    }

    this.activeUrl = page.url();
    return {
      clicked: true,
      selector,
      finalUrl: this.activeUrl,
    };
  }

  public async clickCoordinate(
    x: number,
    y: number,
    button: "left" | "right" | "middle" = "left",
    clickCount: number = 1
  ): Promise<{ clicked: boolean; x: number; y: number; button: string; clickCount: number }> {
    const page = await this.ensurePage();
    await page.mouse.click(x, y, { button, clickCount });
    return {
      clicked: true,
      x,
      y,
      button,
      clickCount,
    };
  }

  public async typeText(
    text: string,
    selector?: string,
    pressEnter: boolean = false,
    clearExisting: boolean = false
  ): Promise<{ typed: boolean; length: number; selector?: string }> {
    const page = await this.ensurePage();

    if (selector) {
      const locator = page.locator(selector).first();
      await locator.waitFor({ state: "visible", timeout: 5000 });
      if (clearExisting) {
        await locator.fill("");
      }
      await locator.fill(text);
    } else {
      await page.keyboard.type(text);
    }

    if (pressEnter) {
      await page.keyboard.press("Enter");
    }

    return {
      typed: true,
      length: text.length,
      selector,
    };
  }

  public async getPage(): Promise<Page> {
    return this.ensurePage();
  }

  public async close(): Promise<void> {
    if (this.page) {
      await this.page.close().catch(() => {});
      this.page = null;
    }
    if (this.context) {
      await this.context.close().catch(() => {});
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
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
