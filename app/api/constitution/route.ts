// API: /api/constitution
// Runs constitutional analysis on a user message before Claude responds.
// Returns structured signals used to inform Claude's response and drive the
// Navigator Attention Meter. Does NOT block or reject requests.
// Added: v1.10

import { NextRequest, NextResponse } from "next/server";
import { defaultProjectState, normalizeProjectState, type ProjectState } from "@/lib/jarvis";

export const runtime = "nodejs";

// ConstitutionAnalysis — the full structured output of a constitutional analysis pass
export type ConstitutionAnalysis = {
  missionAlignment: "high" | "medium" | "low";
  scopeDrift: "none" | "possible" | "high";
  evidenceLevel: "verified" | "user_reported" | "inferred" | "assumption" | "unknown";
  governanceProfile: {
    projectType: string;
    riskLevel: "low" | "medium" | "high";
    tighten: string[];
    loosen: string[];
  };
  notices: {
    missionConflict: boolean;
    scopeWarning: boolean;
    evidenceWarning: boolean;
  };
  attentionScore: number; // 0–100, weighted blend of all signals
  reasoning: string;      // brief internal note, not shown to user
};

// attentionScoreFromAnalysis — computes 0–100 score from analysis signals
// Weights: missionAlignment 35%, scopeDrift 30%, evidenceLevel 20%, riskLevel 15%
export function attentionScoreFromAnalysis(a: ConstitutionAnalysis): number {
  const mission = a.missionAlignment === "low" ? 100 : a.missionAlignment === "medium" ? 50 : 10;
  const scope = a.scopeDrift === "high" ? 100 : a.scopeDrift === "possible" ? 50 : 0;
  const evidence = a.evidenceLevel === "assumption" ? 80
    : a.evidenceLevel === "unknown" ? 70
    : a.evidenceLevel === "inferred" ? 50
    : a.evidenceLevel === "user_reported" ? 30
    : 5;
  const risk = a.governanceProfile.riskLevel === "high" ? 80
    : a.governanceProfile.riskLevel === "medium" ? 40
    : 10;
  return Math.round(mission * 0.35 + scope * 0.30 + evidence * 0.20 + risk * 0.15);
}

async function callAnthropic(prompt: string, maxTokens = 600): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured.");
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }]
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || "Claude request failed.");
  const text = data?.content?.[0]?.text;
  if (typeof text !== "string") throw new Error("Unexpected response.");
  return text;
}

function buildConstitutionPrompt(project: ProjectState, userMessage: string): string {
  return `You are a constitutional analysis engine for a project navigation AI called Jarvis.

Your job is to analyze a user message against the current project state and return a structured JSON assessment.
You do NOT generate a reply. You only analyze.

Current project state:
Mission: ${project.mission || "Not initialized"}
Status: ${project.status || "Unknown"}
Risks: ${project.risks.length ? project.risks.join(", ") : "None identified"}
Decisions: ${project.decisions.length ? project.decisions.join(", ") : "None recorded"}
Progress: ${project.progress}%
Confidence: ${project.confidence}

User message:
"${userMessage}"

Analyze and return ONLY valid JSON with exactly this structure:
{
  "missionAlignment": "high|medium|low",
  "scopeDrift": "none|possible|high",
  "evidenceLevel": "verified|user_reported|inferred|assumption|unknown",
  "governanceProfile": {
    "projectType": "brief description of project type e.g. saas_product, personal_tool, children_app, ai_system, creative_project",
    "riskLevel": "low|medium|high",
    "tighten": ["array of specific concerns to watch e.g. privacy, security, child_safety"],
    "loosen": ["array of things that don't need strict governance e.g. documentation_burden, architecture_rigor"]
  },
  "notices": {
    "missionConflict": true|false,
    "scopeWarning": true|false,
    "evidenceWarning": true|false
  },
  "reasoning": "one sentence internal note explaining the key signal"
}

Rules:
- missionAlignment: how well does this message align with the stated mission? If no mission exists, return "high".
- scopeDrift: does this message introduce significant complexity beyond the current phase?
- evidenceLevel: what level of evidence does the user's claim carry?
- governanceProfile: detect the project type from context. Adapt tighten/loosen accordingly.
  - Children's products: tighten privacy, child_safety, content_safety
  - AI systems: tighten hallucination_risk, user_consent, audit
  - Personal prototypes: loosen documentation_burden, approval_process
  - Financial/legal: tighten accuracy, compliance, user_consent
- notices.missionConflict: true only when missionAlignment is "low" AND the message fundamentally conflicts with mission
- notices.scopeWarning: true only when scopeDrift is "high"
- notices.evidenceWarning: true when evidenceLevel is user_reported, inferred, or assumption AND the claim materially affects project decisions
- reasoning: internal only, not shown to user

Return ONLY the JSON object. No preamble, no explanation.`;
}

// defaultAnalysis — safe fallback when analysis fails
function defaultAnalysis(project: ProjectState): ConstitutionAnalysis {
  return {
    missionAlignment: "high",
    scopeDrift: "none",
    evidenceLevel: "unknown",
    governanceProfile: {
      projectType: "unknown",
      riskLevel: project.risks.length >= 3 ? "medium" : "low",
      tighten: [],
      loosen: []
    },
    notices: { missionConflict: false, scopeWarning: false, evidenceWarning: false },
    attentionScore: 10,
    reasoning: "Default fallback — analysis unavailable"
  };
}

export async function POST(req: NextRequest) {
  try {
    const betaPasswordRequired = process.env.BETA_PASSWORD;
    const body = await req.json();

    if (betaPasswordRequired && body?.betaPassword !== betaPasswordRequired) {
      return NextResponse.json({ error: "Invalid beta password." }, { status: 401 });
    }

    const message = String(body?.message || "").trim();
    const project: ProjectState = normalizeProjectState(body?.project || {}, defaultProjectState);

    // Skip analysis if no mission exists — nothing to analyze against
    if (!project.mission || !message) {
      const fallback = defaultAnalysis(project);
      return NextResponse.json({ analysis: fallback });
    }

    const raw = await callAnthropic(buildConstitutionPrompt(project, message), 600);

    // Parse JSON — strip markdown fences if present
    const cleaned = raw.replace(/```json|```/g, "").trim();
    let parsed: Omit<ConstitutionAnalysis, "attentionScore">;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ analysis: defaultAnalysis(project) });
    }

    // Compute attention score from parsed signals
    const partial = parsed as ConstitutionAnalysis;
    partial.attentionScore = attentionScoreFromAnalysis(partial);

    return NextResponse.json({ analysis: partial });
  } catch {
    const project = normalizeProjectState({}, defaultProjectState);
    return NextResponse.json({ analysis: defaultAnalysis(project) });
  }
}
