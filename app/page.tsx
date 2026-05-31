"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Brain, CheckCircle2, Clipboard, Compass, Edit3, Lock, RefreshCcw, Save, Send, ShieldCheck, Sparkles, Target, TrendingUp } from "lucide-react";
import { defaultProjectState, type ProjectState } from "@/lib/jarvis";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const initialAssistantMessage: Message = {
  role: "assistant",
  content: `Hello. What are we building?

Tell me in plain language. I will turn the conversation into mission, risks, decisions, and the next action automatically.`
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

function Section({ title, icon: Icon, children, action }: { title: string; icon: any; children: React.ReactNode; action?: React.ReactNode }) {
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

function ReadOnlyBlock({ label, value, score }: { label: string; value: string; score: number }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
        <FieldHealth score={score} />
      </div>
      <div className="whitespace-pre-wrap text-sm leading-6 text-slate-100">{value || "Not initialized yet. Jarvis will fill this from the conversation."}</div>
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

function ListBlock({ items, tone = "default", score }: { items: string[]; tone?: "amber" | "green" | "default"; score: number }) {
  const color = tone === "amber" ? "border-amber-500/20 bg-amber-500/10 text-amber-100" : tone === "green" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100" : "border-slate-800 bg-slate-900/60 text-slate-100";
  if (!items.length) return <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-500"><div className="mb-2 flex justify-end"><FieldHealth score={score} /></div>Nothing recorded yet. Jarvis will populate this from the conversation.</div>;
  return (
    <div className="space-y-2">
      <div className="flex justify-end"><FieldHealth score={score} /></div>
      {items.map((item, index) => (
        <div key={`${item}-${index}`} className={`rounded-2xl border p-3 text-sm leading-6 ${color}`}>{item}</div>
      ))}
    </div>
  );
}


function scoreText(value: string, neutralValues: string[] = []) {
  const clean = value.trim().toLowerCase();
  if (!clean || neutralValues.includes(clean)) return 15;
  if (clean.includes("unknown") || clean.includes("not established") || clean.includes("not initialized")) return 25;
  if (clean.includes("low") || clean.includes("blocked") || clean.includes("uncertain")) return 35;
  if (clean.includes("medium") || clean.includes("prototype") || clean.includes("watch")) return 65;
  if (clean.includes("high") || clean.includes("validated") || clean.includes("stable")) return 85;
  return Math.min(90, Math.max(45, clean.length > 40 ? 75 : 55));
}

function scoreList(items: string[]) {
  if (!items.length) return 15;
  if (items.length <= 2) return 60;
  if (items.length <= 4) return 75;
  return 85;
}

function toneFromScore(score: number): "red" | "amber" | "green" {
  if (score < 40) return "red";
  if (score < 70) return "amber";
  return "green";
}

function HealthDot({ score }: { score: number }) {
  const tone = toneFromScore(score);
  const color = tone === "green" ? "bg-emerald-400 shadow-emerald-400/40" : tone === "amber" ? "bg-amber-400 shadow-amber-400/40" : "bg-rose-400 shadow-rose-400/40";
  return <span className={`inline-block h-2.5 w-2.5 rounded-full shadow-lg ${color}`} />;
}

function FieldHealth({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2 text-xs text-slate-500">
      <HealthDot score={score} />
      <span>{score}%</span>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  const safe = Math.max(0, Math.min(100, Math.round(value || 0)));
  const tone = toneFromScore(safe);
  const bar = tone === "green" ? "bg-emerald-400" : tone === "amber" ? "bg-amber-400" : "bg-rose-400";
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5 shadow-2xl shadow-black/20">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <TrendingUp className="h-4 w-4 text-blue-300" />
          Project Progress
        </div>
        <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
          <HealthDot score={safe} />
          {safe}%
        </div>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full rounded-full transition-all duration-500 ${bar}`} style={{ width: `${safe}%` }} />
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">Estimated by Jarvis from current scope, known decisions, risks, and evidence. It will change as the project state improves.</p>
    </div>
  );
}

export default function Home() {
  const [project, setProject] = useState<ProjectState>(defaultProjectState);
  const [draftProject, setDraftProject] = useState<ProjectState>(defaultProjectState);
  const [editMode, setEditMode] = useState(false);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<Message[]>([initialAssistantMessage]);
  const [betaPassword, setBetaPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastStateUpdate, setLastStateUpdate] = useState("No project initialized yet");
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("jarvis-project-state-v05");
    const savedHistory = localStorage.getItem("jarvis-history-v05");
    const savedPassword = localStorage.getItem("jarvis-beta-password-v02");

    if (saved) {
      const parsed = JSON.parse(saved);
      setProject(parsed);
      setDraftProject(parsed);
    }
    if (savedHistory) setHistory(JSON.parse(savedHistory));
    if (savedPassword) setBetaPassword(savedPassword);
  }, []);

  useEffect(() => {
    localStorage.setItem("jarvis-project-state-v05", JSON.stringify(project));
    setDraftProject(project);
  }, [project]);

  useEffect(() => {
    localStorage.setItem("jarvis-history-v05", JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem("jarvis-beta-password-v02", betaPassword);
  }, [betaPassword]);

  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [history, loading, error]);

  const fieldScores = useMemo(() => ({
    mission: scoreText(project.mission, [""]),
    nextAction: scoreText(project.nextAction),
    status: scoreText(project.status),
    confidence: scoreText(project.confidence),
    approval: scoreText(project.approval),
    risks: scoreList(project.risks),
    decisions: scoreList(project.decisions),
  }), [project]);

  const projectHealth = useMemo(() => {
    if (project.risks.length >= 3) return { label: "Watch", tone: "amber" as const };
    if (project.confidence.toLowerCase().includes("low")) return { label: "Uncertain", tone: "red" as const };
    if ((project.progress || 0) < 20) return { label: "Initializing", tone: "amber" as const };
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
    localStorage.removeItem("jarvis-history-v05");
  }

  function resetProject() {
    setProject(defaultProjectState);
    setDraftProject(defaultProjectState);
    setHistory([initialAssistantMessage]);
    setMessage("");
    setError("");
    setLastStateUpdate("No project initialized yet");
    localStorage.removeItem("jarvis-project-state-v05");
    localStorage.removeItem("jarvis-history-v05");
  }

  async function send(custom?: string) {
    const finalMessage = (custom ?? message).trim();
    if (!finalMessage || loading) return;

    setError("");
    setMessage("");

    const userMsg: Message = { role: "user", content: finalMessage };
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

      setHistory((h) => [...h, { role: "assistant", content: data.reply }]);
      if (data.project) {
        setProject(data.project);
        setLastStateUpdate("Updated by Jarvis from the conversation");
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
${project.mission}

Status: ${project.status}
Confidence: ${project.confidence}
Approval: ${project.approval}
Progress: ${project.progress || 0}%

Next Action:
${project.nextAction}

Risks:
${project.risks.map((r) => `- ${r}`).join("\n")}

Decisions:
${project.decisions.map((d) => `- ${d}`).join("\n")}`;

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
              title="Clear chat history but keep mission state, risks, decisions, and approval state."
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              New Session
            </button>
            <button
              onClick={resetProject}
              className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-100 transition hover:border-rose-400"
              title="Clear project state and start from an empty first-run experience."
            >
              Reset Project
            </button>
            <Pill tone="green"><ShieldCheck className="h-3.5 w-3.5" /> Jarvis Layer Active</Pill>
            <Pill tone={projectHealth.tone}>{projectHealth.label}</Pill>
            <Pill tone="blue">{project.progress || 0}% Progress</Pill>
            <Pill tone="blue">Claude Powered</Pill>
          </div>
        </header>

        <div className="grid grid-cols-12 gap-5">
          <aside className="col-span-12 space-y-5 lg:col-span-3">
            <ProgressBar value={project.progress || 0} />
            <Section
              title="Mission State"
              icon={Target}
              action={
                editMode ? (
                  <div className="flex gap-2">
                    <button onClick={saveManualState} className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200"><Save className="mr-1 inline h-3 w-3" />Save</button>
                    <button onClick={cancelManualState} className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-300">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setEditMode(true)} className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-300 hover:border-blue-400 hover:text-blue-200"><Edit3 className="mr-1 inline h-3 w-3" />Edit</button>
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
                  <ReadOnlyBlock label="Mission" value={project.mission} score={fieldScores.mission} />
                  <ReadOnlyBlock label="Next Action" value={project.nextAction} score={fieldScores.nextAction} />
                  <div className="grid grid-cols-2 gap-3">
                    <ReadOnlyBlock label="Status" value={project.status} score={fieldScores.status} />
                    <ReadOnlyBlock label="Confidence" value={project.confidence} score={fieldScores.confidence} />
                  </div>
                  <ReadOnlyBlock label="Approval" value={project.approval} score={fieldScores.approval} />
                  <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-3 text-xs leading-5 text-blue-100">{lastStateUpdate}</div>
                  <button onClick={copyState} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-900">
                    <Clipboard className="h-4 w-4" /> Copy State
                  </button>
                </div>
              )}
            </Section>
          </aside>

          <section className="col-span-12 flex h-[calc(100vh-150px)] min-h-[640px] flex-col overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/80 shadow-2xl shadow-black/30 lg:col-span-6">
            <div className="border-b border-slate-800 px-6 py-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold">Chat with Jarvis</h2>
                  <p className="mt-1 text-sm text-slate-400">Talk naturally. Jarvis will create and update the project state automatically.</p>
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
                  </div>

                  <div className="whitespace-pre-wrap text-sm leading-7 text-slate-200">{m.content}</div>
                </div>
              ))}

              {loading && (
                <div className="mr-6 rounded-3xl border border-blue-500/20 bg-blue-500/10 p-5 text-sm text-blue-100">
                  Jarvis is thinking and updating project state...
                </div>
              )}

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
                  placeholder="Tell Jarvis what you are working on..."
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
            <Section title="Navigation Signals" icon={ShieldCheck}>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between rounded-2xl bg-slate-900 p-3"><span className="text-slate-400">Scope Drift</span><Pill tone="green">Checked</Pill></div>
                <div className="flex items-center justify-between rounded-2xl bg-slate-900 p-3"><span className="text-slate-400">Approval State</span><Pill tone="amber">{project.approval}</Pill></div>
                <div className="flex items-center justify-between rounded-2xl bg-slate-900 p-3"><span className="text-slate-400">Project Health</span><Pill tone={projectHealth.tone}>{projectHealth.label}</Pill></div>
                <div className="flex items-center justify-between rounded-2xl bg-slate-900 p-3"><span className="text-slate-400">Known Risks</span><Pill tone="amber">{project.risks.length}</Pill></div>
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
                <ListBlock items={project.risks} tone="amber" score={fieldScores.risks} />
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
                <ListBlock items={project.decisions} tone="green" score={fieldScores.decisions} />
              )}
            </Section>
          </aside>
        </div>
      </div>
    </main>
  );
}
