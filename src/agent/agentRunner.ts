import { EventEmitter } from "node:events";
import { BrowserDriver } from "../execution/browserDriver.js";
import { DesktopDriver } from "../execution/desktopDriver.js";
import { DomEngine } from "../perception/domEngine.js";
import { VisionEngine } from "../perception/visionEngine.js";
import { DualPerceptionEngine } from "../perception/dualPerception.js";
import { RiskEngine } from "../safety/riskEngine.js";
import { ApprovalGate } from "../safety/approvalGate.js";
import { RiskTier } from "../mcp/schemas.js";

export interface AgentStep {
  id: string;
  index: number;
  title: string;
  description: string;
  tier: RiskTier;
  status: "pending" | "running" | "waiting_approval" | "completed" | "rejected" | "failed";
  timestamp?: string;
}

export interface AgentTaskState {
  taskId: string;
  goal: string;
  language: "it" | "en";
  status: "idle" | "running" | "waiting_approval" | "completed" | "rejected" | "failed";
  startedAt: string;
  completedAt?: string;
  steps: AgentStep[];
  currentStepIndex: number;
  resultSummary?: string;
  error?: string;
}

export class AgentRunner extends EventEmitter {
  private currentTask: AgentTaskState | null = null;
  private dualEngine: DualPerceptionEngine;

  constructor(
    private browserDriver: BrowserDriver,
    _desktopDriver: DesktopDriver,
    private domEngine: DomEngine,
    private visionEngine: VisionEngine,
    private riskEngine: RiskEngine,
    private approvalGate: ApprovalGate
  ) {
    super();
    this.dualEngine = new DualPerceptionEngine(this.domEngine, this.visionEngine);
  }

  public getCurrentTask(): AgentTaskState | null {
    return this.currentTask ? JSON.parse(JSON.stringify(this.currentTask)) : null;
  }

  public isTaskActive(): boolean {
    return (
      this.currentTask?.status === "running" ||
      this.currentTask?.status === "waiting_approval"
    );
  }

  /**
   * Executes a high-level natural language instruction autonomously
   * with full 3-Tier Risk Engine protection and visual HITL confirmation.
   */
  public async executeTask(
    goal: string,
    language: "it" | "en" = "it"
  ): Promise<AgentTaskState> {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const isEn = language === "en" || /\b(send|welcome|extract|delete|wire|invoice)\b/i.test(goal) && !/\b(invia|email|benvenuto|fattur|cancella|elimina)\b/i.test(goal);
    const lang: "it" | "en" = isEn ? "en" : language;

    this.currentTask = {
      taskId,
      goal,
      language: lang,
      status: "running",
      startedAt: new Date().toISOString(),
      steps: [],
      currentStepIndex: 0,
    };

    this.emit("task:updated", this.getCurrentTask());

    try {
      const lowerGoal = goal.toLowerCase();

      if (
        lowerGoal.includes("bonifico") ||
        lowerGoal.includes("fattur") ||
        lowerGoal.includes("wire") ||
        lowerGoal.includes("invoice") ||
        lowerGoal.includes("paga") ||
        lowerGoal.includes("pay")
      ) {
        await this.runErpPaymentWorkflow(goal, lang);
      } else if (
        lowerGoal.includes("cancella") ||
        lowerGoal.includes("elimina") ||
        lowerGoal.includes("delete") ||
        lowerGoal.includes("remove") ||
        lowerGoal.includes("database")
      ) {
        await this.runAdminDeleteWorkflow(goal, lang);
      } else {
        // Default & Email workflow (e.g. "Invia un'email di benvenuto a mariorossi@gmail.com")
        await this.runEmailWorkflow(goal, lang);
      }

      return this.getCurrentTask()!;
    } catch (err: any) {
      if (this.currentTask) {
        this.currentTask.status = "failed";
        this.currentTask.error = err.message;
        this.currentTask.completedAt = new Date().toISOString();
        this.emit("task:updated", this.getCurrentTask());
      }
      throw err;
    }
  }

