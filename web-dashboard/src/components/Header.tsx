import React from "react";

interface HeaderProps {
  status: any;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const Header: React.FC<HeaderProps> = ({ status, onRefresh, isRefreshing }) => {
  return (
    <header style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "16px 24px",
      backgroundColor: "var(--bg-surface)",
      borderBottom: "1px solid var(--border-color)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{
          width: "36px",
          height: "36px",
          borderRadius: "8px",
          background: "linear-gradient(135deg, #0284c7, #38bdf8)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "20px",
        }}>
          🚀
        </div>
        <div>
          <h1 style={{ fontSize: "18px", fontWeight: "bold", color: "var(--text-main)", margin: 0 }}>
            OmniPilot-MCP
          </h1>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>
            Executive Dual-Perception Cockpit • Protocol 2024-11-05
          </p>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          backgroundColor: "rgba(34, 197, 94, 0.1)",
          border: "1px solid rgba(34, 197, 94, 0.3)",
          padding: "6px 12px",
          borderRadius: "20px",
          fontSize: "13px",
          color: "var(--accent-green)",
          fontWeight: 600,
        }}>
          <span style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            backgroundColor: "var(--accent-green)",
            boxShadow: "0 0 8px var(--accent-green)",
          }} />
          {status?.status === "operational" ? "CORE ONLINE" : "CONNECTING..."}
        </div>

        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          style={{
            backgroundColor: "var(--bg-card)",
            color: "var(--text-main)",
            border: "1px solid var(--border-color)",
            padding: "8px 14px",
            borderRadius: "6px",
            cursor: isRefreshing ? "wait" : "pointer",
            fontSize: "13px",
            fontWeight: 500,
            transition: "all 0.2s",
          }}
        >
          {isRefreshing ? "Aggiornamento..." : "🔄 Aggiorna Canvas"}
        </button>
      </div>
    </header>
  );
};
