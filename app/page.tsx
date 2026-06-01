"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Download, Edit3, RefreshCcw, Save, Send, Upload, X } from "lucide-react";
import { defaultProjectState, type ProjectState } from "@/lib/jarvis";

type Message = {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
};

const APP_VERSION = "v1.8";

function makeInitialMessage(): Message {
  return {
    role: "assistant",
    content: `Hello. What are we building?

Tell me in plain language. I will turn the conversation into mission, risks, decisions, and the next action automatically.`,
    timestamp: new Date().toISOString()
  };
}

const starters = [
  "What should we do next?",
  "Are we drifting from the goal?",
  "Should we add team features now?",
  "Create a handover for this project."
];

type FieldState = "Unknown" | "Initial" | "Partial" | "Defined" | "Validated";

function fieldStateFromText(value: string, neutralValues: string[] = []): FieldState {
  const clean = value.trim().toLowerCase();
  if (!clean || neutralValues.includes(clean)) return "Unknown";
  if (clean.includes("unknown") || clean.includes("not established") || clean.includes("not initialized")) return "Unknown";
  if (clean.includes("low") || clean.includes("uncertain") || clean.includes("needs verification") || clean.includes("unverified")) return "Initial";
  if (clean.includes("medium") || clean.includes("prototype") || clean.includes("watch") || clean.includes("reported")) return "Partial";
  if (clean.includes("validated") || clean.includes("verified")) return "Validated";
  if (clean.length > 20) return "Defined";
  return "Initial";
}

function fieldStateFromList(items: string[]): FieldState {
  if (!items.length) return "Unknown";
  if (items.length <= 2) return "Partial";
  return "Defined";
}

