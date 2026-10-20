import React, { useState } from "react";

interface AgentStep {
  id: string;
  index: number;
  title: string;
  description: string;
  tier: number;
  status: "pending" | "running" | "waiting_approval" | "completed" | "rejected" | "failed";
}

interface AgentTaskState {
  taskId: string;
  goal: string;
  language: "it" | "en";
  status: "idle" | "running" | "waiting_approval" | "completed" | "rejected" | "failed";
  steps: AgentStep[];
  currentStepIndex: number;
  resultSummary?: string;
  error?: string;
}

interface TaskCommandBarProps {
  lang: "it" | "en";
  currentTask: AgentTaskState | null;
  onExecuteTask: (goal: string) => void;
}

export const TaskCommandBar: React.FC<TaskCommandBarProps> = ({
  lang,
  currentTask,
  onExecuteTask,
}) => {
  const [goalInput, setGoalInput] = useState<string>(
    "Invia un'email di benvenuto a mariorossi@gmail.com"
  );

  const isRunning =
    currentTask?.status === "running" || currentTask?.status === "waiting_approval";

  const presets =
    lang === "it"
      ? [
          {
            icon: "✉️",
            label: "Email di benvenuto a mariorossi@gmail.com",
            value: "Invia un'email di benvenuto a mariorossi@gmail.com",
          },
          {
            icon: "🏦",
            label: "Bonifico 24.500€ fatture Cloud Matrix",
            value: "Estrai le fatture e invia il bonifico di 24.500€ a Cloud Matrix",
          },
          {
            icon: "🗑️",
            label: "Elimina record obsoleti database",
            value: "Elimina i record obsoleti dal database di produzione",
          },
        ]
      : [
          {
            icon: "✉️",
            label: "Welcome email to mariorossi@gmail.com",
            value: "Send a welcome email to mariorossi@gmail.com",
          },
          {
            icon: "🏦",
            label: "Wire €24,500 to Cloud Matrix",
            value: "Extract supplier invoices and wire €24,500 to Cloud Matrix",
          },
          {
            icon: "🗑️",
            label: "Delete obsolete DB records",
            value: "Delete obsolete records from production database",
          },
        ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalInput.trim() || isRunning) return;
    onExecuteTask(goalInput.trim());
  };

  const getStepBadge = (step: AgentStep) => {
    if (step.status === "completed") return { icon: "✅", color: "#22c55e" };
    if (step.status === "waiting_approval") return { icon: "🛑", color: "#ef4444" };
    if (step.status === "running") return { icon: "⚡", color: "#38bdf8" };
    if (step.status === "rejected" || step.status === "failed")
      return { icon: "✕", color: "#f87171" };
    return { icon: "⏳", color: "#64748b" };
  };

  return (
    <div
      style={{
        backgroundColor: "var(--bg-surface)",
        borderRadius: "12px",
        border: "1px solid var(--border-color)",
        padding: "20px",
        marginBottom: "24px",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.25)",
      }}
    >
      <div style={{ marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: "16px", fontWeight: "bold", color: "var(--text-main)" }}>
            🤖 {lang === "it" ? "Barra di Comando Esecutiva (Assegna un Compito)" : "Executive Command Bar (Assign a Task)"}
          </h2>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
            {lang === "it"
              ? "Scrivi cosa vuoi far fare all'agente: eseguirà da solo i passaggi sicuri (Tier 1-2) e ti chiederà conferma visiva per le azioni critiche (Tier 3)."
              : "Write your instruction: the agent will autonomously run safe steps (Tier 1-2) and request visual confirmation before critical actions (Tier 3)."}
          </p>
        </div>
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: "12px" }}>
        <input
          type="text"
          value={goalInput}
          onChange={(e) => setGoalInput(e.target.value)}
          placeholder={
            lang === "it"
              ? "Es: Invia un'email di benvenuto a mariorossi@gmail.com..."
              : "E.g., Send a welcome email to mariorossi@gmail.com..."
          }
          style={{
            flex: 1,
            padding: "12px 16px",
            borderRadius: "8px",
            border: "1px solid #475569",
            backgroundColor: "var(--bg-card)",
            color: "var(--text-main)",
            fontSize: "14px",
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={isRunning || !goalInput.trim()}
          style={{
            background: isRunning
              ? "#475569"
              : "linear-gradient(135deg, #0284c7, #38bdf8)",
            color: "#ffffff",
            border: "none",
            padding: "12px 24px",
            borderRadius: "8px",
            fontWeight: "bold",
            fontSize: "14px",
            cursor: isRunning ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
            boxShadow: isRunning ? "none" : "0 4px 12px rgba(56, 189, 248, 0.3)",
          }}
        >
          {isRunning
            ? lang === "it"
              ? "⏳ Esecuzione in corso..."
              : "⏳ Running Task..."
            : lang === "it"
            ? "▶ Esegui Compito"
            : "▶ Run Task"}
        </button>
      </form>

      {/* Quick Presets */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "12px", alignItems: "center" }}>
        <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600 }}>
          {lang === "it" ? "Esempi rapidi:" : "Quick presets:"}
        </span>
        {presets.map((p, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setGoalInput(p.value)}
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              color: "var(--text-main)",
              padding: "5px 10px",
              borderRadius: "16px",
              fontSize: "11px",
              cursor: "pointer",
            }}
          >
            {p.icon} {p.label}
          </button>
        ))}
      </div>

      {/* Live Execution Steps Timeline */}
      {currentTask && currentTask.steps.length > 0 && (
        <div
          style={{
            marginTop: "18px",
            paddingTop: "16px",
            borderTop: "1px solid var(--border-color)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontSize: "12px", fontWeight: "bold", color: "var(--primary)" }}>
              {lang === "it" ? "Stato Avanzamento Compito:" : "Task Execution Progress:"} "{currentTask.goal}"
            </span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: "bold",
                padding: "3px 10px",
                borderRadius: "12px",
                backgroundColor:
                  currentTask.status === "completed"
                    ? "rgba(34, 197, 94, 0.15)"
                    : currentTask.status === "waiting_approval"
                    ? "rgba(239, 68, 68, 0.2)"
                    : "rgba(56, 189, 248, 0.15)",
                color:
                  currentTask.status === "completed"
                    ? "#4ade80"
                    : currentTask.status === "waiting_approval"
                    ? "#f87171"
                    : "#38bdf8",
              }}
            >
              {currentTask.status.toUpperCase()}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
            {currentTask.steps.map((step) => {
              const badge = getStepBadge(step);
              return (
                <div
                  key={step.id}
                  style={{
                    backgroundColor: "var(--bg-card)",
                    border: `1px solid ${
                      step.status === "waiting_approval"
                        ? "#ef4444"
                        : step.status === "completed"
                        ? "rgba(34, 197, 94, 0.4)"
                        : "var(--border-color)"
                    }`,
                    borderRadius: "8px",
                    padding: "10px 12px",
                    fontSize: "12px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <span style={{ fontWeight: "bold", color: badge.color }}>
                      {badge.icon} {step.index + 1}. {step.title}
                    </span>
                    <span
                      style={{
                        fontSize: "9px",
                        padding: "1px 6px",
                        borderRadius: "8px",
                        backgroundColor:
                          step.tier === 3
                            ? "rgba(239, 68, 68, 0.2)"
                            : step.tier === 2
                            ? "rgba(245, 158, 11, 0.2)"
                            : "rgba(56, 189, 248, 0.2)",
                        color:
                          step.tier === 3
                            ? "#f87171"
                            : step.tier === 2
                            ? "#fbbf24"
                            : "#38bdf8",
                        fontWeight: "bold",
                      }}
                    >
                      T{step.tier}
                    </span>
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{step.description}</div>
                </div>
              );
            })}
          </div>

          {currentTask.resultSummary && (
            <div
              style={{
                marginTop: "12px",
                padding: "10px 14px",
                borderRadius: "8px",
                backgroundColor:
                  currentTask.status === "completed"
                    ? "rgba(34, 197, 94, 0.12)"
                    : "rgba(239, 68, 68, 0.12)",
                border: `1px solid ${
                  currentTask.status === "completed" ? "#22c55e" : "#ef4444"
                }`,
                color: currentTask.status === "completed" ? "#4ade80" : "#fca5a5",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              {currentTask.resultSummary}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
