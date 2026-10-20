import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { BrowserDriver } from "../../src/execution/browserDriver.js";
import { DesktopDriver } from "../../src/execution/desktopDriver.js";
import { DomEngine } from "../../src/perception/domEngine.js";
import { VisionEngine } from "../../src/perception/visionEngine.js";
import { DualPerceptionEngine } from "../../src/perception/dualPerception.js";
import { VisualAnnotator } from "../../src/perception/visualAnnotator.js";

describe("DualPerceptionEngine (Vision + DOM Playwright Integration)", () => {
  let browserDriver: BrowserDriver;
  let desktopDriver: DesktopDriver;
  let domEngine: DomEngine;
  let visionEngine: VisionEngine;
  let dualEngine: DualPerceptionEngine;

  beforeAll(async () => {
    browserDriver = new BrowserDriver({ headless: true, viewportWidth: 1024, viewportHeight: 768 });
    desktopDriver = new DesktopDriver();
    domEngine = new DomEngine(browserDriver);
    visionEngine = new VisionEngine(browserDriver, desktopDriver);
    dualEngine = new DualPerceptionEngine(domEngine, visionEngine);

    await browserDriver.initialize();
  });

  afterAll(async () => {
    await browserDriver.close();
  });

  it("should navigate to HTML data URI and inspect interactive DOM elements", async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>OmniPilot Test</title></head>
        <body style="margin: 0; padding: 20px; font-family: sans-serif;">
          <h1>Order Management Portal</h1>
          <form id="order-form">
            <label for="customer">Customer Name:</label>
            <input type="text" id="customer" name="customer" placeholder="Acme Corp" style="display:block; margin: 10px 0; width: 300px; height: 35px;" />
            <button type="button" id="save-draft" style="width: 120px; height: 40px; margin-right: 10px;">Save Draft</button>
            <button type="submit" id="submit-order" style="width: 140px; height: 40px; background: red; color: white;">Submit Order</button>
          </form>
        </body>
      </html>
    `;

    const dataUri = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
    await browserDriver.navigate(dataUri);

    const inspection = await domEngine.inspect();
    expect(inspection.elements.length).toBeGreaterThan(0);

    const saveDraftBtn = inspection.elements.find((e) => e.selector === "#save-draft");
    expect(saveDraftBtn).toBeDefined();
    expect(saveDraftBtn?.isInteractive).toBe(true);
    expect(saveDraftBtn?.boundingBox).toBeDefined();
    expect(saveDraftBtn?.boundingBox?.width).toBeGreaterThan(0);

    const submitBtn = inspection.elements.find((e) => e.selector === "#submit-order");
    expect(submitBtn).toBeDefined();
    expect(submitBtn?.isInteractive).toBe(true);

    expect(inspection.accessibilityAria).toBeDefined();
  });

  it("should capture high-fidelity screenshot and generate visual annotations", async () => {
    const rawCapture = await visionEngine.capture("browser", "base64");
    expect(rawCapture.data).toBeDefined();
    expect(rawCapture.data.length).toBeGreaterThan(1000);

    // Annotate with red bounding box
    const annotatedBase64 = await VisualAnnotator.annotateImage(rawCapture.data, [
      {
        box: { x: 20, y: 100, width: 140, height: 40 },
        label: "TIER 3: SUBMIT ORDER",
        color: "#ef4444",
      },
    ]);

    expect(annotatedBase64).toBeDefined();
    expect(annotatedBase64.length).toBeGreaterThan(rawCapture.data.length);
  });

  it("should produce a unified DualPerception snapshot with grounded elements", async () => {
    const snapshot = await dualEngine.getSnapshot({ annotateInteractive: true });

    expect(snapshot.timestamp).toBeDefined();
    expect(snapshot.screenshot.annotated).toBe(true);
    expect(snapshot.groundedElements.length).toBeGreaterThan(0);

    const firstGrounded = snapshot.groundedElements[0];
    expect(firstGrounded?.centerCoordinate).toBeDefined();
    expect(typeof firstGrounded?.centerCoordinate?.x).toBe("number");
    expect(typeof firstGrounded?.centerCoordinate?.y).toBe("number");
  });

  it("should interactively type text and click elements deterministically", async () => {
    const typeResult = await browserDriver.typeText("OmniPilot Global Inc.", "#customer", false, true);
    expect(typeResult.typed).toBe(true);

    const clickResult = await browserDriver.clickElement("#save-draft");
    expect(clickResult.clicked).toBe(true);
    expect(clickResult.selector).toBe("#save-draft");
  });

  it("should find elements by query helper", async () => {
    const btn = await domEngine.findElement({ text: "Save Draft" });
    expect(btn).not.toBeNull();
    expect(btn?.selector).toBe("#save-draft");
  });
});
