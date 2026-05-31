"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Clipboard,
  Compass,
  Download,
  Upload,
  Edit3,
  Lock,
  RefreshCcw,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp
} from "lucide-react";
import { defaultProjectState, type ProjectState } from "@/lib/jarvis";

type Message = {
  role: "user" | "assistant";
  content: string;
  timestamp?: string; // ISO-8601, added v1.4
};

const initialAssistantMessage: Message = {
  role: "assistant",
  content: `Hello. What are we building?

Tell me in plain language. I will turn the conversation into mission, risks, decisions, and the next action automatically.`,
  timestamp: new Date().toISOString()
};

const starters = [
  "What should we do next?",
  "Are we drifting from the goal?",
  "Should we add team features now?",
  "Create a handover for this project."
];

function Pill({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "green" | "amber" | "blue" | "red" }) {
  const styles = {
    default: "border-slate-700 bg-slate-900 text-slate-200",
    green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    blue: "border-blue-500/30 bg-blue-500/10 text-blue-200",
    red: "border-rose-500/30 bg-rose-500/10 text-rose-200"
  }[tone];

  return <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${styles}`}>{children}</span>;
}

function Section({ title, icon: Icon, children, action }: { title: string; icon: React.ElementType; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5 shadow-2xl shadow-black/20">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <Icon className="h-4 w-4 text-blue-300" />
          {title}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

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

function toneFromState(state: FieldState): "default" | "red" | "amber" | "green" | "blue" {
  if (state === "Unknown") return "default";
  if (state === "Initial") return "red";
  if (state === "Partial") return "amber";
  if (state === "Defined") return "green";
  return "blue";
}

function StateDot({ state }: { state: FieldState }) {
  const tone = toneFromState(state);
  const color =
    tone === "blue"
      ? "bg-blue-400 shadow-blue-400/40"
      : tone === "green"
        ? "bg-emerald-400 shadow-emerald-400/40"
        : tone === "amber"
          ? "bg-amber-400 shadow-amber-400/40"
          : tone === "red"
            ? "bg-rose-400 shadow-rose-400/40"
            : "bg-slate-600 shadow-slate-600/20";

  return <span className={`inline-block h-2.5 w-2.5 rounded-full shadow-lg ${color}`} />;
}

function FieldStateBadge({ state }: { state: FieldState }) {
  return (
    <div className="flex items-center gap-2 text-xs text-slate-500">
      <StateDot state={state} />
      <span>{state}</span>
    </div>
  );
}

function TextField({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <label className="block">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full resize-none rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm leading-6 text-slate-100 outline-none transition focus:border-blue-400"
      />
    </label>
  );
}

function ProgressBar({ value }: { value: number }) {
  const safe = Math.max(0, Math.min(100, Math.round(value || 0)));
  const tone = safe === 0 ? "default" : safe < 20 ? "red" : safe < 60 ? "amber" : "green";
  const bar = tone === "green" ? "bg-emerald-400" : tone === "amber" ? "bg-amber-400" : tone === "red" ? "bg-rose-400" : "bg-slate-700";

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5 shadow-2xl shadow-black/20">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <TrendingUp className="h-4 w-4 text-blue-300" />
          Project Progress
        </div>
        <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
          <StateDot state={safe === 0 ? "Unknown" : safe < 20 ? "Initial" : safe < 60 ? "Partial" : safe < 85 ? "Defined" : "Validated"} />
          {safe}%
        </div>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full rounded-full transition-all duration-500 ${bar}`} style={{ width: `${safe}%` }} />
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        Estimated conservatively by Jarvis from scope, known decisions, risks, and evidence. 0% means no project initialized.
      </p>
    </div>
  );
}