  private setSteps(steps: Omit<AgentStep, "id" | "index" | "status">[]): void {
    if (!this.currentTask) return;
    this.currentTask.steps = steps.map((s, idx) => ({
      ...s,
      id: `step_${idx + 1}`,
      index: idx,
      status: "pending",
    }));
    this.emit("task:updated", this.getCurrentTask());
  }

  private updateStepStatus(
    index: number,
    status: AgentStep["status"],
    descriptionOverride?: string
  ): void {
    if (!this.currentTask || !this.currentTask.steps[index]) return;
    this.currentTask.currentStepIndex = index;
    const step = this.currentTask.steps[index]!;
    step.status = status;
    step.timestamp = new Date().toISOString();
    if (descriptionOverride) {
      step.description = descriptionOverride;
    }
    if (status === "waiting_approval") {
      this.currentTask.status = "waiting_approval";
    } else if (status === "running") {
      this.currentTask.status = "running";
    }
    this.emit("task:updated", this.getCurrentTask());
  }

  /**
   * WORKFLOW 1: Autonomous Email Composition & Guarded Dispatch
   * e.g. "Invia un'email di benvenuto a mariorossi@gmail.com"
   */
  private async runEmailWorkflow(goal: string, lang: "it" | "en"): Promise<void> {
    const emailMatch = goal.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const recipient = emailMatch ? emailMatch[0] : "mariorossi@gmail.com";
    const recipientName = recipient.split("@")[0]?.replace(/[._-]/g, " ") || "Mario Rossi";

    const isWelcome = /benvenut|welcome/i.test(goal);
    const subject =
      lang === "it"
        ? isWelcome
          ? `Benvenuto a bordo, ${recipientName}!`
          : `Comunicazione da OmniPilot per ${recipientName}`
        : isWelcome
        ? `Welcome aboard, ${recipientName}!`
        : `Message from OmniPilot for ${recipientName}`;

    const bodyText =
      lang === "it"
        ? `Ciao ${recipientName},\n\nTi diamo il benvenuto ufficiale! Il tuo profilo associato a ${recipient} è stato attivato con successo.\n\nObiettivo eseguito: "${goal}"\n\nUn cordiale saluto,\nOmniPilot Executive Agent`
        : `Hello ${recipientName},\n\nWelcome aboard! Your profile associated with ${recipient} is now active.\n\nExecuted goal: "${goal}"\n\nBest regards,\nOmniPilot Executive Agent`;

    this.setSteps(
      lang === "it"
        ? [
            {
              title: "Apertura Webmail & Analisi Dual-Perception",
              description: "Avvio client di posta e mappatura Set-of-Mark [1..5] degli elementi interattivi",
              tier: RiskTier.TIER_1_SAFE,
            },
            {
              title: `Compilazione Destinatario (${recipient}) e Oggetto`,
              description: `Inserimento automatico indirizzo ${recipient} e oggetto "${subject}"`,
              tier: RiskTier.TIER_2_LOW_RISK,
            },
            {
              title: "Scrittura Corpo Email e Salvataggio Bozza",
              description: "Digitazione del messaggio di benvenuto e salvataggio sicuro in bozze",
              tier: RiskTier.TIER_2_LOW_RISK,
            },
            {
              title: "Guardrail HITL: Verifica Invio Email Definitiva",
              description: `Blocco preventivo sul pulsante "Invia Email" verso ${recipient} (Tier 3 Critical)`,
              tier: RiskTier.TIER_3_CRITICAL,
            },
            {
              title: "Invio Definitivo e Registrazione Scatola Nera",
              description: "Trasmissione email autorizzata dall'operatore e aggiornamento Audit Log",
              tier: RiskTier.TIER_3_CRITICAL,
            },
          ]
        : [
            {
              title: "Open Webmail & Dual-Perception Scan",
              description: "Launching mail portal and mapping Set-of-Mark [1..5] interactive elements",
              tier: RiskTier.TIER_1_SAFE,
            },
            {
              title: `Fill Recipient (${recipient}) & Subject`,
              description: `Typing recipient ${recipient} and subject "${subject}"`,
              tier: RiskTier.TIER_2_LOW_RISK,
            },
            {
              title: "Compose Message Body & Save Draft",
              description: "Typing welcome message and saving recoverable draft",
              tier: RiskTier.TIER_2_LOW_RISK,
            },
            {
              title: "HITL Guardrail: Verify External Email Dispatch",
              description: `Pre-execution block on "Send Email" button to ${recipient} (Tier 3 Critical)`,
              tier: RiskTier.TIER_3_CRITICAL,
            },
            {
              title: "Final Dispatch & Black-Box Audit Logging",
              description: "Executing human-approved dispatch and recording compliance log",
              tier: RiskTier.TIER_3_CRITICAL,
            },
          ]
    );

    // --- STEP 1: Open Webmail & Dual-Perception ---
    this.updateStepStatus(0, "running");
    const webmailHtml = `
      <!DOCTYPE html>
      <html lang="${lang}">
        <head>
          <meta charset="utf-8">
          <title>OmniMail Enterprise Webmail</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
            .mail-window { max-width: 820px; margin: 0 auto; background: #1e293b; border-radius: 12px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.4); }
            .mail-header { background: #0284c7; padding: 14px 24px; display: flex; justify-content: space-between; align-items: center; }
            .mail-header h1 { font-size: 18px; margin: 0; color: white; }
            .status-pill { background: rgba(255,255,255,0.2); padding: 4px 10px; border-radius: 12px; font-size: 12px; color: white; font-weight: 600; }
            .mail-body { padding: 24px; }
            .field-row { margin-bottom: 16px; }
            label { display: block; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-bottom: 6px; font-weight: 600; }
            input, textarea { width: 100%; padding: 11px 14px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #f8fafc; font-size: 14px; box-sizing: border-box; font-family: inherit; }
            input:focus, textarea:focus { outline: none; border-color: #38bdf8; }
            .toolbar { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; padding-top: 16px; border-top: 1px solid #334155; }
            .btn-group { display: flex; gap: 12px; }
            button { padding: 10px 20px; border-radius: 8px; border: none; font-weight: 700; font-size: 14px; cursor: pointer; }
            .btn-draft { background: #334155; color: #e2e8f0; }
            .btn-send { background: #dc2626; color: #ffffff; }
            #banner { display: none; margin-bottom: 16px; padding: 12px 16px; border-radius: 8px; font-weight: 600; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="mail-window">
            <div class="mail-header">
              <h1>✉️ OmniMail Workspace — ${lang === "it" ? "Nuovo Messaggio" : "Compose Message"}</h1>
              <span class="status-pill" id="mail-state">${lang === "it" ? "Composizione" : "Composing"}</span>
            </div>
            <div class="mail-body">
              <div id="banner"></div>
              <form id="compose-form" onsubmit="return false;">
                <div class="field-row">
                  <label for="email-to">${lang === "it" ? "A (Destinatario)" : "To (Recipient)"}</label>
                  <input type="email" id="email-to" name="to" placeholder="nome@esempio.com" />
                </div>
                <div class="field-row">
                  <label for="email-subject">${lang === "it" ? "Oggetto" : "Subject"}</label>
                  <input type="text" id="email-subject" name="subject" placeholder="${lang === "it" ? "Inserisci oggetto..." : "Enter subject..."}" />
                </div>
                <div class="field-row">
                  <label for="email-body">${lang === "it" ? "Messaggio" : "Message Body"}</label>
                  <textarea id="email-body" name="body" rows="6" placeholder="${lang === "it" ? "Scrivi il contenuto dell'email..." : "Write email content..."}"></textarea>
                </div>
                <div class="toolbar">
                  <div style="font-size: 12px; color: #64748b;" id="draft-indicator">
                    ${lang === "it" ? "Pronto per la compilazione automatica" : "Ready for autonomous filling"}
                  </div>
                  <div class="btn-group">
                    <button type="button" id="btn-save-draft" class="btn-draft" onclick="
                      document.getElementById('draft-indicator').innerText = '📝 Bozza salvata / Draft saved';
                      document.getElementById('mail-state').innerText = 'Bozza / Draft';
                    ">${lang === "it" ? "Salva Bozza" : "Save Draft"}</button>
                    <button type="button" id="btn-send-email" class="btn-send" onclick="
                      const toVal = document.getElementById('email-to').value;
                      const b = document.getElementById('banner');
                      b.style.display = 'block';
                      b.style.background = 'rgba(34, 197, 94, 0.2)';
                      b.style.border = '1px solid #22c55e';
                      b.style.color = '#4ade80';
                      b.innerText = '✅ EMAIL INVIATA CON SUCCESSO A: ' + toVal;
                      document.getElementById('mail-state').innerText = 'Inviata / Sent';
                      document.getElementById('btn-send-email').disabled = true;
                      document.getElementById('btn-send-email').style.opacity = '0.5';
                    ">${lang === "it" ? "Invia Email" : "Send Email"}</button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </body>
      </html>
    `;

    await this.browserDriver.navigate(`data:text/html;charset=utf-8,${encodeURIComponent(webmailHtml)}`);
    await this.dualEngine.getSnapshot({ annotateInteractive: true });
    this.approvalGate.recordAuditLog({
      toolName: "omnipilot_navigate",
      params: { url: "omnimail://compose", goal },
      tier: RiskTier.TIER_1_SAFE,
      requiresHITL: false,
      success: true,
    });
    this.updateStepStatus(0, "completed");

    // --- STEP 2: Fill Recipient & Subject (Tier 2) ---
    this.updateStepStatus(1, "running");
    await this.browserDriver.typeText(recipient, "#email-to", false, true);
    this.approvalGate.recordAuditLog({
      toolName: "omnipilot_type_text",
      params: { selector: "#email-to", text: recipient },
      tier: RiskTier.TIER_2_LOW_RISK,
      requiresHITL: false,
      success: true,
    });

    await this.browserDriver.typeText(subject, "#email-subject", false, true);
    this.approvalGate.recordAuditLog({
      toolName: "omnipilot_type_text",
      params: { selector: "#email-subject", text: subject },
      tier: RiskTier.TIER_2_LOW_RISK,
      requiresHITL: false,
      success: true,
    });
    this.updateStepStatus(1, "completed");

    // --- STEP 3: Type Body & Save Draft (Tier 2) ---
    this.updateStepStatus(2, "running");
    await this.browserDriver.typeText(bodyText, "#email-body", false, true);
    await this.browserDriver.clickElement("#btn-save-draft");
    this.approvalGate.recordAuditLog({
      toolName: "omnipilot_click_element",
      params: { selector: "#btn-save-draft", note: "Draft saved" },
      tier: RiskTier.TIER_2_LOW_RISK,
      requiresHITL: false,
      success: true,
    });
    this.updateStepStatus(2, "completed");

    // --- STEP 4: Pre-Flight DOM Inspection & HITL Guardrail on #btn-send-email (Tier 3) ---
    this.updateStepStatus(3, "running");
    const hitSendBtn = await this.browserDriver.inspectTargetSelector("#btn-send-email");
    const riskEval = this.riskEngine.evaluateAction({
      toolName: "omnipilot_click_element",
      params: { selector: "#btn-send-email" },
      hitElement: hitSendBtn,
    });

    const targetBox = hitSendBtn?.boundingBox || { x: 640, y: 420, width: 140, height: 42 };
    const summaryText =
      lang === "it"
        ? `Invio definitivo email a "${recipient}" con oggetto "${subject}"`
        : `Final external email dispatch to "${recipient}" with subject "${subject}"`;

    // Capture live visual frame with red bounding box around the Send Email button
    const annotatedCapture = await this.visionEngine.capture("browser", "base64", false, [
      {
        box: targetBox,
        label: `🛑 TIER 3 HITL: ${lang === "it" ? "INVIA EMAIL" : "SEND EMAIL"} (${recipient})`,
        color: "#ef4444",
      },
    ]);

    this.updateStepStatus(3, "waiting_approval");
    const approval = await this.approvalGate.requestApproval(
      summaryText,
      RiskTier.TIER_3_CRITICAL,
      targetBox,
      { recipient, subject, riskReason: riskEval.reason },
      120000,
      annotatedCapture.data
    );

    if (!approval.approved) {
      this.updateStepStatus(3, "rejected");
      this.updateStepStatus(4, "rejected");
      this.approvalGate.recordAuditLog({
        toolName: "omnipilot_click_element",
        params: { selector: "#btn-send-email", recipient },
        tier: RiskTier.TIER_3_CRITICAL,
        requiresHITL: true,
        approvalStatus: "rejected",
        success: false,
        error: "Blocked by human operator via HITL Guardrail",
      });
      if (this.currentTask) {
        this.currentTask.status = "rejected";
        this.currentTask.completedAt = new Date().toISOString();
        this.currentTask.resultSummary =
          lang === "it"
            ? `🛑 Invio email a ${recipient} annullato dall'operatore. Il messaggio è rimasto salvato in Bozze.`
            : `🛑 Email dispatch to ${recipient} cancelled by operator. Message safely kept in Drafts.`;
        this.emit("task:updated", this.getCurrentTask());
      }
      return;
    }

    this.updateStepStatus(3, "completed");

    // --- STEP 5: Approved -> Click Send Email & Complete ---
    this.updateStepStatus(4, "running");
    await this.browserDriver.clickElement("#btn-send-email");
    this.approvalGate.recordAuditLog({
      toolName: "omnipilot_click_element",
      params: { selector: "#btn-send-email", recipient, subject },
      tier: RiskTier.TIER_3_CRITICAL,
      requiresHITL: true,
      approvalStatus: "approved",
      success: true,
    });
    this.updateStepStatus(4, "completed");

    if (this.currentTask) {
      this.currentTask.status = "completed";
      this.currentTask.completedAt = new Date().toISOString();
      this.currentTask.resultSummary =
        lang === "it"
          ? `✅ Compito completato! Email di benvenuto compilata, verificata tramite Guardrail HITL e inviata con successo a ${recipient}.`
          : `✅ Task completed! Welcome email composed, verified via HITL Guardrail, and dispatched to ${recipient}.`;
      this.emit("task:updated", this.getCurrentTask());
    }
  }

