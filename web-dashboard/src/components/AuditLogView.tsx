import React, { useState } from "react";

interface AuditLogEntry {
  id: string;
  timestamp: string;
  toolName: string;
  params: Record<string, any>;
  tier: number;
  requiresHITL: boolean;
  approvalStatus?: string;
  executionDurationMs?: number;
  success: boolean;
  error?: string;
}

interface AuditLogViewProps {
  lang: "it" | "en";
  logs: AuditLogEntry[];
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ lang, logs }) => {
  const [filterTier, setFilterTier] = useState<number | "all">("all");

  const filteredLogs = logs.filter((l) => (filterTier === "all" ? true : l.tier === filterTier));

  const getTierBadge = (tier: number) => {
    switch (tier) {
      case 1:
        return {
          label: lang === "it" ? "TIER 1 (LETTURA)" : "TIER 1 (SAFE)",
          bg: "rgba(56, 189, 248, 0.15)",
          text: "#38bdf8",
          border: "rgba(56, 189, 248, 0.3)",
        };
      case 2:
        return {
          label: lang === "it" ? "TIER 2 (BOZZA)" : "TIER 2 (LOW RISK)",
          bg: "rgba(245, 158, 11, 0.15)",
          text: "#fbbf24",
          border: "rgba(245, 158, 11, 0.3)",
        };
      case 3:
        return {
          label: lang === "it" ? "TIER 3 (CRITICO)" : "TIER 3 (CRITICAL)",
          bg: "rgba(239, 68, 68, 0.15)",
          text: "#f87171",
          border: "rgba(239, 68, 68, 0.3)",
        };
      default:
        return { label: `TIER ${tier}`, bg: "#334155", text: "#f8fafc", border: "#475569" };
    }
  };

  return (
    <div
      style={{
        backgroundColor: "var(--bg-surface)",
        borderRadius: "12px",
        border: "1px solid var(--border-color)",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: "16px", fontWeight: "bold", color: "var(--text-main)" }}>
            📜 {lang === "it" ? "Scatola Nera (Audit Trail & HITL)" : "Black-Box Audit Trail & HITL"}
          </h2>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
            {lang === "it"
              ? "Registro cronologico di ogni decisione del motore di sicurezza"
              : "Chronological ledger of every safety engine decision"}
          </p>
        </div>

        <div style={{ display: "flex", gap: "6px" }}>
          {(["all", 1, 2, 3] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilterTier(t)}
              style={{
                backgroundColor: filterTier === t ? "var(--primary)" : "var(--bg-card)",
                color: filterTier === t ? "#0b1120" : "var(--text-muted)",
                border: "1px solid var(--border-color)",
                padding: "4px 10px",
                borderRadius: "4px",
                fontSize: "11px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {t === "all" ? (lang === "it" ? "Tutti" : "All") : `Tier ${t}`}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          overflowX: "auto",
          maxHeight: "460px",
          overflowY: "auto",
          borderRadius: "6px",
          border: "1px solid #1e293b",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
          <thead>
            <tr style={{ backgroundColor: "#0f172a", textAlign: "left", color: "var(--text-muted)" }}>
              <th style={{ padding: "10px 12px", borderBottom: "1px solid var(--border-color)" }}>
                {lang === "it" ? "Ora" : "Time"}
              </th>
              <th style={{ padding: "10px 12px", borderBottom: "1px solid var(--border-color)" }}>
                {lang === "it" ? "Strumento" : "Tool"}
              </th>
              <th style={{ padding: "10px 12px", borderBottom: "1px solid var(--border-color)" }}>
                {lang === "it" ? "Rischio" : "Risk Tier"}
              </th>
              <th style={{ padding: "10px 12px", borderBottom: "1px solid var(--border-color)" }}>
                {lang === "it" ? "Esito HITL" : "HITL Status"}
              </th>
              <th style={{ padding: "10px 12px", borderBottom: "1px solid var(--border-color)" }}>
                {lang === "it" ? "Dettagli" : "Details"}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>
                  {lang === "it" ? "Nessun evento registrato." : "No audit events recorded yet."}
                </td>
              </tr>
            ) : (
              filteredLogs
                .slice()
                .reverse()
                .map((log) => {
                  const badge = getTierBadge(log.tier);
                  return (
                    <tr key={log.id} style={{ borderBottom: "1px solid #1e293b" }}>
                      <td style={{ padding: "8px 12px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                      <td style={{ padding: "8px 12px", fontWeight: 600, color: "var(--text-main)" }}>
                        <code>{log.toolName.replace("omnipilot_", "")}</code>
                      </td>
                      <td style={{ padding: "8px 12px" }}>
                        <span
                          style={{
                            backgroundColor: badge.bg,
                            color: badge.text,
                            border: `1px solid ${badge.border}`,
                            padding: "2px 8px",
                            borderRadius: "12px",
                            fontSize: "10px",
                            fontWeight: "bold",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
                        {log.approvalStatus === "approved" ? (
                          <span style={{ color: "var(--accent-green)", fontWeight: 600 }}>
                            {lang === "it" ? "✓ Approvato" : "✓ Approved"}
                          </span>
                        ) : log.approvalStatus === "rejected" ? (
                          <span style={{ color: "var(--accent-red)", fontWeight: 600 }}>
                            {lang === "it" ? "✕ Respinto" : "✕ Rejected"}
                          </span>
                        ) : log.requiresHITL ? (
                          <span style={{ color: "var(--accent-amber)", fontWeight: 600 }}>
                            {lang === "it" ? "⏳ In Attesa" : "⏳ Pending"}
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>Auto (Safe)</span>
                        )}
                      </td>
                      <td style={{ padding: "8px 12px", color: "var(--text-muted)" }}>
                        {log.params.selector ||
                          log.params.actionSummary ||
                          log.params.url ||
                          JSON.stringify(log.params).slice(0, 42)}
                      </td>
                    </tr>
                  );
                })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
