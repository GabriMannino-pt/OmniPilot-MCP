import React from "react";

interface ApprovalRequest {
  id: string;
  timestamp: string;
  actionSummary: string;
  tier: number;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

interface ApprovalGateModalProps {
  approvals: ApprovalRequest[];
  onResolve: (id: string, approved: boolean) => void;
}

export const ApprovalGateModal: React.FC<ApprovalGateModalProps> = ({ approvals, onResolve }) => {
  if (!approvals || approvals.length === 0) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: "24px",
      right: "24px",
      zIndex: 1000,
      maxWidth: "460px",
      width: "100%",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
    }}>
      {approvals.map((req) => (
        <div
          key={req.id}
          style={{
            backgroundColor: "#1c1917",
            border: "2px solid #ef4444",
            borderRadius: "10px",
            padding: "18px",
            boxShadow: "0 10px 25px -5px rgba(239, 68, 68, 0.4)",
            animation: "slideUp 0.3s ease-out",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <span style={{ fontSize: "20px" }}>🛑</span>
            <div>
              <div style={{ fontSize: "14px", fontWeight: "bold", color: "#f87171" }}>
                BLOCCO HITL — AZIONE TIER 3 CRITICA
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                ID Richiesta: {req.id}
              </div>
            </div>
          </div>

          <p style={{ fontSize: "13px", color: "#f5f5f4", margin: "10px 0", lineHeight: 1.4 }}>
            {req.actionSummary}
          </p>

          {req.boundingBox && (
            <div style={{
              fontSize: "11px",
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              padding: "6px 10px",
              borderRadius: "4px",
              color: "#fca5a5",
              marginBottom: "14px",
            }}>
              🎯 Riquadro bersaglio: ({req.boundingBox.x}, {req.boundingBox.y}) [
              {req.boundingBox.width}x{req.boundingBox.height}px]
            </div>
          )}

          <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
            <button
              onClick={() => onResolve(req.id, true)}
              style={{
                flex: 1,
                backgroundColor: "#22c55e",
                color: "#ffffff",
                border: "none",
                padding: "10px 14px",
                borderRadius: "6px",
                fontWeight: "bold",
                fontSize: "13px",
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(34, 197, 94, 0.3)",
              }}
            >
              ✓ Conferma Esecuzione
            </button>

            <button
              onClick={() => onResolve(req.id, false)}
              style={{
                backgroundColor: "#44403c",
                color: "#d6d3d1",
                border: "none",
                padding: "10px 14px",
                borderRadius: "6px",
                fontWeight: "bold",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              ✕ Annulla
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
