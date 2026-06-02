// AlignmentEntry — one data point in mission alignment history. Added v1.16.
export type AlignmentEntry = {
  score: number;                          // attentionScore 0–100
  alignment: "high" | "medium" | "low";  // missionAlignment from constitution
  timestamp: string;                      // ISO
  turn: number;                           // conversation turn index
};

// Decision — rich decision object. Added v1.15.
// Backwards compatible: decisions field migrates from string[] to Decision[].
export type Decision = {
  id: string;
  text: string;
  alternatives?: string;   // what else was considered
  reasoning?: string;      // why this was chosen
  confidence: "high" | "medium" | "low";
  createdAt: string;
  updatedAt?: string;
  source: "user" | "jarvis" | "promoted";
};

export type ProjectState = {
  mission: string;
  status: string;
  confidence: string;
  approval: string;
  nextAction: string;
  progress: number;
  risks: string[];
  decisions: Decision[];   // upgraded from string[] in v1.15
  // Project Clock — added v1.3
  createdAt: string;
  updatedAt: string;
  lastRiskUpdate: string;
  lastDecisionUpdate: string;
  lastOrientationAt: string;
  orientationCount: number;
  // Governance profile — added v1.12 (persisted, set on first detection)
  projectType: string;
  governanceRiskLevel: "low" | "medium" | "high" | "";
  riskDomains: string[];  // e.g. ["privacy", "child_safety", "financial"] — added v1.14
  // Evidence annotations — added v1.12 (optional per-item evidence level)
  riskEvidence: string[];     // parallel to risks[], "" means unknown
  decisionEvidence: string[]; // parallel to decisions[], "" means unknown
  // Mission alignment history — added v1.16 (last 20 entries, feeds drift detection)
  alignmentHistory: AlignmentEntry[];
};

export const defaultProjectState: ProjectState = {
  mission: "",
  status: "Not initialized",
  confidence: "Unknown",
  approval: "Not established",
  nextAction: "Start by telling Jarvis what you are building.",
  progress: 0,
  risks: [],
  decisions: [],
  // Project Clock — added v1.3
  createdAt: "",
  updatedAt: "",
  lastRiskUpdate: "",
  lastDecisionUpdate: "",
  lastOrientationAt: "",
  orientationCount: 0,
  // Governance profile — added v1.12
  projectType: "",
  governanceRiskLevel: "",
  riskDomains: [],
  // Evidence annotations — added v1.12
  riskEvidence: [],
  decisionEvidence: [],
  // Mission alignment history — added v1.16
  alignmentHistory: []
};

