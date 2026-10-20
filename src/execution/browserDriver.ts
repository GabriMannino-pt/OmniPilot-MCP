import { chromium, Browser, BrowserContext, Page } from "playwright";
import { BoundingBox } from "../mcp/schemas.js";
import { HitTestedElement } from "../safety/riskEngine.js";

export interface DomElementInfo {
  selector: string;
  markId?: number;
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
  cdpEndpoint?: string;
}

export interface NetworkMutationEvent {
  timestamp: string;
  method: string;
  url: string;
  postData?: string;
}

export class BrowserDriver {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private activeUrl: string = "about:blank";
  private isInitialized: boolean = false;
  private config: BrowserDriverConfig;
  private networkMutations: NetworkMutationEvent[] = [];

  constructor(
    config: BrowserDriverConfig = {
      headless: true,
      viewportWidth: 1280,
      viewportHeight: 800,
    }
  ) {
    this.config = config;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized && this.page) {
      return;
    }

    if (this.config.cdpEndpoint) {
      this.browser = await chromium.connectOverCDP(this.config.cdpEndpoint);
      const contexts = this.browser.contexts();
      this.context = contexts[0] ?? (await this.browser.newContext());
      const pages = this.context.pages();
      this.page = pages[0] ?? (await this.context.newPage());
    } else {
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
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OmniPilot/0.2",
      });

      this.page = await this.context.newPage();
    }

    // Attach CDP/Network-Level Mutation Monitor
    this.page.on("request", (req) => {
      const method = req.method().toUpperCase();
      if (["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
        this.networkMutations.push({
          timestamp: new Date().toISOString(),
          method,
          url: req.url(),
          postData: req.postData() ?? undefined,
        });
      }
    });

    this.activeUrl = this.page.url();
    this.isInitialized = true;
  }

  private async ensurePage(): Promise<Page> {
    if (!this.isInitialized || !this.page) {
      await this.initialize();
    }
    return this.page!;
  }

  public async navigate(
    url: string,
    waitUntil: "domcontentloaded" | "load" | "networkidle" = "domcontentloaded"
  ): Promise<string> {
    const page = await this.ensurePage();
    await page.goto(url, { waitUntil, timeout: 30000 });
    this.activeUrl = page.url();
    return this.activeUrl;
  }

  public async getActiveUrl(): Promise<string> {
    if (!this.page) return this.activeUrl;
    this.activeUrl = this.page.url();
    return this.activeUrl;
  }

  public async takeScreenshot(fullPage: boolean = false): Promise<string> {
    const page = await this.ensurePage();
    const buffer = await page.screenshot({
      fullPage,
      type: "png",
    });
    return buffer.toString("base64");
  }

  /**
   * Inspects the DOM, assigns Set-of-Mark (SoM) IDs (`data-omnipilot-mark`)
   * to all interactive elements, and extracts the ARIA accessibility snapshot.
   */
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
        let markCounter = 1;

        const getUniqueSelector = (el, assignedMark) => {
          if (el.id) return "#" + el.id;
          if (assignedMark) return '[data-omnipilot-mark="' + assignedMark + '"]';
          const tag = el.tagName.toLowerCase();
          const className = el.className && typeof el.className === "string"
            ? "." + el.className.trim().split(/\\s+/).filter(Boolean).slice(0, 2).join(".")
            : "";
          if (el.parentElement) {
            const siblings = Array.from(el.parentElement.children).filter(c => c.tagName === el.tagName);
            if (siblings.length > 1) {
              const idx = siblings.indexOf(el) + 1;
              return tag + className + ":nth-of-type(" + idx + ")";
            }
          }
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
            let markId = undefined;
            if (isInteractive) {
              markId = markCounter++;
              el.setAttribute("data-omnipilot-mark", String(markId));
            }

            const attributes = {};
            for (let i = 0; i < el.attributes.length; i++) {
              const attr = el.attributes[i];
              if (attr && ["id", "name", "type", "role", "aria-label", "placeholder", "href", "data-omnipilot-mark"].includes(attr.name)) {
                attributes[attr.name] = attr.value;
              }
            }

            const rawVal = el.value !== undefined && el.value !== "" ? String(el.value) : "";
            const textContent = el.innerText || el.textContent || rawVal || "";
            const cleanText = textContent.trim().slice(0, 100);

            elements.push({
              selector: getUniqueSelector(el, markId),
              markId,
              tagName,
              text: cleanText,
              role: el.getAttribute("role") || (interactiveTags.has(tagName) ? tagName.toLowerCase() : undefined),
              name: el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.getAttribute("name") || cleanText || undefined,
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

  /**
   * Pre-Flight DOM Inspector: resolves the actual DOM element for a selector
   * BEFORE clicking or typing so RiskEngine inspects real text, attributes, and form context.
   */
  public async inspectTargetSelector(selector: string): Promise<HitTestedElement | null> {
    const page = await this.ensurePage();
    try {
      const info = await page.evaluate(
        `((sel) => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const rect = el.getBoundingClientRect();
          const form = el.closest("form");
          let formSubmitText = "";
          if (form) {
            const submitBtns = Array.from(form.querySelectorAll('button, input[type="submit"]'));
            formSubmitText = submitBtns.map(b => b.innerText || b.value || b.id || "").join(" ");
          }
          return {
            selector: el.id ? "#" + el.id : sel,
            tagName: el.tagName,
            text: (el.innerText || el.value || el.textContent || "").trim().slice(0, 120),
            name: el.getAttribute("aria-label") || el.getAttribute("name") || el.getAttribute("placeholder") || undefined,
            role: el.getAttribute("role") || el.tagName.toLowerCase(),
            type: el.getAttribute("type") || undefined,
            formSubmitText: formSubmitText.trim().slice(0, 120) || undefined,
            boundingBox: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            },
          };
        })(${JSON.stringify(selector)})`
      );
      return info as HitTestedElement | null;
    } catch {
      return null;
    }
  }

  /**
   * Pre-Flight Coordinate Hit-Testing: discovers the exact DOM element under (x, y)
   * using document.elementFromPoint(x, y) to prevent coordinate-based safety bypasses.
   */
  public async inspectElementAtPoint(x: number, y: number): Promise<HitTestedElement | null> {
    const page = await this.ensurePage();
    try {
      const info = await page.evaluate(
        `(({ px, py }) => {
          const rawEl = document.elementFromPoint(px, py);
          if (!rawEl) return null;
          const el = rawEl.closest('button, a, input, select, textarea, [role="button"], [onclick]') || rawEl;
          const rect = el.getBoundingClientRect();
          return {
            selector: el.id ? "#" + el.id : el.tagName.toLowerCase(),
            tagName: el.tagName,
            text: (el.innerText || el.value || el.textContent || "").trim().slice(0, 120),
            name: el.getAttribute("aria-label") || el.getAttribute("name") || undefined,
            role: el.getAttribute("role") || el.tagName.toLowerCase(),
            type: el.getAttribute("type") || undefined,
            boundingBox: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            },
          };
        })({ px: ${Number(x)}, py: ${Number(y)} })`
      );
      return info as HitTestedElement | null;
    } catch {
      return null;
    }
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

  public getNetworkMutations(): NetworkMutationEvent[] {
    return [...this.networkMutations];
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

  public getStatus(): {
    isInitialized: boolean;
    activeUrl: string;
    config: BrowserDriverConfig;
    networkMutationsRecorded: number;
  } {
    return {
      isInitialized: this.isInitialized,
      activeUrl: this.activeUrl,
      config: this.config,
      networkMutationsRecorded: this.networkMutations.length,
    };
  }
}
