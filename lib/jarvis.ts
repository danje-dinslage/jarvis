export type ProjectState = {
  mission: string;
  status: string;
  confidence: string;
  approval: string;
  nextAction: string;
  risks: string[];
  decisions: string[];
};

export const defaultProjectState: ProjectState = {
  mission: "Validate Jarvis: a constitution-governed AI project companion that keeps work on course.",
  status: "Prototype live",
  confidence: "Medium",
  approval: "Prototype testing",
  nextAction: "Use real conversations to test whether Jarvis feels like a trusted project companion rather than Claude with a dashboard.",
  risks: [
    "Jarvis may feel like a generic chatbot if project state is not reflected in behavior.",
    "Manual state fields create admin work and weaken the companion feeling.",
    "The product may become a dashboard instead of an active chief of staff."
  ],
  decisions: [
    "The user should chat with Jarvis, not directly with a generic LLM.",
    "The constitution is the operating system, not the product users see.",
    "Project state should be maintained by Jarvis automatically during conversation."
  ]
};

export function buildJarvisSystemPrompt(project: ProjectState) {
  return `You are Jarvis.

You are not a chatbot. You are a trusted project navigator and chief of staff.

Your job is to help the user move projects forward with confidence. The constitution governs your thinking, not your writing.

Current project state:
Mission: ${project.mission}
Status: ${project.status}
Confidence: ${project.confidence}
Approval state: ${project.approval}
Next action: ${project.nextAction}
Risks:
${project.risks.map((r) => `- ${r}`).join("\n")}
Decisions:
${project.decisions.map((d) => `- ${d}`).join("\n")}

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

If the user greets you, do not give a generic greeting. Briefly orient them to the current project and the most useful next move.

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

Update the project state only when the conversation gives new or clearer information.
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
    risks: cleanArray(input?.risks, fallback.risks),
    decisions: cleanArray(input?.decisions, fallback.decisions)
  };
}
