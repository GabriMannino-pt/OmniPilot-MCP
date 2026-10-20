import React, { useState } from "react";

interface LiveCanvasProps {
  lang: "it" | "en";
  screenshotData: string | null;
  groundedElements: any[];
  activeUrl?: string;
  annotate: boolean;
  onToggleAnnotate: () => void;
}

export const LiveCanvas: React.FC<LiveCanvasProps> = ({
  lang,
  screenshotData,
  groundedElements,
  activeUrl,
  annotate,
  onToggleAnnotate,
}) => {
  const [selectedElement, setSelectedElement] = useState<any | null>(null);

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
            👁️ {lang === "it" ? "Vista in Diretta (Dual-Perception + Set-of-Mark)" : "Live Canvas (Dual-Perception + Set-of-Mark)"}
          </h2>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
            {lang === "it" ? "Sessione Attiva:" : "Active Session:"}{" "}
            <code style={{ color: "var(--primary)" }}>
              {activeUrl?.startsWith("data:") ? "OmniPilot Interactive Workspace" : activeUrl || "about:blank"}
            </code>
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <label
            style={{
              fontSize: "13px",
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={annotate}
              onChange={onToggleAnnotate}
              style={{ accentColor: "var(--primary)" }}
            />
            {lang === "it"
              ? `Mostra Badge Set-of-Mark (${groundedElements.length})`
              : `Show Set-of-Mark Badges (${groundedElements.length})`}
          </label>
        </div>
      </div>

      {/* Frame Container */}
      <div
        style={{
          position: "relative",
          width: "100%",
          backgroundColor: "#020617",
          borderRadius: "8px",
          overflow: "hidden",
          border: "1px solid #1e293b",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "420px",
        }}
      >
        {screenshotData ? (
          <img
            src={`data:image/png;base64,${screenshotData}`}
            alt="OmniPilot Live Canvas"
            style={{
              width: "100%",
              height: "auto",
              maxHeight: "560px",
              objectFit: "contain",
              display: "block",
            }}
          />
        ) : (
          <div style={{ color: "var(--text-muted)", fontSize: "14px" }}>
            {lang === "it" ? "Caricamento flusso visivo..." : "Loading visual stream..."}
          </div>
        )}
      </div>

      {/* Interactive elements quick list */}
      {groundedElements.length > 0 && (
        <div style={{ marginTop: "4px" }}>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "8px", fontWeight: 600 }}>
            {lang === "it"
              ? `Tabella Simboli Set-of-Mark (${groundedElements.length} elementi interattivi):`
              : `Set-of-Mark Symbol Table (${groundedElements.length} interactive elements):`}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {groundedElements.slice(0, 10).map((g) => (
              <button
                key={g.id}
                onClick={() => setSelectedElement(g)}
                style={{
                  backgroundColor:
                    selectedElement?.id === g.id ? "rgba(56, 189, 248, 0.2)" : "var(--bg-card)",
                  border: `1px solid ${
                    selectedElement?.id === g.id ? "var(--primary)" : "var(--border-color)"
                  }`,
                  color: selectedElement?.id === g.id ? "var(--primary)" : "var(--text-main)",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  fontSize: "11px",
                  cursor: "pointer",
                }}
              >
                <strong>[{g.markId ?? g.id}]:</strong> {g.element.tagName}{" "}
                {g.element.text || g.element.name
                  ? `"${(g.element.text || g.element.name).slice(0, 16)}"`
                  : ""}
              </button>
            ))}
          </div>

          {selectedElement && (
            <div
              style={{
                marginTop: "10px",
                padding: "10px 14px",
                backgroundColor: "var(--bg-card)",
                borderRadius: "6px",
                border: "1px solid var(--border-color)",
                fontSize: "12px",
              }}
            >
              <span style={{ color: "var(--primary)", fontWeight: "bold" }}>
                [{selectedElement.markId ?? selectedElement.id}]:{" "}
              </span>
              <span>
                Selector: <code>{selectedElement.element.selector}</code> |{" "}
              </span>
              <span>
                XY:{" "}
                <code>
                  ({selectedElement.centerCoordinate?.x}, {selectedElement.centerCoordinate?.y})
                </code>{" "}
                |{" "}
              </span>
              <span>
                Box:{" "}
                <code>
                  {selectedElement.element.boundingBox?.width}x
                  {selectedElement.element.boundingBox?.height}px
                </code>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