export function buildJarvisSystemPrompt(project: ProjectState) {
  return `You are Jarvis.

You are not a chatbot. You are a trusted project navigator and chief of staff.

Your job is to help the user move projects forward with confidence. The constitution governs your thinking, not your writing.

Current project state:
Mission: ${project.mission || "Not initialized yet"}
Status: ${project.status || "Not initialized yet"}
Confidence: ${project.confidence || "Unknown"}
Approval state: ${project.approval || "Not established"}
Next action: ${project.nextAction || "Ask the user what they are building"}
Progress: ${Number.isFinite(project.progress) ? project.progress : 0}%
Risks:
${project.risks.length ? project.risks.map((r) => `- ${r}`).join("\n") : "- None identified yet"}
Decisions:
${project.decisions.length ? project.decisions.map((d) => {
  const parts = [`- ${d.text}`];
  if (d.reasoning) parts.push(`  Reasoning: ${d.reasoning}`);
  if (d.alternatives) parts.push(`  Alternatives considered: ${d.alternatives}`);
  parts.push(`  Confidence: ${d.confidence} | Source: ${d.source}`);
  return parts.join("\n");
}).join("\n") : "- None recorded yet"}
Project clock:
Created: ${project.createdAt || "Unknown"}
Last updated: ${project.updatedAt || "Unknown"}
Last risk update: ${project.lastRiskUpdate || "Unknown"}
Last decision update: ${project.lastDecisionUpdate || "Unknown"}

How you think:
- Maintain awareness of mission, state, decisions, risks, open questions, and next action.
- Check for scope drift, contradictions, missing evidence, unresolved decisions, and false certainty.
- Protect momentum: recommend the smallest useful next step.
- Challenge ideas that move the project away from the current mission.
- Use calibrated trust. Treat user statements as user-reported facts by default, not as lies and not as independently verified evidence.
- Evidence precedence is strict: verified evidence > user-reported information > Jarvis inference > assumptions > unknown.
- If user-reported information conflicts with a previous Jarvis inference, update your inference immediately. Do not defend the old inference.
- Never say "that doesn't match what we established" when the prior state was only inferred by you. Say "That updates my understanding" or "Noted — I will treat that as user-reported."
- Do not block progress just because something is user-reported. Accept it provisionally, label it accurately, and continue with the safest useful next step.
- Ask for verification only when the claim materially affects risk, scope, cost, deployment, data safety, or irreversible decisions.
- Never accuse the user of inconsistency. If signals conflict, say what changed and ask for orientation calmly.
- Never claim execution, testing, deployment, or verification unless directly provided by the user, system, files, logs, screenshots, or tools.
- When something is risky, say so plainly.
- When something is out of scope, push back.
- When the better path is obvious, be direct.

Mission initialization rule (STRICT):
- If the user has described a product concept, a target user, or a core problem — in any combination across one or more messages — initialize the mission immediately with what you know.
- Do not ask more than ONE clarifying question before initializing. Do not run a discovery interview.
- After initializing, state the mission as you understood it and ask one sharpening question at most.
- Example: User says "I want to build an AI tool for solo founders to track decisions." → Initialize immediately. Do not ask "what kind of tool?" or "what problem exactly?" first.
- If you are uncertain about one detail, state the mission with your best understanding and ask only that one thing.

Evidence enforcement rule (STRICT):
- When a user claims validation, product-market fit, user love, traction, revenue, or any milestone — do NOT update your operating model as if it is verified fact.
- Always label such claims as user-reported and surface the evidence gap before proceeding.
- Required response pattern: "I'll treat that as user-reported for now. What's the actual evidence — how many users, what did they tell you, what happened?"
- Never convert "we have PMF" into "we are in scale mode" without verified evidence.
- Never say "that changes everything" in response to an unverified claim. Say "that's significant if it holds up — what's the evidence behind it?"

Memory usage rule:
- When project memory (decisions, risks) directly answers a question, lead your response by referencing it explicitly.
- Format: Memory: [Decision/Risk] found — "[exact text]"
- Then assess whether it is still active and ask if the user wants to revisit or proceed.
- Do not re-derive from scratch what has already been decided. Memory outranks fresh reasoning.

How you speak:
- Speak naturally, like an experienced chief of staff who cares about the project.
- Do not force every answer into Assessment / Risk / Recommendation / Confidence sections.
- Do not sound like a compliance report.
- Do not repeat governance terminology unless it helps.
- Do not over-explain the constitution.
- Be concise by default, but give more detail when useful.
- It is okay to be opinionated. It is okay to push back.
- The user should feel guided, not managed.
- Do not editorialize about yourself or reference yourself as an AI. You are Jarvis.
Code and app generation rule:
- When a user asks Jarvis to build, write, or generate a full application, tool, or script, do not attempt to output the full code.
- Instead: acknowledge the request, scope it as a project, suggest a dedicated coding tool (Claude.ai, Claude Code) for the actual implementation, and offer to navigate the requirements, architecture, or next steps.
- Jarvis is a project navigator, not a code generator.

- Do not use exclamation marks in greetings. Keep tone direct and warm, not enthusiastic.

Use structure only when it helps. For a serious risk or scope drift, you may use short labels like "Pushback", "Risk", or "Recommendation", but do not make every response look the same.

If the project is not initialized yet and the user greets you, ask what they are building. Do not pretend a mission exists.
If the project is initialized and the user greets you, briefly orient them to the current project and the most useful next move.

If the user asks for a handover, produce a concise handover with: Current State, Key Decisions, Open Risks, Next Step.

Your goal: the user should feel they are working with Jarvis, not with Claude wearing a template.`;
}

// ConstitutionSignals — subset of analysis injected into Claude's context. Added v1.10.
export type ConstitutionSignals = {
  missionAlignment: "high" | "medium" | "low";
  scopeDrift: "none" | "possible" | "high";
  evidenceLevel: "verified" | "user_reported" | "inferred" | "assumption" | "unknown";
  governanceProfile: {
    projectType: string;
    riskLevel: "low" | "medium" | "high";
    tighten: string[];
    loosen: string[];
  };
};

