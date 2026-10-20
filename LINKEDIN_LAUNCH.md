# 🚀 Post LinkedIn di Annuncio — OmniPilot-MCP

*Bozza pronta per la pubblicazione su LinkedIn (a cura di Gabriele Mannino)*

---

Mentre il 95% del mercato continua a costruire wrapper di testo o semplici chatbot RAG, la vera frontiera dell'Intelligenza Artificiale nel 2026 si gioca su un altro livello: **Computer-Use e Agenti Autonomi con Interazione GUI**.

Oggi sono entusiasta di annunciare il rilascio open-source di **OmniPilot-MCP**: un Executive Agent cross-platform per operazioni browser e desktop basato sullo standard ufficiale **Model Context Protocol (MCP)**.

---

### 💡 Il Problema che Risolve
Far interagire un LLM con gestionali web, ERP o applicazioni desktop non è una questione di testo: richiede **percezione visiva**, **comprensione della struttura semantica** e, soprattutto, **garanzie deterministiche di sicurezza**.

Nessuna azienda può permettersi un agente che clicchi autonomamente su *"Invia Bonifico"* o *"Elimina Database"* a causa di un'allucinazione.

---

### 🏛️ L'Architettura di OmniPilot-MCP
Ho progettato OmniPilot attorno a 3 pilastri fondamentali:

1. **👁️ Dual-Perception Engine (Vision + DOM):**
   Non solo coordinate visive e non solo DOM grezzo. OmniPilot combina l'albero di accessibilità ARIA estrapolato da Playwright con coordinate visive in pixel (tramite bounding box overlay dinamici), garantendo che l'agente "veda" e "comprenda" lo schermo con precisione chirurgica.

2. **🛡️ 3-Tier Risk Engine:**
   Ogni azione pianificata viene classificata prima dell'esecuzione:
   - **Tier 1 (Safe):** Ispezione e lettura (nessun impatto, latenza zero).
   - **Tier 2 (Low Risk):** Compilazione campi, bozze e click interni (con log di audit).
   - **Tier 3 (Critical / Irreversible):** Pagamenti, cancellazioni, invio comunicazioni o credenziali.

3. **🛑 Human-in-the-Loop (HITL) Guardrail:**
   Se un'azione rientra nel Tier 3, l'agente blocca istantaneamente l'esecuzione, disegna un riquadro rosso ad alto contrasto attorno al pulsante bersaglio e attende la conferma esplicita dell'operatore umano (via CLI o tramite la **Web Dashboard in React 19 / Vite**).

---

### 📦 Stack Tecnologico & Standard
- Node.js 22+ / TypeScript 5.7 Strict Mode
- Model Context Protocol SDK (standard 2024-11-05) con integrazione immediata in Claude Desktop e Cursor
- Headless Chromium con Playwright
- Image compositing ad alte prestazioni con Sharp
- Web Control Cockpit in React 19 + Vite
- Test suite completa (32 test unitari ed E2E) con Vitest

---

📂 Il progetto è disponibile open-source su GitHub:
🔗 [https://github.com/GabriMannino-pt/OmniPilot-MCP](https://github.com/GabriMannino-pt/OmniPilot-MCP)

Un ringraziamento a chiunque vorrà provarlo, lasciare una ⭐ su GitHub o condividere feedback architettonico!

#AI #MachineLearning #ComputerUse #ModelContextProtocol #Playwright #TypeScript #AgenticAI #OpenSource #SoftwareArchitecture
