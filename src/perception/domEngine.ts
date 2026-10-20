import { BrowserDriver, DomElementInfo } from "../execution/browserDriver.js";

export interface DomInspectionResult {
  timestamp: string;
  activeUrl: string;
  selector?: string;
  elements: DomElementInfo[];
  accessibilityTree?: string;
  accessibilityAria?: string;
  interactiveCount: number;
  promptInjectionWarnings?: string[];
}

export class DomEngine {
  constructor(private browserDriver: BrowserDriver) {}

  public async inspect(
    selector?: string,
    includeAccessibility: boolean = true
  ): Promise<DomInspectionResult> {
    const raw = await this.browserDriver.inspectDom(selector, includeAccessibility);
    const activeUrl = await this.browserDriver.getActiveUrl();
    const interactiveCount = raw.nodes.filter((n) => n.isInteractive).length;

    return {
      timestamp: new Date().toISOString(),
      activeUrl,
      selector: raw.selector,
      elements: raw.nodes,
      accessibilityTree: raw.accessibilityAria,
      accessibilityAria: raw.accessibilityAria,
      interactiveCount,
      promptInjectionWarnings: raw.promptInjectionWarnings,
    };
  }

  /**
   * Find an interactive element by role, text, or selector.
   * Prioritizes interactive elements and specific tag matches over ancestor containers.
   */
  public async findElement(query: {
    role?: string;
    text?: string;
    selector?: string;
  }): Promise<DomElementInfo | null> {
    const inspection = await this.inspect();
    
    // Sort so interactive elements and elements with shorter text match first
    const sorted = [...inspection.elements].sort((a, b) => {
      if (a.isInteractive && !b.isInteractive) return -1;
      if (!a.isInteractive && b.isInteractive) return 1;
      return (a.text?.length || 0) - (b.text?.length || 0);
    });

    const match = sorted.find((el) => {
      if (query.selector && el.selector.toLowerCase() === query.selector.toLowerCase()) {
        return true;
      }
      if (query.role && el.role?.toLowerCase() === query.role.toLowerCase()) {
        if (!query.text) return true;
        return el.text?.toLowerCase().includes(query.text.toLowerCase()) ||
               el.name?.toLowerCase().includes(query.text.toLowerCase());
      }
      if (query.text) {
        return el.text?.toLowerCase().includes(query.text.toLowerCase()) ||
               el.name?.toLowerCase().includes(query.text.toLowerCase());
      }
      return false;
    });

    return match || null;
  }
}