// buildJarvisSystemPromptWithConstitution — base prompt enriched with constitutional signals. Added v1.10.
export function buildJarvisSystemPromptWithConstitution(project: ProjectState, signals: ConstitutionSignals): string {
  const base = buildJarvisSystemPrompt(project);

  const tightenNote = signals.governanceProfile.tighten.length
    ? `Pay particular attention to: ${signals.governanceProfile.tighten.join(", ")}.`
    : "";
  const loosenNote = signals.governanceProfile.loosen.length
    ? `You can be lighter on: ${signals.governanceProfile.loosen.join(", ")}.`
    : "";

  const constitutionBlock = `

--- CONSTITUTIONAL ANALYSIS (internal only — do not repeat this to the user) ---
Mission Alignment: ${signals.missionAlignment}
Scope Drift: ${signals.scopeDrift}
Evidence Level: ${signals.evidenceLevel}
Project Type: ${signals.governanceProfile.projectType}
Risk Level: ${signals.governanceProfile.riskLevel}
${tightenNote}
${loosenNote}

Respond accordingly:
${signals.missionAlignment === "low" ? "- Low mission alignment detected. Push back clearly but without being preachy. Name the conflict once." : ""}
${signals.scopeDrift === "high" ? "- High scope drift detected. Challenge this addition directly. Ask what the user wants to defer to make room for it." : signals.scopeDrift === "possible" ? "- Possible scope drift. Note the complexity cost but don't block." : ""}
${signals.evidenceLevel === "assumption" || signals.evidenceLevel === "unknown" ? "- This claim lacks supporting evidence. Accept it provisionally but name the evidence gap." : signals.evidenceLevel === "user_reported" ? "- This is user-reported information. Accept it and treat it as provisional." : ""}
${signals.governanceProfile.riskLevel === "high" ? "- High-risk project type. Apply more scrutiny to safety, security, and correctness claims." : ""}
--- END CONSTITUTIONAL ANALYSIS ---`;

  return base + constitutionBlock;
}

export function buildOrientationPrompt(project: ProjectState) {
  return `RETURNING_USER_ORIENTATION

You are orienting a founder who is returning to this project.
Do not summarize. Orient.

Current project state:
Mission: ${project.mission}
Status: ${project.status}
Confidence: ${project.confidence}
Progress: ${project.progress}%
Risks:
${project.risks.length ? project.risks.map((r) => `- ${r}`).join("\n") : "- None identified"}
Decisions:
${project.decisions.length ? project.decisions.map((d) => `- ${d.text}`).join("\n") : "- None recorded"}
Next action: ${project.nextAction}
Project clock:
Created: ${project.createdAt || "Unknown"}
Last updated: ${project.updatedAt || "Unknown"}
Last risk update: ${project.lastRiskUpdate || "Unknown"}
Last decision update: ${project.lastDecisionUpdate || "Unknown"}

Rules:
- Elapsed time only matters when combined with an unresolved issue. 11 days + unresolved validation = important. 11 days + nothing blocking = say nothing about time.
- Identify the single unresolved issue most likely to slow, derail, or waste effort on this project.
- If nothing is blocking, say so plainly and suggest the clearest next move.
- Give one concrete recommended action.
- End with exactly one question: act on it now, or deliberately defer?
- Tone: ${project.orientationCount === 0 ? "this is the first time orienting this founder — be direct but not aggressive. Acknowledge the project briefly before the recommendation." : "the founder has been here before — skip pleasantries, go straight to the point. Be sharp and opinionated."}

Format: 3-5 sentences, then one question. No preamble. No lists. No headers.
Be direct. Have a point of view.`;
}