// JarvisThinkingIndicator — honest thinking state, added v1.4
// Red glowing eye + elapsed seconds. No fake steps.
function JarvisThinkingIndicator() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const elapsed = mins > 0 ? `${mins}:${String(secs).padStart(2, "0")}` : `0:${String(secs).padStart(2, "0")}`;

  return (
    <div className="mr-6 flex items-start gap-4 rounded-3xl border border-rose-500/20 bg-rose-500/5 p-5">
      {/* Red glowing eye */}
      <div className="relative mt-0.5 shrink-0">
        <div className="h-4 w-4 rounded-full bg-rose-500 shadow-[0_0_12px_3px_rgba(239,68,68,0.6)]" style={{ animation: "pulse 1.5s ease-in-out infinite" }} />
      </div>
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-rose-200">On it...</span>
          <span className="font-mono text-xs text-rose-400">{elapsed}</span>
        </div>
        {seconds >= 10 && (
          <p className="mt-1 text-xs text-rose-300/70">Bear with me.</p>
        )}
      </div>
    </div>
  );
}

// JarvisOrientingIndicator — shown during orientation load. Added v1.5.
// Same red eye treatment as thinking, different label.
function JarvisOrientingIndicator() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const elapsed = mins > 0 ? `${mins}:${String(secs).padStart(2, "0")}` : `0:${String(secs).padStart(2, "0")}`;

  return (
    <div className="mr-6 flex items-start gap-4 rounded-3xl border border-rose-500/20 bg-rose-500/5 p-5">
      <div className="relative mt-0.5 shrink-0">
        <div className="h-4 w-4 rounded-full bg-rose-500 shadow-[0_0_12px_3px_rgba(239,68,68,0.6)]" style={{ animation: "pulse 1.5s ease-in-out infinite" }} />
      </div>
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-rose-200">Reviewing your project...</span>
          <span className="font-mono text-xs text-rose-400">{elapsed}</span>
        </div>
        {seconds >= 10 && (
          <p className="mt-1 text-xs text-rose-300/70">Bear with me.</p>
        )}
      </div>
    </div>
  );
}

// formatRelativeTime — returns human-readable relative time, e.g. "2 days ago"
// Falls back to absolute if > 7 days. Added v1.5.
function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;
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

// formatAbsoluteTime — full timestamp for hover tooltip
function formatAbsoluteTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

// MessageTimestamp — relative time with absolute on hover. Added v1.5.
function MessageTimestamp({ iso }: { iso: string }) {
  if (!iso) return null;
  return (
    <span
      className="ml-auto text-xs text-slate-600 transition hover:text-slate-400 cursor-default"
      title={formatAbsoluteTime(iso)}
    >
      {formatRelativeTime(iso)}
    </span>
  );
}
function ReadOnlyBlock({ label, value, state }: { label: string; value: string; state: FieldState }) {
  const isEmpty = !value || value.trim().length === 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
        <FieldStateBadge state={state} />
      </div>
      <p className={`text-sm leading-6 ${isEmpty ? "text-slate-600 italic" : "text-slate-200"}`}>
        {isEmpty ? "Not defined" : value}
      </p>
    </div>
  );
}

