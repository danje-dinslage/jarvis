"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Brain, CheckCircle2, Clipboard, Compass, Lock, Send, ShieldCheck, Sparkles, Target } from "lucide-react";
import { defaultProjectState, type ProjectState } from "@/lib/jarvis";

type Message = {
  role: "user" | "assistant";
  content: string;
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

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5 shadow-2xl shadow-black/20">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-100">
        <Icon className="h-4 w-4 text-blue-300" />
        {title}
      </div>
      {children}
    </section>
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

export default function Home() {
  const [project, setProject] = useState<ProjectState>(defaultProjectState);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<Message[]>([
    {
      role: "assistant",
      content: "Jarvis online. I will answer through the project constitution: state-aware, risk-aware, scope-aware, and focused on controlled progress."
    }
  ]);
  const [betaPassword, setBetaPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("jarvis-project-state-v02");
    const savedHistory = localStorage.getItem("jarvis-history-v02");
    const savedPassword = localStorage.getItem("jarvis-beta-password-v02");
    if (saved) setProject(JSON.parse(saved));
    if (savedHistory) setHistory(JSON.parse(savedHistory));
    if (savedPassword) setBetaPassword(savedPassword);
  }, []);

  useEffect(() => {
    localStorage.setItem("jarvis-project-state-v02", JSON.stringify(project));
  }, [project]);

  useEffect(() => {
    localStorage.setItem("jarvis-history-v02", JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem("jarvis-beta-password-v02", betaPassword);
  }, [betaPassword]);

  const projectHealth = useMemo(() => {
    if (project.risks.length >= 3) return { label: "Watch", tone: "amber" as const };
    if (project.confidence.toLowerCase().includes("low")) return { label: "Uncertain", tone: "red" as const };
    return { label: "Stable", tone: "green" as const };
  }, [project]);

  function updateArrayField(field: "risks" | "decisions", text: string) {
    setProject((p) => ({ ...p, [field]: text.split("\n").map((x) => x.trim()).filter(Boolean) }));
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function copyState() {
    const text = `JARVIS PROJECT STATE\n\nMission:\n${project.mission}\n\nStatus: ${project.status}\nConfidence: ${project.confidence}\nApproval: ${project.approval}\n\nNext Action:\n${project.nextAction}\n\nRisks:\n${project.risks.map((r) => `- ${r}`).join("\n")}\n\nDecisions:\n${project.decisions.map((d) => `- ${d}`).join("\n")}`;
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
              <p className="text-sm text-slate-400">Constitution-governed AI project navigator</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Pill tone="green"><ShieldCheck className="h-3.5 w-3.5" /> Constitution Layer Active</Pill>
            <Pill tone={projectHealth.tone}>{projectHealth.label}</Pill>
            <Pill tone="blue">Claude Powered</Pill>
          </div>
        </header>

        <div className="grid grid-cols-12 gap-5">
          <aside className="col-span-12 space-y-5 lg:col-span-3">
            <Section title="Mission State" icon={Target}>
              <div className="space-y-4">
                <TextField label="Mission" value={project.mission} onChange={(v) => setProject((p) => ({ ...p, mission: v }))} rows={4} />
                <TextField label="Next Action" value={project.nextAction} onChange={(v) => setProject((p) => ({ ...p, nextAction: v }))} rows={3} />
                <div className="grid grid-cols-2 gap-3">
                  <TextField label="Status" value={project.status} onChange={(v) => setProject((p) => ({ ...p, status: v }))} rows={1} />
                  <TextField label="Confidence" value={project.confidence} onChange={(v) => setProject((p) => ({ ...p, confidence: v }))} rows={1} />
                </div>
                <TextField label="Approval" value={project.approval} onChange={(v) => setProject((p) => ({ ...p, approval: v }))} rows={1} />
                <button onClick={copyState} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-900">
                  <Clipboard className="h-4 w-4" /> Copy State
                </button>
              </div>
            </Section>
          </aside>

          <section className="col-span-12 flex min-h-[720px] flex-col rounded-3xl border border-slate-800 bg-slate-950/80 shadow-2xl shadow-black/30 lg:col-span-6">
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

            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
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
                  Jarvis is checking mission, scope, risk, and evidence...
                </div>
              )}
              {error && (
                <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-100">
                  {error}
                </div>
              )}
            </div>

            <div className="border-t border-slate-800 p-5">
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
            <Section title="Constitution Signals" icon={ShieldCheck}>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between rounded-2xl bg-slate-900 p-3"><span className="text-slate-400">Scope Drift</span><Pill tone="green">Checked</Pill></div>
                <div className="flex items-center justify-between rounded-2xl bg-slate-900 p-3"><span className="text-slate-400">Approval State</span><Pill tone="amber">{project.approval}</Pill></div>
                <div className="flex items-center justify-between rounded-2xl bg-slate-900 p-3"><span className="text-slate-400">Project Health</span><Pill tone={projectHealth.tone}>{projectHealth.label}</Pill></div>
                <div className="flex items-center justify-between rounded-2xl bg-slate-900 p-3"><span className="text-slate-400">Known Risks</span><Pill tone="amber">{project.risks.length}</Pill></div>
              </div>
            </Section>

            <Section title="Risks" icon={AlertTriangle}>
              <textarea
                value={project.risks.join("\n")}
                onChange={(e) => updateArrayField("risks", e.target.value)}
                rows={8}
                className="w-full resize-none rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm leading-6 text-amber-100 outline-none focus:border-amber-400"
              />
            </Section>

            <Section title="Decisions" icon={CheckCircle2}>
              <textarea
                value={project.decisions.join("\n")}
                onChange={(e) => updateArrayField("decisions", e.target.value)}
                rows={8}
                className="w-full resize-none rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm leading-6 text-emerald-100 outline-none focus:border-emerald-400"
              />
            </Section>
          </aside>
        </div>
      </div>
    </main>
  );
}
