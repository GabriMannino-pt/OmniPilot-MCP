import { useState, useEffect, useCallback } from "react";
import { Header } from "./components/Header.js";
import { TaskCommandBar } from "./components/TaskCommandBar.js";
import { LiveCanvas } from "./components/LiveCanvas.js";
import { ApprovalGateModal } from "./components/ApprovalGateModal.js";
import { AuditLogView } from "./components/AuditLogView.js";

export default function App() {
  const [lang, setLang] = useState<"it" | "en">("it");
  const [status, setStatus] = useState<any>(null);
  const [currentTask, setCurrentTask] = useState<any>(null);
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

      if (statusRes) {
        setStatus(statusRes);
        if (statusRes.currentTask) {
          setCurrentTask(statusRes.currentTask);
        }
      }
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
    const interval = setInterval(fetchData, 1500);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleExecuteTask = async (goal: string) => {
    try {
      const res = await fetch("/api/tasks/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, language: lang }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.task) setCurrentTask(data.task);
      }
      setTimeout(fetchData, 300);
    } catch (err) {
      console.error("Execute task error:", err);
    }
  };

  const handleResolveApproval = async (id: string, approved: boolean) => {
    try {
      await fetch(`/api/approvals/${id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved }),
      });
      setTimeout(fetchData, 250);
    } catch (err) {
      console.error("Resolve error:", err);
    }
  };

  // If a Tier 3 HITL approval is pending with an annotated red-box frame, display it prominently
  const activeScreenshot =
    approvals[0]?.annotatedScreenshot || snapshot?.screenshot?.data || null;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Header
        status={status}
        lang={lang}
        onToggleLang={() => setLang(lang === "it" ? "en" : "it")}
        onRefresh={fetchData}
        isRefreshing={isRefreshing}
      />

      <main
        style={{
          flex: 1,
          padding: "24px",
          maxWidth: "1600px",
          margin: "0 auto",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* Top Command Bar for Natural Language Instructions */}
        <TaskCommandBar
          lang={lang}
          currentTask={currentTask}
          onExecuteTask={handleExecuteTask}
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 0.8fr",
            gap: "24px",
          }}
        >
          {/* Left Column: Live Canvas */}
          <section>
            <LiveCanvas
              lang={lang}
              screenshotData={activeScreenshot}
              groundedElements={snapshot?.groundedElements || []}
              activeUrl={snapshot?.activeUrl}
              annotate={annotate}
              onToggleAnnotate={() => setAnnotate(!annotate)}
            />
          </section>

          {/* Right Column: Audit Logs */}
          <section style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <AuditLogView lang={lang} logs={auditLogs} />
          </section>
        </div>
      </main>

      <ApprovalGateModal
        lang={lang}
        approvals={approvals}
        onResolve={handleResolveApproval}
      />
    </div>
  );
}