// StateDot — the only color in the minimal design
function StateDot({ state }: { state: FieldState }) {
  const color =
    state === "Validated" ? "bg-blue-500"
    : state === "Defined" ? "bg-emerald-500"
    : state === "Partial" ? "bg-amber-400"
    : state === "Initial" ? "bg-rose-400"
    : "bg-gray-300";
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${color}`} />;
}

// CollapsibleSection — sidebar panel with collapse toggle and summary when closed
function CollapsibleSection({
  title,
  summary,
  defaultOpen = false,
  children,
  action
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-200 py-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 text-left"
      >
        {open
          ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />}
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">{title}</span>
        {!open && summary && (
          <span className="ml-auto truncate text-xs text-gray-400">{summary}</span>
        )}
        {open && action && <span className="ml-auto">{action}</span>}
      </button>
      {open && <div className="mt-3 space-y-2">{children}</div>}
    </div>
  );
}

// TextField for edit mode
function TextField({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</div>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full resize-none rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm leading-6 text-gray-800 outline-none transition focus:border-gray-400"
      />
    </label>
  );
}

// SidebarField — dot + label + state + value
function SidebarField({ label, value, state }: { label: string; value: string; state: FieldState }) {
  const isEmpty = !value || value.trim().length === 0;
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1.5">
        <StateDot state={state} />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">{label}</span>
        <span className="ml-auto text-[10px] text-gray-300">{state}</span>
      </div>
      <p className={`pl-3.5 text-sm leading-5 ${isEmpty ? "italic text-gray-300" : "text-gray-700"}`}>
        {isEmpty ? "—" : value}
      </p>
    </div>
  );
}

// SidebarList — dot + items for risks/decisions
function SidebarList({ items, state, emptyText }: { items: string[]; state: FieldState; emptyText: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <StateDot state={state} />
        <span className="text-[10px] text-gray-300">{state}</span>
      </div>
      {items.length === 0
        ? <p className="pl-3.5 text-xs italic text-gray-300">{emptyText}</p>
        : items.map((item, i) => (
            <div key={i} className="flex items-start gap-2 pl-3.5">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gray-400" />
              <span className="text-sm leading-5 text-gray-700">{item}</span>
            </div>
          ))
      }
    </div>
  );
}

// MinimalThinkingIndicator — blinking cursor + elapsed, no color
function MinimalThinkingIndicator({ label }: { label: string }) {
  const [seconds, setSeconds] = useState(0);
  const [blink, setBlink] = useState(true);

  useEffect(() => {
    const ticker = setInterval(() => setSeconds((s) => s + 1), 1000);
    const blinker = setInterval(() => setBlink((b) => !b), 530);
    return () => { clearInterval(ticker); clearInterval(blinker); };
  }, []);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const elapsed = mins > 0 ? `${mins}:${String(secs).padStart(2, "0")}` : `0:${String(secs).padStart(2, "0")}`;

  return (
    <div className="flex items-baseline gap-2 py-1 pl-1 text-sm text-gray-500">
      <span>{label}</span>
      <span className={`font-mono text-xs transition-opacity duration-100 ${blink ? "opacity-100" : "opacity-0"}`}>▌</span>
      <span className="font-mono text-xs text-gray-400">{elapsed}</span>
      {seconds >= 10 && <span className="text-xs text-gray-400">Bear with me.</span>}
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (isNaN(diff)) return "";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatAbsoluteTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

function MessageTimestamp({ iso }: { iso: string }) {
  if (!iso) return null;
  return (
    <span className="ml-auto flex items-center gap-1 text-[11px] text-gray-300 font-normal">
      <span>{formatAbsoluteTime(iso)}</span>
      <span className="text-gray-200">·</span>
      <span>{formatRelativeTime(iso)}</span>
    </span>
  );
}

export default function Home() {
  const [project, setProject] = useState<ProjectState>(defaultProjectState);
  const [draftProject, setDraftProject] = useState<ProjectState>(defaultProjectState);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<Message[]>(() => [makeInitialMessage()]);
  const [betaPassword, setBetaPassword] = useState("");
  const [exportBaseName, setExportBaseName] = useState("jarvis-project");
  const [loading, setLoading] = useState(false);
  const [orientationLoading, setOrientationLoading] = useState(false);
  const [error, setError] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [lastStateUpdate, setLastStateUpdate] = useState("No project initialized yet");
  const [confirmAction, setConfirmAction] = useState<null | "clearChat" | "resetProject">(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  async function fetchOrientation(loadedProject: ProjectState, loadedBetaPassword: string) {
    if (!loadedProject.mission) return;
    setOrientationLoading(true);
    try {
      const response = await fetch("/api/orient", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project: loadedProject, betaPassword: loadedBetaPassword })
      });
      const data = await response.json();
      if (data.orientation) {
        setHistory((h) => [...h, { role: "assistant", content: data.orientation, timestamp: new Date().toISOString() }]);
        setProject((p) => ({ ...p, orientationCount: p.orientationCount + 1, lastOrientationAt: new Date().toISOString() }));
      }
    } catch {
      // non-fatal
    } finally {
      setOrientationLoading(false);
    }
  }

  useEffect(() => {
    const saved = localStorage.getItem("jarvis-project-state-v13");
    const savedHistory = localStorage.getItem("jarvis-history-v13");
    const savedPassword = localStorage.getItem("jarvis-beta-password-v02");
    const savedExportBaseName = localStorage.getItem("jarvis-export-base-name-v12");
    if (savedExportBaseName) setExportBaseName(savedExportBaseName);
    const loadedPassword = savedPassword || "";
    if (savedPassword) setBetaPassword(loadedPassword);
    if (saved) {
      const parsed = JSON.parse(saved);
      setProject(parsed);
      setDraftProject(parsed);
      if (!savedHistory && parsed.mission) fetchOrientation(parsed, loadedPassword);
    }
    if (savedHistory) {
      const parsedHistory: Message[] = JSON.parse(savedHistory);
      setHistory(parsedHistory);
      if (parsedHistory.length > 1) {
        const last = parsedHistory[parsedHistory.length - 1];
        if (last.timestamp) {
          const ageHours = (Date.now() - new Date(last.timestamp).getTime()) / (1000 * 60 * 60);
          if (ageHours >= 8) {
            const savedProject = saved ? JSON.parse(saved) : null;
            if (savedProject?.mission) fetchOrientation(savedProject, loadedPassword);
          }
        }
      }
    }
  }, []);

  useEffect(() => { localStorage.setItem("jarvis-project-state-v13", JSON.stringify(project)); }, [project]);
  useEffect(() => { localStorage.setItem("jarvis-history-v13", JSON.stringify(history)); }, [history]);
  useEffect(() => { localStorage.setItem("jarvis-beta-password-v02", betaPassword); }, [betaPassword]);
  useEffect(() => { localStorage.setItem("jarvis-export-base-name-v12", exportBaseName); }, [exportBaseName]);
  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [history, loading, error]);

  const fieldStates = useMemo(() => ({
    mission: fieldStateFromText(project.mission),
    nextAction: fieldStateFromText(project.nextAction, ["start by telling jarvis what you are building."]),
    status: fieldStateFromText(project.status),
    confidence: fieldStateFromText(project.confidence),
    approval: fieldStateFromText(project.approval),
    risks: fieldStateFromList(project.risks),
    decisions: fieldStateFromList(project.decisions)
  }), [project]);

  const projectHealth = useMemo(() => {
    if (project.progress === 0) return "Uninitialized";
    if (project.risks.length >= 3) return "Watch";
    if (project.confidence.toLowerCase().includes("low")) return "Uncertain";
    return "Stable";
  }, [project]);

  function updateDraftArrayField(field: "risks" | "decisions", text: string) {
    setDraftProject((p) => ({ ...p, [field]: text.split("\n").map((x) => x.trim()).filter(Boolean) }));
  }

  function saveManualState() { setProject(draftProject); setEditMode(false); setLastStateUpdate("Manually corrected"); }
  function cancelManualState() { setDraftProject(project); setEditMode(false); }

  function clearChat() {
    setHistory([makeInitialMessage()]); setMessage(""); setError("");
    localStorage.removeItem("jarvis-history-v13"); setConfirmAction(null);
  }

  function resetProject() {
    setProject(defaultProjectState); setDraftProject(defaultProjectState);
    setHistory([makeInitialMessage()]); setMessage(""); setError("");
    setLastStateUpdate("No project initialized yet");
    localStorage.removeItem("jarvis-project-state-v13");
    localStorage.removeItem("jarvis-history-v13");
    setConfirmAction(null);
  }

  function downloadText(filename: string, content: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = filename;
    document.body.appendChild(link); link.click(); link.remove();
    URL.revokeObjectURL(url);
  }

  function projectStateMarkdown(state: ProjectState) {
    return `# PROJECT_STATE\n\nGenerated by Jarvis.\n\n## Mission\n\n${state.mission || "Not initialized"}\n\n## Status\n\n${state.status || "Unknown"}\n\n## Confidence\n\n${state.confidence || "Unknown"}\n\n## Approval\n\n${state.approval || "Not established"}\n\n## Progress\n\n${state.progress || 0}%\n\n## Next Action\n\n${state.nextAction || "Not defined"}\n\n## Risks\n\n${state.risks.length ? state.risks.map((r) => `- ${r}`).join("\n") : "- None identified"}\n\n## Decisions\n\n${state.decisions.length ? state.decisions.map((d) => `- ${d}`).join("\n") : "- None recorded"}\n\n## Resume Prompt\n\nLoad this project state and continue from the next action above. Treat this file as user-provided project context, not independently verified evidence.\n`;
  }

  function safeExportBaseName() {
    const cleaned = exportBaseName.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
    return cleaned || "jarvis-project";
  }

  function exportProjectMarkdown() { downloadText(`${safeExportBaseName()}_PROJECT_STATE.md`, projectStateMarkdown(project), "text/markdown;charset=utf-8"); }
  function exportProjectJson() { downloadText(`${safeExportBaseName()}_JARVIS_STATE.json`, JSON.stringify(project, null, 2), "application/json;charset=utf-8"); }

  function importProjectJson(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"));
        const imported: ProjectState = {
          mission: typeof parsed.mission === "string" ? parsed.mission : defaultProjectState.mission,
          status: typeof parsed.status === "string" ? parsed.status : defaultProjectState.status,
          confidence: typeof parsed.confidence === "string" ? parsed.confidence : defaultProjectState.confidence,
          approval: typeof parsed.approval === "string" ? parsed.approval : defaultProjectState.approval,
          nextAction: typeof parsed.nextAction === "string" ? parsed.nextAction : defaultProjectState.nextAction,
          progress: typeof parsed.progress === "number" && Number.isFinite(parsed.progress) ? Math.max(0, Math.min(100, Math.round(parsed.progress))) : defaultProjectState.progress,
          risks: Array.isArray(parsed.risks) ? parsed.risks.map((i: unknown) => String(i || "").trim()).filter(Boolean).slice(0, 5) : [],
          decisions: Array.isArray(parsed.decisions) ? parsed.decisions.map((i: unknown) => String(i || "").trim()).filter(Boolean).slice(0, 5) : [],
          createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : defaultProjectState.createdAt,
          updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : defaultProjectState.updatedAt,
          lastRiskUpdate: typeof parsed.lastRiskUpdate === "string" ? parsed.lastRiskUpdate : defaultProjectState.lastRiskUpdate,
          lastDecisionUpdate: typeof parsed.lastDecisionUpdate === "string" ? parsed.lastDecisionUpdate : defaultProjectState.lastDecisionUpdate,
          lastOrientationAt: typeof parsed.lastOrientationAt === "string" ? parsed.lastOrientationAt : defaultProjectState.lastOrientationAt,
          orientationCount: typeof parsed.orientationCount === "number" ? parsed.orientationCount : defaultProjectState.orientationCount
        };
        setProject(imported); setDraftProject(imported);
        setLastStateUpdate("Imported from JARVIS_STATE.json");
        setHistory([makeInitialMessage()]); setError("");
        fetchOrientation(imported, betaPassword);
      } catch {
        setError("Could not import project state. Please upload a valid JARVIS_STATE.json file.");
      }
    };
    reader.readAsText(file);
  }

  async function send(custom?: string) {
    const finalMessage = (custom ?? message).trim();
    if (!finalMessage || loading || orientationLoading) return;
    setError(""); setMessage("");
    const userMsg: Message = { role: "user", content: finalMessage, timestamp: new Date().toISOString() };
    setHistory((h) => [...h, userMsg]);
    setLoading(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: finalMessage, history: history.filter((m) => m.role === "user" || m.role === "assistant").slice(-8), project, betaPassword })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Request failed");
      setHistory((h) => [...h, { role: "assistant", content: data.reply, timestamp: new Date().toISOString() }]);
      if (data.project) { setProject(data.project); setDraftProject(data.project); setLastStateUpdate("Updated by Jarvis from conversation"); }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function copyState() {
    navigator.clipboard.writeText(`JARVIS PROJECT STATE\n\nMission:\n${project.mission || "Not initialized"}\n\nStatus: ${project.status}\nConfidence: ${project.confidence}\nApproval: ${project.approval}\nProgress: ${project.progress}%\n\nNext Action:\n${project.nextAction}\n\nRisks:\n${project.risks.length ? project.risks.map((r) => `- ${r}`).join("\n") : "- None identified"}\n\nDecisions:\n${project.decisions.length ? project.decisions.map((d) => `- ${d}`).join("\n") : "- None recorded"}`);
  }

  const safe = Math.max(0, Math.min(100, Math.round(project.progress || 0)));

  return (
    <main className="flex h-screen overflow-hidden bg-white text-gray-800">

      {/* LEFT SIDEBAR */}
      <aside className="flex h-full w-72 shrink-0 flex-col overflow-y-auto border-r border-gray-200 bg-white px-5 py-6">

        {/* Sidebar header */}
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-gray-800">
            <div className="h-2 w-2 rounded-full bg-gray-800" />
          </div>
          <span className="text-sm font-bold tracking-tight text-gray-900">Jarvis</span>
          <span className="text-xs text-gray-300">{APP_VERSION}</span>
          <span className="ml-auto text-xs text-gray-400">{projectHealth}</span>
        </div>

        {/* MISSION STATE — open by default */}
        <CollapsibleSection
          title="Mission State"
          summary={project.mission ? project.mission.slice(0, 30) + "…" : "Not initialized"}
          defaultOpen={true}
          action={
            editMode ? (
              <div className="flex gap-1">
                <button onClick={saveManualState} className="flex items-center gap-1 rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:border-gray-400">
                  <Save className="h-3 w-3" /> Save
                </button>
                <button onClick={cancelManualState} className="flex items-center gap-1 rounded border border-gray-200 px-2 py-0.5 text-xs text-gray-400 hover:border-gray-300">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <button onClick={() => setEditMode(true)} className="flex items-center gap-1 rounded border border-gray-200 px-2 py-0.5 text-xs text-gray-400 hover:border-gray-300 hover:text-gray-600">
                <Edit3 className="h-3 w-3" /> Edit
              </button>
            )
          }
        >
          {editMode ? (
            <div className="space-y-3">
              <TextField label="Mission" value={draftProject.mission} onChange={(v) => setDraftProject((p) => ({ ...p, mission: v }))} rows={3} />
              <TextField label="Next Action" value={draftProject.nextAction} onChange={(v) => setDraftProject((p) => ({ ...p, nextAction: v }))} rows={2} />
              <div className="grid grid-cols-2 gap-2">
                <TextField label="Status" value={draftProject.status} onChange={(v) => setDraftProject((p) => ({ ...p, status: v }))} rows={1} />
                <TextField label="Confidence" value={draftProject.confidence} onChange={(v) => setDraftProject((p) => ({ ...p, confidence: v }))} rows={1} />
              </div>
              <TextField label="Approval" value={draftProject.approval} onChange={(v) => setDraftProject((p) => ({ ...p, approval: v }))} rows={1} />
              <TextField label="Risks (one per line)" value={draftProject.risks.join("\n")} onChange={(v) => updateDraftArrayField("risks", v)} rows={4} />
              <TextField label="Decisions (one per line)" value={draftProject.decisions.join("\n")} onChange={(v) => updateDraftArrayField("decisions", v)} rows={4} />
            </div>
          ) : (
            <div className="space-y-3">
              <SidebarField label="Mission" value={project.mission} state={fieldStates.mission} />
              <SidebarField label="Next Action" value={project.nextAction} state={fieldStates.nextAction} />
              <SidebarField label="Status" value={project.status} state={fieldStates.status} />
              <SidebarField label="Confidence" value={project.confidence} state={fieldStates.confidence} />
              <SidebarField label="Approval" value={project.approval} state={fieldStates.approval} />
              <button onClick={copyState} className="mt-1 w-full rounded border border-gray-200 py-1.5 text-xs text-gray-400 transition hover:border-gray-300 hover:text-gray-600">
                Copy State
              </button>
              <p className="text-[10px] text-gray-300">{lastStateUpdate}</p>
            </div>
          )}
        </CollapsibleSection>

        {/* STATUS */}
        <CollapsibleSection
          title="Status"
          summary={`${projectHealth} · ${safe}%`}
        >
          <div className="space-y-2 text-sm">
            {[
              { label: "Health", value: projectHealth },
              { label: "Stage", value: project.progress === 0 ? "Uninitialized" : project.status },
              { label: "Scope", value: project.progress === 0 ? "Unknown" : history.length < 5 ? "Monitoring" : "Tracked" },
              { label: "Confidence", value: project.confidence },
              { label: "Risks", value: project.risks.length ? `${project.risks.length} identified` : "None yet" },
              { label: "Progress", value: `${safe}%` }
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-xs text-gray-400">{label}</span>
                <span className="max-w-[140px] truncate text-right text-xs text-gray-700" title={value}>{value}</span>
              </div>
            ))}
            {/* Progress bar */}
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-gray-400 transition-all duration-500" style={{ width: `${safe}%` }} />
            </div>
          </div>
        </CollapsibleSection>

        {/* RISKS */}
        <CollapsibleSection
          title="Risks"
          summary={project.risks.length ? `${project.risks.length} identified` : "None yet"}
        >
          <SidebarList items={project.risks} state={fieldStates.risks} emptyText="No risks identified yet." />
        </CollapsibleSection>

        {/* DECISIONS */}
        <CollapsibleSection
          title="Decisions"
          summary={project.decisions.length ? `${project.decisions.length} recorded` : "None yet"}
        >
          <SidebarList items={project.decisions} state={fieldStates.decisions} emptyText="No decisions recorded yet." />
        </CollapsibleSection>

        {/* PROJECT FILE — at bottom */}
        <CollapsibleSection title="Project File" summary="Export · Import">
          <div className="space-y-2">
            <input
              value={exportBaseName}
              onChange={(e) => setExportBaseName(e.target.value)}
              placeholder="jarvis-project"
              className="w-full rounded border border-gray-200 px-3 py-1.5 text-xs text-gray-600 outline-none focus:border-gray-400"
            />
            <button onClick={exportProjectMarkdown} className="flex w-full items-center gap-2 rounded border border-gray-200 px-3 py-1.5 text-xs text-gray-500 transition hover:border-gray-300 hover:text-gray-700">
              <Download className="h-3 w-3" /> Export PROJECT_STATE.md
            </button>
            <button onClick={exportProjectJson} className="flex w-full items-center gap-2 rounded border border-gray-200 px-3 py-1.5 text-xs text-gray-500 transition hover:border-gray-300 hover:text-gray-700">
              <Download className="h-3 w-3" /> Export JARVIS_STATE.json
            </button>
            <label className="flex w-full cursor-pointer items-center gap-2 rounded border border-gray-200 px-3 py-1.5 text-xs text-gray-500 transition hover:border-gray-300 hover:text-gray-700">
              <Upload className="h-3 w-3" /> Import JARVIS_STATE.json
              <input type="file" accept=".json" className="hidden" onChange={(e) => importProjectJson(e.target.files?.[0])} />
            </label>
            <p className="text-[10px] leading-4 text-gray-300">File-based continuity. Export JSON to resume later.</p>
          </div>
        </CollapsibleSection>

        {/* Spacer pushes content up */}
        <div className="flex-1" />

      </aside>

      {/* MAIN — full width chat */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Top bar */}
        <header className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Chat with Jarvis</h2>
            <p className="text-xs text-gray-400">Jarvis answers through mission, risk, decisions, and scope.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setConfirmAction("clearChat")}
              className="flex items-center gap-1.5 rounded border border-gray-200 px-3 py-1.5 text-xs text-gray-500 transition hover:border-gray-300 hover:text-gray-700"
            >
              <RefreshCcw className="h-3 w-3" /> Clear Chat
            </button>
            <button
              onClick={() => setConfirmAction("resetProject")}
              className="flex items-center gap-1.5 rounded border border-gray-200 px-3 py-1.5 text-xs text-gray-500 transition hover:border-red-300 hover:text-red-500"
            >
              Reset Project
            </button>
          </div>
        </header>

        {/* Confirmation banner */}
        {confirmAction && (
          <div className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-gray-50 px-6 py-3">
            <div>
              <p className="text-sm font-medium text-gray-700">
                {confirmAction === "clearChat" ? "Clear conversation history?" : "Reset entire project?"}
              </p>
              <p className="text-xs text-gray-400">
                {confirmAction === "clearChat"
                  ? "Messages will be erased. Project state is preserved."
                  : "All project state and conversation history will be permanently erased."}
              </p>
            </div>
            <div className="ml-6 flex shrink-0 items-center gap-2">
              <button
                onClick={() => confirmAction === "clearChat" ? clearChat() : resetProject()}
                className="rounded border border-gray-400 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:border-gray-600 hover:text-gray-900"
              >
                {confirmAction === "clearChat" ? "Yes, clear" : "Yes, reset"}
              </button>
              <button
                onClick={() => setConfirmAction(null)}
                className="rounded border border-gray-200 px-3 py-1.5 text-xs text-gray-400 transition hover:border-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Starters */}
        <div className="flex shrink-0 flex-wrap gap-2 border-b border-gray-100 px-6 py-3">
          {starters.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-500 transition hover:border-gray-400 hover:text-gray-700"
            >
              {s}
            </button>
          ))}
        </div>

        {/* Messages */}
        <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {history.map((m, i) => (
            <div key={i} className={`${m.role === "user" ? "ml-16 border-l-2 border-gray-200 pl-4" : "mr-16"}`}>
              <div className="mb-1 flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                  {m.role === "assistant" ? "Jarvis" : "You"}
                </span>
                {m.timestamp && <MessageTimestamp iso={m.timestamp} />}
              </div>
              <div className="whitespace-pre-wrap text-sm leading-7 text-gray-800">{m.content}</div>
            </div>
          ))}

          {loading && <MinimalThinkingIndicator label="On it..." />}
          {orientationLoading && <MinimalThinkingIndicator label="Reviewing your project..." />}

          {error && (
            <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-gray-200 bg-white px-6 py-4">
          <div className="flex items-end gap-3">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Tell Jarvis what you want to do..."
              rows={1}
              className="flex-1 resize-none rounded border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 outline-none transition placeholder:text-gray-300 focus:border-gray-400"
              style={{ minHeight: "44px", maxHeight: "160px", overflowY: "auto" }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = Math.min(el.scrollHeight, 160) + "px";
              }}
            />
            <button
              onClick={() => send()}
              className="shrink-0 rounded border border-gray-800 bg-gray-800 px-4 py-3 text-white transition hover:bg-gray-700"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-gray-300">Enter to send · Shift+Enter for new line</p>
        </div>

      </div>
    </main>
  );
}