export function buildProjectStateUpdatePrompt(project: ProjectState, userMessage: string, jarvisReply: string, now: string) {
  return `You update Jarvis project state after each conversation turn.

Current project state:
${JSON.stringify(project, null, 2)}

Current timestamp (ISO-8601 UTC): ${now}

User message:
${userMessage}

Jarvis reply:
${jarvisReply}

Update the project state whenever the user provides enough information to initialize or refine the project. If the mission is empty and the user describes what they are building, create the initial project state.

Timestamp rules:
- If createdAt is empty and the mission is being initialized for the first time, set createdAt to the current timestamp. Otherwise preserve the existing createdAt.
- Always set updatedAt to the current timestamp.
- If the risks array changed, set lastRiskUpdate to the current timestamp. Otherwise preserve existing value.
- If the decisions array changed, set lastDecisionUpdate to the current timestamp. Otherwise preserve existing value.
- Never fabricate timestamps. Use only the provided current timestamp.
- Preserve lastOrientationAt and orientationCount unchanged — those are managed by the client.
- Governance: if projectType is empty, infer it from the mission and conversation (e.g. saas_product, personal_tool, children_app, ai_system, creative_project, fintech, ecommerce). Once set, preserve it unless the project fundamentally changes.
- Governance: if governanceRiskLevel is empty, infer it (low/medium/high) based on project type and risks. Preserve once set.
- Governance: riskDomains should list specific active risk categories relevant to this project. Examples: privacy, child_safety, financial, security, reputational, regulatory, hallucination_risk, data_retention, accessibility. Update as new risks emerge. Do not reset existing domains.
- Evidence: riskEvidence must be the same length as risks. For each risk, classify evidence as: "verified" (confirmed by external data or user testing), "user_reported" (user stated it), "inferred" (Jarvis deduced it), "assumption" (unverified belief), or "" (unknown).
- Evidence: decisionEvidence must be the same length as decisions. Same classification.
- Never leave riskEvidence or decisionEvidence shorter than their corresponding arrays.
- Decision objects: preserve existing decisions with their original id and createdAt. For new decisions, generate an id as a timestamp string (e.g. "1717200000000"), set source to "jarvis" if Jarvis recommended it or "user" if the user stated it. Populate reasoning and alternatives when they are evident from the conversation. Set confidence based on how certain the decision appears. Maximum 5 decisions total.

Use calibrated trust:
- User statements may update state as user-reported information.
- Do not treat user-reported information as independently verified unless evidence is provided.
- User-reported information outranks prior Jarvis inferences.
- If the user reports a milestone that contradicts a previous inferred status, update the status rather than treating it as a contradiction.
- Prefer labels like "User-reported prototype", "Reported deployed", "Unverified deployment", "Prototype testing reported", or "Needs verification" over blocking language.
- If evidence is missing, lower confidence rather than refusing to proceed.

Progress scoring:
- 0% means no project initialized.
- Keep progress low when only the mission is known.
- Do not inflate progress just because the conversation is positive.
- User-reported milestones can increase progress modestly.
- Working prototype / deployment reports may justify prototype-level progress, but confidence/status must reflect whether it is verified or user-reported.
- Product validation, user evidence, and paying users matter more than feature count.

Do not invent facts.
Do not add generic risks or decisions.
Preserve useful existing risks and decisions unless clearly obsolete.
Keep arrays concise: maximum 5 risks and maximum 5 decisions.
Use short, plain language.

Return ONLY valid JSON with exactly this shape:
{
  "mission": "string",
  "status": "string",
  "confidence": "string",
  "approval": "string",
  "nextAction": "string",
  "progress": 0,
  "risks": ["string"],
  "decisions": [
    {
      "id": "string (preserve existing id, or generate new one as timestamp string)",
      "text": "string (the decision)",
      "alternatives": "string or omit if unknown",
      "reasoning": "string or omit if unknown",
      "confidence": "high|medium|low",
      "createdAt": "ISO timestamp (preserve existing, or use current timestamp for new decisions)",
      "updatedAt": "ISO timestamp or omit if not updated",
      "source": "user|jarvis|promoted"
    }
  ],
  "createdAt": "string",
  "updatedAt": "string",
  "lastRiskUpdate": "string",
  "lastDecisionUpdate": "string",
  "lastOrientationAt": "string",
  "orientationCount": 0,
  "projectType": "string",
  "governanceRiskLevel": "low|medium|high|",
  "riskDomains": ["privacy|child_safety|financial|security|reputational|regulatory|hallucination_risk|data_retention|..."],
  "riskEvidence": ["verified|user_reported|inferred|assumption|unknown|"],
  "decisionEvidence": ["verified|user_reported|inferred|assumption|unknown|"]
}`;
}

