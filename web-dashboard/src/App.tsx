import { useState, useEffect, useCallback } from "react";
import { Header } from "./components/Header.js";
import { LiveCanvas } from "./components/LiveCanvas.js";
import { ApprovalGateModal } from "./components/ApprovalGateModal.js";
import { AuditLogView } from "./components/AuditLogView.js";

export default function App() {
  const [status, setStatus] = useState<any>(null);
  const [snapshot, setSnapshot] = useState<any>(null);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [annotate, setAnnotate] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const fetchData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [statusRes, snapRes, appRes, logsRes] = await Promise.all([
        fetch("/api/status").then((r) => (r.ok ? r.json() : null)),
        fetch(`/api/screenshot?annotate=${annotate}`).then((r) => (r.ok ? r.json() : null)),
        fetch("/api/approvals").then((r) => (r.ok ? r.json() : { approvals: [] })),
        fetch("/api/audit-logs").then((r) => (r.ok ? r.json() : { auditLogs: [] })),
      ]);

      if (statusRes) setStatus(statusRes);
      if (snapRes?.snapshot) setSnapshot(snapRes.snapshot);
      if (appRes?.approvals) setApprovals(appRes.approvals);
      if (logsRes?.auditLogs) setAuditLogs(logsRes.auditLogs);
    } catch (err) {
      console.warn("Fetch dashboard error:", err);
    } finally {
      setIsRefreshing(false);
    }
  }, [annotate]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleResolveApproval = async (id: string, approved: boolean) => {
    try {
      await fetch(`/api/approvals/${id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved }),
      });
      fetchData();
    } catch (err) {
      console.error("Resolve error:", err);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Header
        status={status}
        onRefresh={fetchData}
        isRefreshing={isRefreshing}
      />

      <main style={{
        flex: 1,
        padding: "24px",
        display: "grid",
        gridTemplateColumns: "1.2fr 0.8fr",
        gap: "24px",
        maxWidth: "1600px",
        margin: "0 auto",
        width: "100%",
        boxSizing: "border-box",
      }}>
        {/* Left Column: Live Canvas */}
        <section>
          <LiveCanvas
            screenshotData={snapshot?.screenshot?.data || null}
            groundedElements={snapshot?.groundedElements || []}
            activeUrl={snapshot?.activeUrl}
            annotate={annotate}
            onToggleAnnotate={() => setAnnotate(!annotate)}
          />
        </section>

        {/* Right Column: Audit Logs & Controls */}
        <section style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <AuditLogView logs={auditLogs} />
        </section>
      </main>

      <ApprovalGateModal
        approvals={approvals}
        onResolve={handleResolveApproval}
      />
    </div>
  );
}
