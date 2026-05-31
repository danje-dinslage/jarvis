export type ProjectState = {
  mission: string;
  status: string;
  confidence: string;
  approval: string;
  nextAction: string;
  progress: number;
  risks: string[];
  decisions: string[];
  // Project Clock — added v1.3
  createdAt: string;
  updatedAt: string;
  lastRiskUpdate: string;
  lastDecisionUpdate: string;
  lastOrientationAt: string;
  orientationCount: number;
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
  orientationCount: 0
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
${project.decisions.length ? project.decisions.map((d) => `- ${d}`).join("\n") : "- None recorded yet"}
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

How you speak:
- Speak naturally, like an experienced chief of staff who cares about the project.
- Do not force every answer into Assessment / Risk / Recommendation / Confidence sections.
- Do not sound like a compliance report.
- Do not repeat governance terminology unless it helps.
- Do not over-explain the constitution.
- Be concise by default, but give more detail when useful.
- It is okay to be opinionated. It is okay to push back.
- The user should feel guided, not managed.

Use structure only when it helps. For a serious risk or scope drift, you may use short labels like "Pushback", "Risk", or "Recommendation", but do not make every response look the same.

If the project is not initialized yet and the user greets you, ask what they are building. Do not pretend a mission exists.
If the project is initialized and the user greets you, briefly orient them to the current project and the most useful next move.

If the user asks for a handover, produce a concise handover with: Current State, Key Decisions, Open Risks, Next Step.

Your goal: the user should feel they are working with Jarvis, not with Claude wearing a template.`;
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
${project.decisions.length ? project.decisions.map((d) => `- ${d}`).join("\n") : "- None recorded"}
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
  "decisions": ["string"],
  "createdAt": "string",
  "updatedAt": "string",
  "lastRiskUpdate": "string",
  "lastDecisionUpdate": "string",
  "lastOrientationAt": "string",
  "orientationCount": 0
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

  const cleanString = (value: unknown, fallbackValue: string) =>
    typeof value === "string" && value.trim() ? value.trim() : fallbackValue;

  return {
    mission: cleanString(input?.mission, fallback.mission),
    status: cleanString(input?.status, fallback.status),
    confidence: cleanString(input?.confidence, fallback.confidence),
    approval: cleanString(input?.approval, fallback.approval),
    nextAction: cleanString(input?.nextAction, fallback.nextAction),
    progress: typeof input?.progress === "number" && Number.isFinite(input.progress) ? Math.max(0, Math.min(100, Math.round(input.progress))) : fallback.progress,
    risks: cleanArray(input?.risks, fallback.risks),
    decisions: cleanArray(input?.decisions, fallback.decisions),
    // Project Clock — added v1.3
    createdAt: cleanString(input?.createdAt, fallback.createdAt),
    updatedAt: cleanString(input?.updatedAt, fallback.updatedAt),
    lastRiskUpdate: cleanString(input?.lastRiskUpdate, fallback.lastRiskUpdate),
    lastDecisionUpdate: cleanString(input?.lastDecisionUpdate, fallback.lastDecisionUpdate),
    lastOrientationAt: cleanString(input?.lastOrientationAt, fallback.lastOrientationAt),
    orientationCount: typeof input?.orientationCount === "number" && Number.isFinite(input.orientationCount) ? Math.max(0, Math.round(input.orientationCount)) : fallback.orientationCount
  };
}
