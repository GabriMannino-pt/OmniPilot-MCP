import React from "react";

interface ApprovalRequest {
  id: string;
  timestamp: string;
  actionSummary: string;
  tier: number;
  boundingBox?: { x: number; y: number; width: number; height: number };
  annotatedScreenshot?: string;
}

interface ApprovalGateModalProps {
  lang: "it" | "en";
  approvals: ApprovalRequest[];
  onResolve: (id: string, approved: boolean) => void;
}

export const ApprovalGateModal: React.FC<ApprovalGateModalProps> = ({
  lang,
  approvals,
  onResolve,
}) => {
  if (!approvals || approvals.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: 1000,
        maxWidth: "520px",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      {approvals.map((req) => (
        <div
          key={req.id}
          style={{
            backgroundColor: "#1c1917",
            border: "2px solid #ef4444",
            borderRadius: "12px",
            padding: "20px",
            boxShadow: "0 15px 35px -5px rgba(239, 68, 68, 0.45)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <span style={{ fontSize: "22px" }}>🛑</span>
            <div>
              <div style={{ fontSize: "14px", fontWeight: "bold", color: "#f87171" }}>
                {lang === "it"
                  ? "GUARDRAIL HITL — RICHIESTA CONFERMA TIER 3"
                  : "HITL GUARDRAIL — TIER 3 APPROVAL REQUIRED"}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                ID: {req.id}
              </div>
            </div>
          </div>

          <p style={{ fontSize: "13px", color: "#f5f5f4", margin: "10px 0", lineHeight: 1.4, fontWeight: 600 }}>
            {req.actionSummary}
          </p>

          {req.annotatedScreenshot && (
            <div
              style={{
                marginBottom: "12px",
                borderRadius: "6px",
                overflow: "hidden",
                border: "1px solid #ef4444",
              }}
            >
              <img
                src={`data:image/png;base64,${req.annotatedScreenshot}`}
                alt="HITL Red Bounding Box Target"
                style={{ width: "100%", maxHeight: "190px", objectFit: "cover", display: "block" }}
              />
            </div>
          )}

          {req.boundingBox && (
            <div
              style={{
                fontSize: "11px",
                backgroundColor: "rgba(239, 68, 68, 0.12)",
                padding: "6px 10px",
                borderRadius: "4px",
                color: "#fca5a5",
                marginBottom: "14px",
              }}
            >
              🎯{" "}
              {lang === "it" ? "Coordinate Riquadro Rosso:" : "Red Box Target Coordinates:"} (
              {req.boundingBox.x}, {req.boundingBox.y}) [{req.boundingBox.width}x
              {req.boundingBox.height}px]
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
                padding: "11px 14px",
                borderRadius: "8px",
                fontWeight: "bold",
                fontSize: "13px",
                cursor: "pointer",
                boxShadow: "0 2px 10px rgba(34, 197, 94, 0.35)",
              }}
            >
              {lang === "it" ? "✓ Conferma Esecuzione" : "✓ Approve & Execute"}
            </button>

            <button
              onClick={() => onResolve(req.id, false)}
              style={{
                backgroundColor: "#44403c",
                color: "#d6d3d1",
                border: "none",
                padding: "11px 14px",
                borderRadius: "8px",
                fontWeight: "bold",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              {lang === "it" ? "✕ Blocca / Annulla" : "✕ Reject / Abort"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