// ListBlock — displays a list of strings (risks or decisions) with state indicator
function ListBlock({
  items,
  tone,
  state,
  emptyText
}: {
  items: string[];
  tone: "amber" | "green";
  state: FieldState;
  emptyText: string;
}) {
  const textColor = tone === "amber" ? "text-amber-100" : "text-emerald-100";
  const dotColor = tone === "amber" ? "bg-amber-400" : "bg-emerald-400";

  if (!items.length) {
    return (
      <div className="space-y-2">
        <FieldStateBadge state={state} />
        <p className="text-xs leading-5 text-slate-500">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <FieldStateBadge state={state} />
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2 rounded-2xl bg-slate-900 px-3 py-2">
          <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${dotColor}`} />
          <span className={`text-sm leading-6 ${textColor}`}>{item}</span>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const [project, setProject] = useState<ProjectState>(defaultProjectState);
  const [draftProject, setDraftProject] = useState<ProjectState>(defaultProjectState);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<Message[]>([initialAssistantMessage]);
  const [betaPassword, setBetaPassword] = useState("");
  const [exportBaseName, setExportBaseName] = useState("jarvis-project");
  const [loading, setLoading] = useState(false);
  const [orientationLoading, setOrientationLoading] = useState(false);
  const [error, setError] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [lastStateUpdate, setLastStateUpdate] = useState("No project initialized yet");
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Fetch orientation from /api/orient and append as assistant message
  // Called on localStorage resume and JSON import when mission exists
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
        setHistory((h) => [...h, { role: "assistant", content: data.orientation }]);
        // Increment orientationCount in project state
        setProject((p) => ({ ...p, orientationCount: p.orientationCount + 1, lastOrientationAt: new Date().toISOString() }));
      }
    } catch {
      // Orientation failure is non-fatal — session continues normally
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
      // Trigger orientation on resume only if no history exists (fresh session on existing project)
      if (!savedHistory && parsed.mission) {
        fetchOrientation(parsed, loadedPassword);
      }
    }

    if (savedHistory) {
      const parsedHistory: Message[] = JSON.parse(savedHistory);
      setHistory(parsedHistory);
      // Session age trigger — if last message is older than 8 hours, fire orientation
      if (parsedHistory.length > 1) {
        const last = parsedHistory[parsedHistory.length - 1];
        if (last.timestamp) {
          const ageHours = (Date.now() - new Date(last.timestamp).getTime()) / (1000 * 60 * 60);
          if (ageHours >= 8) {
            const savedProject = saved ? JSON.parse(saved) : null;
            if (savedProject?.mission) {
              fetchOrientation(savedProject, loadedPassword);
            }
          }
        }
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("jarvis-project-state-v13", JSON.stringify(project));
  }, [project]);

  useEffect(() => {
    localStorage.setItem("jarvis-history-v13", JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem("jarvis-beta-password-v02", betaPassword);
  }, [betaPassword]);

  useEffect(() => {
    localStorage.setItem("jarvis-export-base-name-v12", exportBaseName);
  }, [exportBaseName]);

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
    if (project.progress === 0) return { label: "Uninitialized", tone: "default" as const };
    if (project.risks.length >= 3) return { label: "Watch", tone: "amber" as const };
    if (project.confidence.toLowerCase().includes("low")) return { label: "Uncertain", tone: "red" as const };
    return { label: "Stable", tone: "green" as const };
  }, [project]);

  function updateDraftArrayField(field: "risks" | "decisions", text: string) {
    setDraftProject((p) => ({
      ...p,
      [field]: text
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean)
    }));
  }

  function saveManualState() {
    setProject(draftProject);
    setEditMode(false);
    setLastStateUpdate("Manually corrected");
  }

  function cancelManualState() {
    setDraftProject(project);
    setEditMode(false);
  }

  function newSession() {
    setHistory([initialAssistantMessage]);
    setMessage("");
    setError("");
    localStorage.removeItem("jarvis-history-v091");
  }

  function resetProject() {
    setProject(defaultProjectState);
    setDraftProject(defaultProjectState);
    setHistory([initialAssistantMessage]);
    setMessage("");
    setError("");
    setLastStateUpdate("No project initialized yet");
    localStorage.removeItem("jarvis-project-state-v091");
    localStorage.removeItem("jarvis-history-v091");
  }

  function downloadText(filename: string, content: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function projectStateMarkdown(state: ProjectState) {
    return `# PROJECT_STATE

Generated by Jarvis.

## Mission

${state.mission || "Not initialized"}

## Status

${state.status || "Unknown"}

## Confidence

${state.confidence || "Unknown"}

## Approval

${state.approval || "Not established"}

## Progress

${state.progress || 0}%

## Next Action

${state.nextAction || "Not defined"}

## Risks

${state.risks.length ? state.risks.map((risk) => `- ${risk}`).join("\n") : "- None identified"}

## Decisions

${state.decisions.length ? state.decisions.map((decision) => `- ${decision}`).join("\n") : "- None recorded"}

## Resume Prompt

Load this project state and continue from the next action above. Treat this file as user-provided project context, not independently verified evidence.
`;
  }

  function safeExportBaseName() {
    const cleaned = exportBaseName
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "");

    return cleaned || "jarvis-project";
  }

  function exportProjectMarkdown() {
    downloadText(`${safeExportBaseName()}_PROJECT_STATE.md`, projectStateMarkdown(project), "text/markdown;charset=utf-8");
  }

  function exportProjectJson() {
    downloadText(`${safeExportBaseName()}_JARVIS_STATE.json`, JSON.stringify(project, null, 2), "application/json;charset=utf-8");
  }

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
          risks: Array.isArray(parsed.risks) ? parsed.risks.map((item: unknown) => String(item || "").trim()).filter(Boolean).slice(0, 5) : [],
          decisions: Array.isArray(parsed.decisions) ? parsed.decisions.map((item: unknown) => String(item || "").trim()).filter(Boolean).slice(0, 5) : [],
          // Project Clock — preserve from file, fall back to defaults
          createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : defaultProjectState.createdAt,
          updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : defaultProjectState.updatedAt,
          lastRiskUpdate: typeof parsed.lastRiskUpdate === "string" ? parsed.lastRiskUpdate : defaultProjectState.lastRiskUpdate,
          lastDecisionUpdate: typeof parsed.lastDecisionUpdate === "string" ? parsed.lastDecisionUpdate : defaultProjectState.lastDecisionUpdate,
          lastOrientationAt: typeof parsed.lastOrientationAt === "string" ? parsed.lastOrientationAt : defaultProjectState.lastOrientationAt,
          orientationCount: typeof parsed.orientationCount === "number" ? parsed.orientationCount : defaultProjectState.orientationCount
        };

        setProject(imported);
        setDraftProject(imported);
        setLastStateUpdate("Imported from JARVIS_STATE.json");
        // Reset history to just the initial message — orientation will follow via fetchOrientation
        setHistory([initialAssistantMessage]);
        setError("");
        // Trigger orientation after import
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

    setError("");
    setMessage("");

    const userMsg: Message = { role: "user", content: finalMessage, timestamp: new Date().toISOString() };
    setHistory((h) => [...h, userMsg]);
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: finalMessage,
          history: history.filter((m) => m.role === "user" || m.role === "assistant").slice(-8),
          project,
          betaPassword
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Request failed");

      setHistory((h) => [...h, { role: "assistant", content: data.reply, timestamp: new Date().toISOString() }]);

      if (data.project) {
        setProject(data.project);
        setDraftProject(data.project);
        setLastStateUpdate("Updated by Jarvis from conversation");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function copyState() {
    const text = `JARVIS PROJECT STATE

Mission:
${project.mission || "Not initialized"}

Status: ${project.status}
Confidence: ${project.confidence}
Approval: ${project.approval}
Progress: ${project.progress}%

Next Action:
${project.nextAction}

Risks:
${project.risks.length ? project.risks.map((r) => `- ${r}`).join("\n") : "- None identified"}

Decisions:
${project.decisions.length ? project.decisions.map((d) => `- ${d}`).join("\n") : "- None recorded"}`;

    navigator.clipboard.writeText(text);
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#1e3a8a_0,#020617_35%,#020617_100%)] px-5 py-5 text-slate-100">
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 flex items-center justify-between rounded-3xl border border-slate-800 bg-slate-950/80 px-6 py-5 shadow-soft backdrop-blur">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500 text-white shadow-lg shadow-blue-500/20">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Jarvis</h1>
              <p className="text-sm text-slate-400">AI chief of staff for project navigation</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              onClick={newSession}
              className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-blue-400 hover:text-blue-200"
              title="Clear chat history but keep project state."
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              New Session
            </button>
            <button
              onClick={resetProject}
              className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-200 transition hover:border-rose-400"
              title="Clear chat and project state."
            >
              Reset Project
            </button>
            <Pill tone="green">
              <ShieldCheck className="h-3.5 w-3.5" /> Jarvis Layer Active
            </Pill>
            <Pill tone={projectHealth.tone}>{projectHealth.label}</Pill>
            <Pill tone="blue">Claude Powered</Pill>
          </div>
        </header>

        <div className="grid grid-cols-12 gap-5">
          <aside className="col-span-12 space-y-5 lg:col-span-3">
            <ProgressBar value={project.progress} />

            <Section title="Project File" icon={Download}>
              <div className="space-y-3">
                <label className="block">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Export file name</div>
                  <input
                    value={exportBaseName}
                    onChange={(e) => setExportBaseName(e.target.value)}
                    placeholder="jarvis-project"
                    className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-blue-400"
                  />
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Exports use this name as a prefix, for example {safeExportBaseName()}_PROJECT_STATE.md.
                  </p>
                </label>

                <button
                  onClick={exportProjectMarkdown}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-900"
                >
                  <Download className="h-4 w-4" /> Export PROJECT_STATE.md
                </button>

                <button
                  onClick={exportProjectJson}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-900"
                >
                  <Download className="h-4 w-4" /> Export JARVIS_STATE.json
                </button>

                <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm font-semibold text-blue-100 transition hover:border-blue-400">
                  <Upload className="h-4 w-4" /> Import JARVIS_STATE.json
                  <input
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={(e) => importProjectJson(e.target.files?.[0])}
                  />
                </label>

                <p className="text-xs leading-5 text-slate-500">
                  File-based continuity without auth. Export the JSON to resume later, or keep the Markdown as a readable handover.
                </p>
              </div>
            </Section>

            <Section
              title="Mission State"
              icon={Target}
              action={
                editMode ? (
                  <div className="flex gap-2">
                    <button onClick={saveManualState} className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
                      <Save className="mr-1 inline h-3 w-3" /> Save
                    </button>
                    <button onClick={cancelManualState} className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setEditMode(true)} className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:border-blue-400 hover:text-blue-200">
                    <Edit3 className="mr-1 inline h-3 w-3" /> Edit
                  </button>
                )
              }
            >
              {editMode ? (
                <div className="space-y-4">
                  <TextField label="Mission" value={draftProject.mission} onChange={(v) => setDraftProject((p) => ({ ...p, mission: v }))} rows={4} />
                  <TextField label="Next Action" value={draftProject.nextAction} onChange={(v) => setDraftProject((p) => ({ ...p, nextAction: v }))} rows={3} />
                  <div className="grid grid-cols-2 gap-3">
                    <TextField label="Status" value={draftProject.status} onChange={(v) => setDraftProject((p) => ({ ...p, status: v }))} rows={1} />
                    <TextField label="Confidence" value={draftProject.confidence} onChange={(v) => setDraftProject((p) => ({ ...p, confidence: v }))} rows={1} />
                  </div>
                  <TextField label="Approval" value={draftProject.approval} onChange={(v) => setDraftProject((p) => ({ ...p, approval: v }))} rows={1} />
                </div>
              ) : (
                <div className="space-y-3">
                  <ReadOnlyBlock label="Mission" value={project.mission} state={fieldStates.mission} />
                  <ReadOnlyBlock label="Next Action" value={project.nextAction} state={fieldStates.nextAction} />
                  <ReadOnlyBlock label="Status" value={project.status} state={fieldStates.status} />
                  <ReadOnlyBlock label="Confidence" value={project.confidence} state={fieldStates.confidence} />
                  <ReadOnlyBlock label="Approval" value={project.approval} state={fieldStates.approval} />
                  <button onClick={copyState} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-900">
                    <Clipboard className="h-4 w-4" /> Copy State
                  </button>
                  <p className="text-xs leading-5 text-slate-500">Last state update: {lastStateUpdate}</p>
                </div>
              )}
            </Section>
          </aside>

          <section className="col-span-12 flex min-h-[720px] max-h-[calc(100vh-150px)] flex-col rounded-3xl border border-slate-800 bg-slate-950/80 shadow-2xl shadow-black/30 lg:col-span-6">
            <div className="border-b border-slate-800 px-6 py-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold">Chat with Jarvis</h2>
                  <p className="mt-1 text-sm text-slate-400">Jarvis answers through mission, risk, decisions, and scope.</p>
                </div>

                <div className="hidden items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-400 sm:flex">
                  <Lock className="h-3.5 w-3.5" /> {project.approval}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {starters.map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:border-blue-400 hover:text-blue-200">
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div ref={chatScrollRef} className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
              {history.map((m, i) => (
                <div key={i} className={`rounded-3xl border p-5 ${m.role === "user" ? "ml-10 border-slate-700 bg-slate-900" : "mr-6 border-blue-500/20 bg-blue-500/10"}`}>
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    {m.role === "assistant" ? <Brain className="h-4 w-4 text-blue-300" /> : <Compass className="h-4 w-4 text-slate-400" />}
                    {m.role === "assistant" ? "Jarvis" : "You"}
                    {m.timestamp && <MessageTimestamp iso={m.timestamp} />}
                  </div>

                  <div className="whitespace-pre-wrap text-sm leading-7 text-slate-200">{m.content}</div>
                </div>
              ))}

              {loading && <JarvisThinkingIndicator />}

              {orientationLoading && <JarvisOrientingIndicator />}

              {error && (
                <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-100">
                  {error}
                </div>
              )}
            </div>

            <div className="sticky bottom-0 border-t border-slate-800 bg-slate-950/95 p-5 backdrop-blur">
              <div className="flex gap-3">
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder="Tell Jarvis what you want to do..."
                  className="flex-1 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-blue-400"
                />

                <button onClick={() => send()} className="rounded-2xl bg-blue-500 px-5 py-4 font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-400">
                  <Send className="h-5 w-5" />
                </button>
              </div>

              <input
                value={betaPassword}
                onChange={(e) => setBetaPassword(e.target.value)}
                placeholder="Beta password, if enabled"
                className="mt-3 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-xs text-slate-300 outline-none placeholder:text-slate-600 focus:border-slate-600"
              />
            </div>
          </section>

          <aside className="col-span-12 space-y-5 lg:col-span-3">
            <Section title="Status" icon={ShieldCheck}>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between rounded-2xl bg-slate-900 p-3">
                  <span className="text-slate-400">Stage</span>
                  <Pill tone={project.progress === 0 ? "default" : project.progress < 20 ? "red" : project.progress < 60 ? "amber" : "green"}>
                    {project.progress === 0 ? "Uninitialized" : project.status}
                  </Pill>
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-slate-900 p-3">
                  <span className="text-slate-400">Scope</span>
                  <Pill tone={project.progress === 0 ? "default" : history.length < 5 ? "amber" : "green"}>
                    {project.progress === 0 ? "Unknown" : history.length < 5 ? "Monitoring" : "Tracked"}
                  </Pill>
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-slate-900 p-3">
                  <span className="text-slate-400">Confidence</span>
                  <Pill tone={project.confidence.toLowerCase().includes("unknown") ? "default" : project.confidence.toLowerCase().includes("low") ? "red" : project.confidence.toLowerCase().includes("medium") ? "amber" : "green"}>
                    {project.confidence}
                  </Pill>
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-slate-900 p-3">
                  <span className="text-slate-400">Risks</span>
                  <Pill tone={project.risks.length ? "amber" : "default"}>{project.risks.length ? `${project.risks.length} identified` : "None yet"}</Pill>
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-slate-900 p-3">
                  <span className="text-slate-400">Progress</span>
                  <Pill tone={project.progress === 0 ? "default" : project.progress < 20 ? "red" : project.progress < 60 ? "amber" : "green"}>{project.progress}%</Pill>
                </div>
              </div>
            </Section>

            <Section title="Risks" icon={AlertTriangle}>
              {editMode ? (
                <textarea
                  value={draftProject.risks.join("\n")}
                  onChange={(e) => updateDraftArrayField("risks", e.target.value)}
                  rows={8}
                  className="w-full resize-none rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm leading-6 text-amber-100 outline-none focus:border-amber-400"
                />
              ) : (
                <ListBlock items={project.risks} tone="amber" state={fieldStates.risks} emptyText="No risks identified yet. Jarvis will populate this from the conversation." />
              )}
            </Section>

            <Section title="Decisions" icon={CheckCircle2}>
              {editMode ? (
                <textarea
                  value={draftProject.decisions.join("\n")}
                  onChange={(e) => updateDraftArrayField("decisions", e.target.value)}
                  rows={8}
                  className="w-full resize-none rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm leading-6 text-emerald-100 outline-none focus:border-emerald-400"
                />
              ) : (
                <ListBlock items={project.decisions} tone="green" state={fieldStates.decisions} emptyText="No decisions recorded yet. Jarvis will populate this from the conversation." />
              )}
            </Section>
          </aside>
        </div>
      </div>
    </main>
  );
}