  /**
   * WORKFLOW 2: ERP Invoice Extraction & Guarded Wire Transfer
   */
  private async runErpPaymentWorkflow(goal: string, lang: "it" | "en"): Promise<void> {
    this.setSteps(
      lang === "it"
        ? [
            {
              title: "Accesso Portale ERP & Estrazione Fatture",
              description: "Lettura tabella contabile e mappatura Set-of-Mark",
              tier: RiskTier.TIER_1_SAFE,
            },
            {
              title: "Compilazione Mandato di Pagamento & Salvataggio Bozza",
              description: "Inserimento causale bonifico per Cloud Matrix Servers (€ 24.500,00)",
              tier: RiskTier.TIER_2_LOW_RISK,
            },
            {
              title: "Guardrail HITL: Autorizzazione Bonifico Bancario",
              description: "Blocco Tier 3 sul pulsante 'Invia Bonifico (€ 24.500,00)'",
              tier: RiskTier.TIER_3_CRITICAL,
            },
            {
              title: "Esecuzione Bonifico & Registrazione Audit",
              description: "Conferma operazione bancaria post-approvazione umana",
              tier: RiskTier.TIER_3_CRITICAL,
            },
          ]
        : [
            {
              title: "Open ERP Portal & Extract Invoices",
              description: "Scanning accounting table and Set-of-Mark elements",
              tier: RiskTier.TIER_1_SAFE,
            },
            {
              title: "Fill Wire Transfer Draft",
              description: "Entering payment details for Cloud Matrix Servers (€ 24,500.00)",
              tier: RiskTier.TIER_2_LOW_RISK,
            },
            {
              title: "HITL Guardrail: Authorize Bank Wire Transfer",
              description: "Tier 3 safety block on 'Send Wire Transfer (€ 24,500.00)'",
              tier: RiskTier.TIER_3_CRITICAL,
            },
            {
              title: "Execute Wire Transfer & Record Audit",
              description: "Completing bank transaction after human approval",
              tier: RiskTier.TIER_3_CRITICAL,
            },
          ]
    );

    this.updateStepStatus(0, "running");
    const erpHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 24px; margin: 0; }
            .box { max-width: 820px; margin: 0 auto; background: #1e293b; padding: 24px; border-radius: 12px; border: 1px solid #334155; }
            h1 { color: #38bdf8; font-size: 20px; margin-top: 0; }
            table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px; }
            th, td { padding: 10px; border-bottom: 1px solid #334155; text-align: left; }
            th { background: #0f172a; color: #38bdf8; }
            input { width: 100%; padding: 10px; margin-top: 8px; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: white; box-sizing: border-box; }
            .btns { display: flex; gap: 12px; margin-top: 18px; }
            button { padding: 10px 18px; border-radius: 6px; border: none; font-weight: bold; cursor: pointer; }
            #erp-banner { display: none; padding: 12px; margin-bottom: 12px; border-radius: 6px; background: rgba(34,197,94,0.2); border: 1px solid #22c55e; color: #4ade80; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="box">
            <h1>🏦 OmniPilot ERP — Liquidazione Fatture Fornitori</h1>
            <div id="erp-banner"></div>
            <table>
              <thead><tr><th>ID</th><th>Fornitore</th><th>Importo</th></tr></thead>
              <tbody>
                <tr><td>INV-2026-881</td><td>Cloud Matrix Servers</td><td>€ 18.500,00</td></tr>
                <tr><td>INV-2026-882</td><td>CyberShield Security SpA</td><td>€ 6.000,00</td></tr>
              </tbody>
            </table>
            <input id="wire-notes" placeholder="Causale bonifico..." />
            <div class="btns">
              <button id="btn-save-draft" style="background:#475569;color:white;">Salva Bozza</button>
              <button id="btn-invia-bonifico" style="background:#dc2626;color:white;" onclick="
                const b = document.getElementById('erp-banner');
                b.style.display = 'block';
                b.innerText = '✅ BONIFICO DI € 24.500,00 ESEGUITO CON SUCCESSO';
              ">Invia Bonifico (€ 24.500,00)</button>
            </div>
          </div>
        </body>
      </html>
    `;
    await this.browserDriver.navigate(`data:text/html;charset=utf-8,${encodeURIComponent(erpHtml)}`);
    await this.dualEngine.getSnapshot({ annotateInteractive: true });
    this.approvalGate.recordAuditLog({
      toolName: "omnipilot_navigate",
      params: { url: "omnipilot-erp://invoices", goal },
      tier: RiskTier.TIER_1_SAFE,
      requiresHITL: false,
      success: true,
    });
    this.updateStepStatus(0, "completed");

    this.updateStepStatus(1, "running");
    await this.browserDriver.typeText(`Saldo fatture INV-2026-881 e INV-2026-882 (${goal})`, "#wire-notes", false, true);
    await this.browserDriver.clickElement("#btn-save-draft");
    this.approvalGate.recordAuditLog({
      toolName: "omnipilot_type_text",
      params: { selector: "#wire-notes" },
      tier: RiskTier.TIER_2_LOW_RISK,
      requiresHITL: false,
      success: true,
    });
    this.updateStepStatus(1, "completed");

    this.updateStepStatus(2, "running");
    const hitWireBtn = await this.browserDriver.inspectTargetSelector("#btn-invia-bonifico");
    const targetBox = hitWireBtn?.boundingBox || { x: 180, y: 260, width: 240, height: 40 };
    const annotated = await this.visionEngine.capture("browser", "base64", false, [
      {
        box: targetBox,
        label: "🛑 TIER 3 HITL: BONIFICO € 24.500,00",
        color: "#ef4444",
      },
    ]);

    this.updateStepStatus(2, "waiting_approval");
    const approval = await this.approvalGate.requestApproval(
      "Disposizione Bonifico Bancario Irreversibile di € 24.500,00",
      RiskTier.TIER_3_CRITICAL,
      targetBox,
      { totalAmount: "€ 24.500,00" },
      120000,
      annotated.data
    );

    if (!approval.approved) {
      this.updateStepStatus(2, "rejected");
      this.updateStepStatus(3, "rejected");
      this.approvalGate.recordAuditLog({
        toolName: "omnipilot_click_element",
        params: { selector: "#btn-invia-bonifico" },
        tier: RiskTier.TIER_3_CRITICAL,
        requiresHITL: true,
        approvalStatus: "rejected",
        success: false,
        error: "Wire transfer rejected by human operator",
      });
      if (this.currentTask) {
        this.currentTask.status = "rejected";
        this.currentTask.completedAt = new Date().toISOString();
        this.currentTask.resultSummary = "🛑 Bonifico bloccato e annullato dall'operatore umano.";
        this.emit("task:updated", this.getCurrentTask());
      }
      return;
    }

    this.updateStepStatus(2, "completed");
    this.updateStepStatus(3, "running");
    await this.browserDriver.clickElement("#btn-invia-bonifico");
    this.approvalGate.recordAuditLog({
      toolName: "omnipilot_click_element",
      params: { selector: "#btn-invia-bonifico" },
      tier: RiskTier.TIER_3_CRITICAL,
      requiresHITL: true,
      approvalStatus: "approved",
      success: true,
    });
    this.updateStepStatus(3, "completed");

    if (this.currentTask) {
      this.currentTask.status = "completed";
      this.currentTask.completedAt = new Date().toISOString();
      this.currentTask.resultSummary = "✅ Fatture estratte e bonifico di € 24.500,00 eseguito dopo conferma HITL.";
      this.emit("task:updated", this.getCurrentTask());
    }
  }

  /**
   * WORKFLOW 3: Admin Database Cleanup with Tier 3 Guardrail
   */
  private async runAdminDeleteWorkflow(goal: string, lang: "it" | "en"): Promise<void> {
    this.setSteps([
      {
        title: lang === "it" ? "Ispezione Console Admin" : "Inspect Admin Console",
        description: lang === "it" ? "Individuazione record obsoleti" : "Locating obsolete records",
        tier: RiskTier.TIER_1_SAFE,
      },
      {
        title: lang === "it" ? "Guardrail HITL: Conferma Cancellazione" : "HITL Guardrail: Confirm Deletion",
        description: lang === "it" ? "Blocco Tier 3 su 'Elimina Record Database'" : "Tier 3 block on 'Delete Database Records'",
        tier: RiskTier.TIER_3_CRITICAL,
      },
      {
        title: lang === "it" ? "Esecuzione Pulizia Autorizzata" : "Execute Authorized Cleanup",
        description: lang === "it" ? "Rimozione record confermata" : "Confirmed record removal",
        tier: RiskTier.TIER_3_CRITICAL,
      },
    ]);

    this.updateStepStatus(0, "running");
    const adminHtml = `
      <!DOCTYPE html>
      <html>
        <body style="font-family:sans-serif;background:#0f172a;color:#f8fafc;padding:24px;">
          <div style="max-width:700px;margin:0 auto;background:#1e293b;padding:24px;border-radius:12px;border:1px solid #334155;">
            <h1 style="color:#f87171;">⚠️ Admin Cloud Database Console</h1>
            <p>Operazione richiesta: <strong>${goal.replace(/</g, "&lt;")}</strong></p>
            <div id="del-banner" style="display:none;padding:12px;background:rgba(34,197,94,0.2);border:1px solid #22c55e;color:#4ade80;border-radius:6px;margin-bottom:12px;"></div>
            <button id="btn-delete-records" style="padding:12px 20px;background:#dc2626;color:white;border:none;border-radius:6px;font-weight:bold;cursor:pointer;" onclick="
              const b = document.getElementById('del-banner');
              b.style.display = 'block';
              b.innerText = '✅ RECORD OBSOLETI ELIMINATI CON SUCCESSO';
            ">Elimina Definitivamente Record</button>
          </div>
        </body>
      </html>
    `;
    await this.browserDriver.navigate(`data:text/html;charset=utf-8,${encodeURIComponent(adminHtml)}`);
    await this.dualEngine.getSnapshot({ annotateInteractive: true });
    this.approvalGate.recordAuditLog({
      toolName: "omnipilot_navigate",
      params: { url: "omnipilot-admin://db-cleanup", goal },
      tier: RiskTier.TIER_1_SAFE,
      requiresHITL: false,
      success: true,
    });
    this.updateStepStatus(0, "completed");

    this.updateStepStatus(1, "running");
    const hitDelBtn = await this.browserDriver.inspectTargetSelector("#btn-delete-records");
    const targetBox = hitDelBtn?.boundingBox || { x: 80, y: 180, width: 260, height: 44 };
    const annotated = await this.visionEngine.capture("browser", "base64", false, [
      {
        box: targetBox,
        label: "🛑 TIER 3 HITL: DELETE RECORDS",
        color: "#ef4444",
      },
    ]);

    this.updateStepStatus(1, "waiting_approval");
    const approval = await this.approvalGate.requestApproval(
      `Cancellazione definitiva record database (${goal})`,
      RiskTier.TIER_3_CRITICAL,
      targetBox,
      { goal },
      120000,
      annotated.data
    );

    if (!approval.approved) {
      this.updateStepStatus(1, "rejected");
      this.updateStepStatus(2, "rejected");
      this.approvalGate.recordAuditLog({
        toolName: "omnipilot_click_element",
        params: { selector: "#btn-delete-records", goal },
        tier: RiskTier.TIER_3_CRITICAL,
        requiresHITL: true,
        approvalStatus: "rejected",
        success: false,
        error: "Database cleanup rejected by human operator",
      });
      if (this.currentTask) {
        this.currentTask.status = "rejected";
        this.currentTask.completedAt = new Date().toISOString();
        this.currentTask.resultSummary = "🛑 Cancellazione database bloccata dall'operatore.";
        this.emit("task:updated", this.getCurrentTask());
      }
      return;
    }

    this.updateStepStatus(1, "completed");
    this.updateStepStatus(2, "running");
    await this.browserDriver.clickElement("#btn-delete-records");
    this.approvalGate.recordAuditLog({
      toolName: "omnipilot_click_element",
      params: { selector: "#btn-delete-records", goal },
      tier: RiskTier.TIER_3_CRITICAL,
      requiresHITL: true,
      approvalStatus: "approved",
      success: true,
    });
    this.updateStepStatus(2, "completed");

    if (this.currentTask) {
      this.currentTask.status = "completed";
      this.currentTask.completedAt = new Date().toISOString();
      this.currentTask.resultSummary = "✅ Pulizia record completata dopo autorizzazione HITL.";
      this.emit("task:updated", this.getCurrentTask());
    }
  }
}
