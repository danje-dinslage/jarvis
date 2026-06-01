// API: /api/constitution
// Runs constitutional analysis on a user message before Claude responds.
// Returns structured signals used to inform Claude and drive the Navigator Attention Meter.
// Does NOT block or reject requests. Added: v1.10. Updated v1.14.4 — uses shared callAnthropicText.

import { NextRequest, NextResponse } from "next/server";
import { defaultProjectState, normalizeProjectState, type ProjectState } from "@/lib/jarvis";
import { type ConstitutionAnalysis, attentionScoreFromAnalysis } from "@/lib/constitution";
import { callAnthropicText } from "@/lib/api";

export const runtime = "nodejs";

async function callAnthropic(prompt: string, maxTokens = 600): Promise<string> {
  return callAnthropicText([{ role: "user", content: prompt }], "You are a constitutional analysis engine. Return only valid JSON.", maxTokens);
}

function buildConstitutionPrompt(project: ProjectState, userMessage: string): string {
  // If governance profile is already persisted in state, inject it so Claude doesn't re-infer
  const persistedGovernance = project.projectType
    ? `Known project type: ${project.projectType}. Known risk level: ${project.governanceRiskLevel || "unknown"}.`
    : "Project type not yet determined — infer from mission and context.";

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
${persistedGovernance}

User message:
"${userMessage}"

Analyze and return ONLY valid JSON with exactly this structure:
{
  "missionAlignment": "high|medium|low",
  "scopeDrift": "none|possible|high",
  "evidenceLevel": "verified|user_reported|inferred|assumption|unknown",
  "governanceProfile": {
    "projectType": "preserve known type or infer: saas_product, personal_tool, children_app, ai_system, creative_project, fintech, ecommerce",
    "riskLevel": "preserve known level or infer: low|medium|high",
    "tighten": ["specific concerns e.g. privacy, security, child_safety"],
    "loosen": ["things that need less scrutiny e.g. documentation_burden, architecture_rigor"]
  },
  "notices": {
    "missionConflict": true|false,
    "scopeWarning": true|false,
    "evidenceWarning": true|false
  },
  "reasoning": "one sentence internal note on the key signal"
}

Rules:
- missionAlignment: how well does this message align with the stated mission? If no mission exists, return "high".
- scopeDrift: does this message introduce significant complexity beyond the current phase?
- evidenceLevel: what level of evidence does the user's claim carry?
- governanceProfile.projectType: if already known from state, PRESERVE it exactly. Only infer if empty.
- governanceProfile.riskLevel: if already known from state, PRESERVE it. Only infer if empty.
- governanceProfile.tighten/loosen: adapt each turn based on current message context.
  - Children products: tighten privacy, child_safety, content_safety
  - AI systems: tighten hallucination_risk, user_consent, audit
  - Personal prototypes: loosen documentation_burden, approval_process
  - Financial/legal: tighten accuracy, compliance, user_consent
- notices.missionConflict: true only when missionAlignment is "low" AND message fundamentally conflicts with mission
- notices.scopeWarning: true only when scopeDrift is "high"
- notices.evidenceWarning: true when evidenceLevel is user_reported/inferred/assumption AND claim materially affects project decisions
- reasoning: internal only, not shown to user

Return ONLY the JSON object. No preamble, no explanation.`;
}

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

    if (!project.mission || !message) {
      return NextResponse.json({ analysis: defaultAnalysis(project) });
    }

    const raw = await callAnthropic(buildConstitutionPrompt(project, message), 600);
    const cleaned = raw.replace(/```json|```/g, "").trim();

    let parsed: Omit<ConstitutionAnalysis, "attentionScore">;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ analysis: defaultAnalysis(project) });
    }

    const analysis: ConstitutionAnalysis = {
      ...parsed,
      attentionScore: attentionScoreFromAnalysis(parsed)
    };

    // Return governance fields so chat route can persist them to project state
    return NextResponse.json({
      analysis,
      governanceUpdate: {
        projectType: parsed.governanceProfile.projectType,
        governanceRiskLevel: parsed.governanceProfile.riskLevel,
        riskDomains: Array.isArray(parsed.governanceProfile.tighten) ? parsed.governanceProfile.tighten : []
      }
    });
  } catch {
    return NextResponse.json({ analysis: defaultAnalysis(normalizeProjectState({}, defaultProjectState)) });
  }
}
