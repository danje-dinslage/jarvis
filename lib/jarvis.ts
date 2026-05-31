export type ProjectState = {
  mission: string;
  status: string;
  confidence: string;
  approval: string;
  nextAction: string;
  progress: number;
  risks: string[];
  decisions: string[];
};

export const defaultProjectState: ProjectState = {
  mission: "",
  status: "Not initialized",
  confidence: "Unknown",
  approval: "Not established",
  nextAction: "Start by telling Jarvis what you are building.",
  progress: 0,
  risks: [],
  decisions: []
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

How you think:
- Maintain awareness of the current mission, state, recent decisions, risks, open questions, and next action.
- Check for scope drift, contradictions, missing evidence, unresolved decisions, and false certainty.
- Protect momentum: recommend the smallest useful next step.
- Challenge ideas that move the project away from the current mission.
- Distinguish what is verified from what is assumed.
- Never claim execution, testing, deployment, or verification unless the user or system has actually provided it.
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

export function buildProjectStateUpdatePrompt(project: ProjectState, userMessage: string, jarvisReply: string) {
  return `You update Jarvis project state after each conversation turn.

Current project state:
${JSON.stringify(project, null, 2)}

User message:
${userMessage}

Jarvis reply:
${jarvisReply}

Update the project state whenever the user provides enough information to initialize or refine the project. If the mission is empty and the user describes what they are building, create the initial project state.
Do not invent facts.
Do not add generic risks or decisions.
Preserve useful existing risks and decisions unless clearly obsolete.
Keep arrays concise: maximum 5 risks and maximum 5 decisions.
Set progress as a realistic 0-100 percentage based on what is known about the project scope and current state. If scope is unknown, keep progress low. Do not inflate progress just because the conversation is positive.
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
  "decisions": ["string"]
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

  return {
    mission: typeof input?.mission === "string" && input.mission.trim() ? input.mission.trim() : fallback.mission,
    status: typeof input?.status === "string" && input.status.trim() ? input.status.trim() : fallback.status,
    confidence: typeof input?.confidence === "string" && input.confidence.trim() ? input.confidence.trim() : fallback.confidence,
    approval: typeof input?.approval === "string" && input.approval.trim() ? input.approval.trim() : fallback.approval,
    nextAction: typeof input?.nextAction === "string" && input.nextAction.trim() ? input.nextAction.trim() : fallback.nextAction,
    progress: typeof input?.progress === "number" && Number.isFinite(input.progress) ? Math.max(0, Math.min(100, Math.round(input.progress))) : fallback.progress,
    risks: cleanArray(input?.risks, fallback.risks),
    decisions: cleanArray(input?.decisions, fallback.decisions)
  };
}
