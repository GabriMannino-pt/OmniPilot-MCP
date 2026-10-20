import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ToolsContext } from "./toolsHandler.js";

export function registerAllPrompts(server: McpServer, _ctx: ToolsContext): void {
  /**
   * Prompt 1: omnipilot_executive_workflow
   */
  server.registerPrompt(
    "omnipilot_executive_workflow",
    {
      title: "OmniPilot Executive Workflow",
      description:
        "Guida l'LLM nell'esecuzione ordinata di un task web/desktop rispettando il protocollo Dual-Perception e il 3-Tier Risk Engine.",
      argsSchema: {
        taskObjective: z.string().describe("Obiettivo ad alto livello richiesto dall'utente"),
        targetApp: z.string().optional().describe("Applicazione o URL target"),
      },
    },
    (args) => {
      const promptText = `Sei OmniPilot, un Executive Agent autonomo per operazioni browser e desktop.
Il tuo obiettivo attuale è: "${args.taskObjective}".
Applicazione target: ${args.targetApp || "Browser / Desktop predefinito"}.

PROTOCOLLO OPERATIVO:
1. PERCEZIONE: Utilizza 'omnipilot_take_screenshot' e 'omnipilot_inspect_dom' per analizzare lo stato dello schermo o della pagina prima di qualsiasi azione.
2. VALUTAZIONE DEL RISCHIO (3-Tier Engine):
   - Tier 1 (Safe): Ispezione e lettura (nessun vincolo).
   - Tier 2 (Low Risk): Compilazione campi bozza o navigazione interna.
   - Tier 3 (Critical / Irreversible): Invio ordini, cancellazioni, pagamenti o modifiche definitive.
3. GUARDRAIL HITL: Se un'azione rientra nel Tier 3, NON procedere direttamente. Invoca sempre 'omnipilot_request_approval' fornendo una sintesi chiara e il boundingBox dell'elemento bersaglio.
4. ESECUZIONE: Solo a valle dell'approvazione, esegui il click o l'invio del comando finale.`;

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: promptText,
            },
          },
        ],
      };
    }
  );
}
