import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { OmniPilotMcpServer } from "../../src/mcp/mcpServer.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

describe("OmniPilotMcpServer (JSON-RPC 2.0 Integration)", () => {
  let server: OmniPilotMcpServer;
  let client: Client;

  beforeEach(async () => {
    server = new OmniPilotMcpServer({ autoApprove: true });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    // Setup an active page with test elements for live interaction
    const html = `
      <!DOCTYPE html>
      <html>
        <body>
          <nav class="menu-item"><a href="#menu">Menu Link</a></nav>
          <input type="text" id="order_notes" placeholder="Notes"/>
          <button id="confirm">Confirm</button>
        </body>
      </html>
    `;
    await server.getContext().browserDriver.navigate(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  });

  afterEach(async () => {
    await client.close();
    await server.close();
  });

  it("should expose all 8 MCP tools with valid schemas", async () => {
    const response = await client.listTools();
    const toolNames = response.tools.map((t) => t.name);

    expect(toolNames).toContain("omnipilot_navigate");
    expect(toolNames).toContain("omnipilot_take_screenshot");
    expect(toolNames).toContain("omnipilot_inspect_dom");
    expect(toolNames).toContain("omnipilot_click_element");
    expect(toolNames).toContain("omnipilot_click_coordinate");
    expect(toolNames).toContain("omnipilot_type_text");
    expect(toolNames).toContain("omnipilot_request_approval");
    expect(toolNames).toContain("omnipilot_execute_task");
    expect(response.tools.length).toBe(8);
  });

  it("should execute omnipilot_navigate to load a page", async () => {
    const targetUri = "data:text/html;charset=utf-8,<h1>Navigated Page</h1>";
    const result = await client.callTool({
      name: "omnipilot_navigate",
      arguments: {
        url: targetUri,
      },
    });

    const textPart = (result.content as any[]).find((c) => c.type === "text");
    expect(textPart).toBeDefined();
    const parsed = JSON.parse(textPart.text);
    expect(parsed.status).toBe("success");
    expect(parsed.action).toBe("navigate");
  });

  it("should execute omnipilot_take_screenshot and return base64 image", async () => {
    const result = await client.callTool({
      name: "omnipilot_take_screenshot",
      arguments: {
        target: "browser",
        format: "base64",
      },
    });

    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);

    const imagePart = (result.content as any[]).find((c) => c.type === "image");
    expect(imagePart).toBeDefined();
    expect(imagePart.mimeType).toBe("image/png");
    expect(typeof imagePart.data).toBe("string");
  });

  it("should execute omnipilot_inspect_dom and return DOM/accessibility tree with Set-of-Mark IDs", async () => {
    const result = await client.callTool({
      name: "omnipilot_inspect_dom",
      arguments: {
        includeAccessibility: true,
      },
    });

    const textPart = (result.content as any[]).find((c) => c.type === "text");
    expect(textPart).toBeDefined();
    const parsed = JSON.parse(textPart.text);
    expect(parsed.status).toBe("success");
    expect(parsed.dom.elements).toBeDefined();
    expect(parsed.dom.accessibilityTree).toBeDefined();
  });

  it("should execute omnipilot_click_element successfully for safe elements", async () => {
    const result = await client.callTool({
      name: "omnipilot_click_element",
      arguments: {
        selector: "nav.menu-item",
      },
    });

    const textPart = (result.content as any[]).find((c) => c.type === "text");
    expect(textPart).toBeDefined();
    const parsed = JSON.parse(textPart.text);
    expect(parsed.status).toBe("success");
    expect(parsed.action).toBe("click_element");
  });

  it("should execute omnipilot_click_coordinate with custom coordinates", async () => {
    const result = await client.callTool({
      name: "omnipilot_click_coordinate",
      arguments: {
        x: 50,
        y: 20,
        button: "left",
      },
    });

    const textPart = (result.content as any[]).find((c) => c.type === "text");
    expect(textPart).toBeDefined();
    const parsed = JSON.parse(textPart.text);
    expect(parsed.status).toBe("success");
    expect(parsed.result.x).toBe(50);
    expect(parsed.result.y).toBe(20);
  });

  it("should execute omnipilot_type_text for input filling", async () => {
    const result = await client.callTool({
      name: "omnipilot_type_text",
      arguments: {
        selector: "#order_notes",
        text: "Urgent shipping required",
        pressEnter: false,
      },
    });

    const textPart = (result.content as any[]).find((c) => c.type === "text");
    expect(textPart).toBeDefined();
    const parsed = JSON.parse(textPart.text);
    expect(parsed.status).toBe("success");
    expect(parsed.result.length).toBe("Urgent shipping required".length);
  });

  it("should execute omnipilot_request_approval guardrail", async () => {
    const result = await client.callTool({
      name: "omnipilot_request_approval",
      arguments: {
        actionSummary: "Conferma bonifico bancario",
        tier: 3,
        boundingBox: { x: 100, y: 150, width: 80, height: 30 },
      },
    });

    const textPart = (result.content as any[]).find((c) => c.type === "text");
    expect(textPart).toBeDefined();
    const parsed = JSON.parse(textPart.text);
    expect(parsed.status).toBe("approved");
    expect(parsed.tier).toBe("TIER_3_CRITICAL");
  });

  it("should read omnipilot://status resource", async () => {
    const res = await client.readResource({ uri: "omnipilot://status" });
    expect(res.contents.length).toBeGreaterThan(0);
    const content = res.contents[0] as any;
    expect(content.uri).toBe("omnipilot://status");
    const json = JSON.parse(content.text);
    expect(json.name).toBe("omnipilot-mcp");
    expect(json.status).toBe("operational");
  });

  it("should read omnipilot://audit-log resource", async () => {
    const res = await client.readResource({ uri: "omnipilot://audit-log" });
    expect(res.contents.length).toBeGreaterThan(0);
    const content = res.contents[0] as any;
    expect(content.uri).toBe("omnipilot://audit-log");
    const json = JSON.parse(content.text);
    expect(Array.isArray(json)).toBe(true);
  });

  it("should list and get prompt templates", async () => {
    const prompts = await client.listPrompts();
    expect(prompts.prompts.length).toBeGreaterThan(0);

    const execPrompt = prompts.prompts.find((p) => p.name === "omnipilot_executive_workflow");
    expect(execPrompt).toBeDefined();

    const promptResult = await client.getPrompt({
      name: "omnipilot_executive_workflow",
      arguments: {
        taskObjective: "Genera fattura cliente",
        targetApp: "Gestionale ERP",
      },
    });

    expect(promptResult.messages.length).toBeGreaterThan(0);
    expect((promptResult.messages[0]?.content as any).text).toContain("Genera fattura cliente");
  });
});
