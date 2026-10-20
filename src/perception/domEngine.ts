import { BrowserDriver, DomElementInfo, AccessibilityNode } from "../execution/browserDriver.js";

export interface DomInspectionResult {
  timestamp: string;
  selector?: string;
  elements: DomElementInfo[];
  accessibilityTree?: AccessibilityNode;
}

export class DomEngine {
  constructor(private browserDriver: BrowserDriver) {}

  public async inspect(
    selector?: string,
    includeAccessibility: boolean = true
  ): Promise<DomInspectionResult> {
    const raw = await this.browserDriver.inspectDom(selector, includeAccessibility);
    return {
      timestamp: new Date().toISOString(),
      selector: raw.selector,
      elements: raw.nodes,
      accessibilityTree: raw.accessibilityTree,
    };
  }
}