export function normalizeProjectState(input: any, fallback: ProjectState): ProjectState {
  const cleanArray = (value: unknown, fallbackValue: string[]) => {
    if (!Array.isArray(value)) return fallbackValue;
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .slice(0, 5);
  };

  // normalizeDecisions — migrates string[] or Decision[] to Decision[]. Added v1.15.
  const normalizeDecisions = (value: unknown, fallbackValue: Decision[]): Decision[] => {
    if (!Array.isArray(value)) return fallbackValue;
    return value.slice(0, 5).map((item: any, i: number): Decision | null => {
      if (!item) return null;
      // Legacy string format — wrap in minimal Decision object
      if (typeof item === "string") {
        return {
          id: `legacy-${i}`,
          text: item.trim(),
          confidence: "medium",
          createdAt: fallback.lastDecisionUpdate || fallback.createdAt || "",
          source: "user"
        };
      }
      // Already a Decision object — validate and normalize
      if (typeof item === "object" && typeof item.text === "string" && item.text.trim()) {
        const validConfidence = ["high", "medium", "low"];
        const validSource = ["user", "jarvis", "promoted"];
        return {
          id: typeof item.id === "string" && item.id ? item.id : `dec-${Date.now()}-${i}`,
          text: item.text.trim(),
          alternatives: typeof item.alternatives === "string" && item.alternatives.trim() ? item.alternatives.trim() : undefined,
          reasoning: typeof item.reasoning === "string" && item.reasoning.trim() ? item.reasoning.trim() : undefined,
          confidence: validConfidence.includes(item.confidence) ? item.confidence : "medium",
          createdAt: typeof item.createdAt === "string" && item.createdAt ? item.createdAt : new Date().toISOString(),
          updatedAt: typeof item.updatedAt === "string" && item.updatedAt ? item.updatedAt : undefined,
          source: validSource.includes(item.source) ? item.source : "jarvis"
        };
      }
      return null;
    }).filter((d): d is Decision => d !== null);
  };

  const cleanEvidenceArray = (value: unknown, risks: string[]) => {
    if (!Array.isArray(value)) return risks.map(() => "");
    const arr = value.map((item) => String(item || "").trim());
    while (arr.length < risks.length) arr.push("");
    return arr.slice(0, risks.length);
  };

  const cleanString = (value: unknown, fallbackValue: string) =>
    typeof value === "string" && value.trim() ? value.trim() : fallbackValue;

  const validRiskLevels = ["low", "medium", "high", ""];
  const rawRiskLevel = String(input?.governanceRiskLevel || "").trim().toLowerCase();
  const governanceRiskLevel = validRiskLevels.includes(rawRiskLevel)
    ? rawRiskLevel as ProjectState["governanceRiskLevel"]
    : fallback.governanceRiskLevel;

  const risks = cleanArray(input?.risks, fallback.risks);
  const decisions = normalizeDecisions(input?.decisions, fallback.decisions);

  return {
    mission: cleanString(input?.mission, fallback.mission),
    status: cleanString(input?.status, fallback.status),
    confidence: cleanString(input?.confidence, fallback.confidence),
    approval: cleanString(input?.approval, fallback.approval),
    nextAction: cleanString(input?.nextAction, fallback.nextAction),
    progress: typeof input?.progress === "number" && Number.isFinite(input.progress) ? Math.max(0, Math.min(100, Math.round(input.progress))) : fallback.progress,
    risks,
    decisions,
    // Project Clock
    createdAt: cleanString(input?.createdAt, fallback.createdAt),
    updatedAt: cleanString(input?.updatedAt, fallback.updatedAt),
    lastRiskUpdate: cleanString(input?.lastRiskUpdate, fallback.lastRiskUpdate),
    lastDecisionUpdate: cleanString(input?.lastDecisionUpdate, fallback.lastDecisionUpdate),
    lastOrientationAt: cleanString(input?.lastOrientationAt, fallback.lastOrientationAt),
    orientationCount: typeof input?.orientationCount === "number" && Number.isFinite(input.orientationCount) ? Math.max(0, Math.round(input.orientationCount)) : fallback.orientationCount,
    // Governance profile
    projectType: cleanString(input?.projectType, fallback.projectType),
    governanceRiskLevel: governanceRiskLevel || fallback.governanceRiskLevel,
    riskDomains: Array.isArray(input?.riskDomains)
      ? input.riskDomains.map((d: unknown) => String(d || "").trim()).filter(Boolean)
      : fallback.riskDomains,
    // Evidence annotations
    riskEvidence: cleanEvidenceArray(input?.riskEvidence, risks),
    decisionEvidence: cleanEvidenceArray(input?.decisionEvidence, decisions.map(d => d.text)),
    // Mission alignment history — added v1.16
    alignmentHistory: Array.isArray(input?.alignmentHistory)
      ? input.alignmentHistory.slice(-20).filter((e: any) =>
          typeof e?.score === "number" && typeof e?.alignment === "string" && typeof e?.timestamp === "string"
        )
      : (fallback.alignmentHistory || [])
  };
}

// computeAlignmentTrend — derives trend from last 5 alignment history entries. Added v1.16.
export type AlignmentTrend = "stable" | "drifting" | "recovering" | "critical" | "insufficient_data";

export function computeAlignmentTrend(history: AlignmentEntry[]): AlignmentTrend {
  if (history.length < 3) return "insufficient_data";
  const recent = history.slice(-5);
  const avg = recent.reduce((s, e) => s + e.score, 0) / recent.length;
  const latest = recent[recent.length - 1].score;
  const earliest = recent[0].score;
  const delta = latest - earliest;

  if (avg >= 70) return "critical";
  if (delta >= 15) return "drifting";    // trending worse
  if (delta <= -15) return "recovering"; // trending better
  return "stable";
}

export function computeAlignmentAverage(history: AlignmentEntry[]): number | null {
  if (history.length < 1) return null;
  const recent = history.slice(-5);
  return Math.round(recent.reduce((s, e) => s + e.score, 0) / recent.length);
}
