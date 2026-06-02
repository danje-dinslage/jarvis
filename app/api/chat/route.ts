// API: /api/chat
// Main Jarvis chat endpoint.
// Flow: Memory check → Constitution analysis → Search intent → Agentic Claude loop (with web search) → State update
// Returns: { reply, project, constitutionAnalysis, searchUsed, searchIntent }
// Updated: v1.11 — Layer 1 memory search + web search + search intent classification

import { NextRequest, NextResponse } from "next/server";
import {
  buildJarvisSystemPrompt,
  buildJarvisSystemPromptWithConstitution,
  buildProjectStateUpdatePrompt,
  defaultProjectState,
  normalizeProjectState,
  type ConstitutionSignals,
  type ProjectState
} from "@/lib/jarvis";
import { type ConstitutionAnalysis } from "@/lib/constitution";

export const runtime = "nodejs";

type HistoryMessage = { role: "user" | "assistant"; content: string; };
type Attachment = { name: string; type: "image" | "text"; mediaType: string; data: string; };

// SearchIntent — classification of why a search is needed. Added v1.11.
type SearchIntent = "research" | "validation" | "competitor" | "market" | "technical" | "regulatory" | "none";

const apiKey = () => {
  const k = process.env.ANTHROPIC_API_KEY;
  if (!k) throw new Error("ANTHROPIC_API_KEY is not configured.");
  return k;
};
const model = () => process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";

// callAnthropicRaw — single API call, returns full response object. Updated v1.14.4.
// Adds anthropic-beta header when web search tool is present (required by API).
async function callAnthropicRaw(messages: any[], system: string, maxTokens = 900, tools?: any[]): Promise<any> {
  const body: any = { model: model(), max_tokens: maxTokens, system, messages };
  if (tools?.length) body.tools = tools;

  const hasWebSearch = tools?.some(t => t.name === "web_search");
  const hasWebFetch = tools?.some(t => t.name === "web_fetch");
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-api-key": apiKey(),
    "anthropic-version": "2023-06-01"
  };
  const betaHeaders: string[] = [];
  if (hasWebSearch) betaHeaders.push("web-search-2025-03-05");
  if (hasWebFetch) betaHeaders.push("web-fetch-2025-01-24");
  if (betaHeaders.length) headers["anthropic-beta"] = betaHeaders.join(",");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || "Claude request failed.");
  return data;
}

// callAnthropic — simple text-only call (for state update, no tools)
async function callAnthropic(messages: any[], system: string, maxTokens = 900): Promise<string> {
  const data = await callAnthropicRaw(messages, system, maxTokens);
  const text = data?.content?.find((b: any) => b.type === "text")?.text;
  if (typeof text !== "string") throw new Error("Unexpected response.");
  return text;
}

// callAnthropicAgentLoop — calls Claude with optional web search and web fetch. Updated v1.14.4.
// Both web_search_20250305 and web_fetch_20250124 are SERVER tools — Anthropic executes them.
// No tool_use/tool_result cycle needed. One call returns the final response with citations.
async function callAnthropicAgentLoop(
  messages: any[],
  system: string,
  maxTokens = 1000,
  enableSearch: boolean
): Promise<{ reply: string; searchUsed: boolean }> {
  const tools = enableSearch ? [
    { type: "web_search_20250305", name: "web_search", max_uses: 5 },
    { type: "web_fetch_20250124", name: "web_fetch", max_uses: 3 }
  ] : [];

  const data = await callAnthropicRaw(messages, system, maxTokens, tools);
  const content: any[] = data.content || [];

  // Server tools return results directly — check for tool usage in content blocks
  const searchUsed = enableSearch && content.some((b: any) =>
    (b.type === "tool_use" && (b.name === "web_search" || b.name === "web_fetch")) ||
    b.type === "tool_result" ||
    b.type === "web_search_tool_result"
  );

  // Extract all text blocks and join
  const text = content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("") || "";

  return { reply: text, searchUsed: searchUsed || enableSearch };
}

function parseJsonObject(text: string) {
  const trimmed = text.trim();
  try { return JSON.parse(trimmed); } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON object returned.");
    return JSON.parse(match[0]);
  }
}

function buildUserContent(message: string, attachments: Attachment[]): any[] | string {
  if (!attachments.length) return message;
  const blocks: any[] = [];
  if (message.trim()) blocks.push({ type: "text", text: message });
  for (const att of attachments) {
    if (att.type === "image") {
      blocks.push({ type: "image", source: { type: "base64", media_type: att.mediaType, data: att.data } });
    } else {
      blocks.push({ type: "text", text: `[Attached file: ${att.name}]\n\n${att.data}` });
    }
  }
  return blocks;
}

// MemoryRetrieval — structured result of project memory check. Updated v1.14.
type MemoryRetrieval = {
  memoryHit: boolean;
  memorySource: "decision" | "risk" | "both" | "none";
  memoryContent: string;
  memoryConfidence: "high" | "medium" | "low" | "none"; // how certain is the match
  memoryAge: string;     // human-readable age e.g. "3 days ago", "unknown"
  matchedDecisions: string[];
  matchedRisks: string[];
};

// semanticMemoryCheck — Layer 1: semantic memory retrieval. Updated v1.14.
// Returns rich MemoryRetrieval object with confidence and age.
async function semanticMemoryCheck(
  message: string,
  project: ProjectState,
  history: HistoryMessage[]
): Promise<MemoryRetrieval> {
  const noHit: MemoryRetrieval = {
    memoryHit: false, memorySource: "none", memoryContent: "",
    memoryConfidence: "none", memoryAge: "unknown",
    matchedDecisions: [], matchedRisks: []
  };

  if (!project.mission || (!project.decisions.length && !project.risks.length)) {
    return noHit;
  }

  const prompt = `You are a project memory retrieval engine for a project navigation AI called Jarvis.

Project mission: ${project.mission}

Recorded decisions:
${project.decisions.length ? project.decisions.map((d, i) => `${i + 1}. ${d.text}${d.reasoning ? ` (reasoning: ${d.reasoning})` : ""}`).join("\n") : "None"}

Tracked risks:
${project.risks.length ? project.risks.map((r, i) => `${i + 1}. ${r}`).join("\n") : "None"}

Recent conversation (last 4 messages):
${history.slice(-4).map(m => `${m.role}: ${m.content.slice(0, 100)}`).join("\n")}

User question: "${message}"

Return ONLY valid JSON:
{
  "memoryHit": true|false,
  "memorySource": "decision|risk|both|none",
  "memoryContent": "exact verbatim text of the most relevant item, empty if no hit",
  "memoryConfidence": "high|medium|low|none",
  "matchedDecisions": ["exact text"],
  "matchedRisks": ["exact text"]
}

Rules:
- memoryHit: true ONLY if a decision or risk DIRECTLY addresses the question
- memoryConfidence: high=verbatim overlap+direct answer, medium=semantic match, low=loose association, none=no hit
- memoryContent: verbatim, do not paraphrase
- No hit: memoryHit false, source "none", content empty, confidence "none"

Return ONLY the JSON.`;

  try {
    const data = await callAnthropicRaw(
      [{ role: "user", content: prompt }],
      "You are a precise memory retrieval engine. Return only valid JSON.",
      250
    );
    const text = data.content?.find((b: any) => b.type === "text")?.text || "{}";
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    const validSources = ["decision", "risk", "both", "none"];
    const validConf = ["high", "medium", "low", "none"];
    const memoryAge = calculateMemoryAge(
      parsed.memorySource,
      project.lastDecisionUpdate,
      project.lastRiskUpdate
    );
    return {
      memoryHit: !!parsed.memoryHit,
      memorySource: validSources.includes(parsed.memorySource) ? parsed.memorySource : "none",
      memoryContent: typeof parsed.memoryContent === "string" ? parsed.memoryContent : "",
      memoryConfidence: validConf.includes(parsed.memoryConfidence) ? parsed.memoryConfidence : "none",
      memoryAge,
      matchedDecisions: Array.isArray(parsed.matchedDecisions) ? parsed.matchedDecisions : [],
      matchedRisks: Array.isArray(parsed.matchedRisks) ? parsed.matchedRisks : []
    };
  } catch {
    return noHit;
  }
}

// calculateMemoryAge — human-readable age of matched memory. Added v1.14.
function calculateMemoryAge(source: string, lastDecisionUpdate: string, lastRiskUpdate: string): string {
  const ts = source === "decision" ? lastDecisionUpdate
    : source === "risk" ? lastRiskUpdate
    : lastDecisionUpdate || lastRiskUpdate;
  if (!ts) return "unknown";
  const diff = Date.now() - new Date(ts).getTime();
  if (isNaN(diff) || diff < 0) return "unknown";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins <= 1 ? "just now" : `${mins} minutes ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

// classifySearchIntent — determines if and why web search is needed.
// Returns "none" if memory answers it or search won't help. Updated v1.14.4.
// Fix: no longer requires project.mission — search is valid even on uninitialized projects.
async function classifySearchIntent(
  message: string,
  project: ProjectState,
  memoryHit: boolean
): Promise<SearchIntent> {
  if (memoryHit) return "none";

  // URL fetch requests — always enable search/fetch tools
  if (/https?:\/\/|go to .{3,50}\.com|visit .{3,50}\.com|open .{3,50}\.com|check .{3,50}\.com/.test(message.toLowerCase())) {
    return "research";
  }

  const missionContext = project.mission
    ? `Project mission: ${project.mission}`
    : "No project mission set yet.";

  const prompt = `You are a search intent classifier for a project navigation AI.

${missionContext}
User message: "${message}"

Classify whether web search would meaningfully help answer this message.

Return ONLY one of these values:
- "competitor" — asking about competitors or alternatives
- "market" — asking about market size, trends, or industry data
- "technical" — asking about technologies, frameworks, or technical choices
- "validation" — asking about whether an assumption or claim is accurate
- "research" — general research that would benefit from current web data
- "regulatory" — asking about laws, regulations, or compliance
- "none" — the question is about project navigation, decisions, emotions, strategy, or anything the web cannot resolve

Rules:
- Questions about "should we", "what should we do", "is this a good idea" → "none"
- Questions about specific named companies, tools, or technologies → usually "competitor" or "technical"
- Questions about market facts or statistics → "market" or "validation"
- Personal or emotional questions → "none"
- Questions about competitors, alternatives, or industry players → "competitor"

Return only the single word value. Nothing else.`;

  try {
    const data = await callAnthropicRaw(
      [{ role: "user", content: prompt }],
      "You are a precise classifier. Return only the exact requested value.",
      50
    );
    const text = (data.content?.find((b: any) => b.type === "text")?.text || "none").trim().toLowerCase();
    const valid: SearchIntent[] = ["research", "validation", "competitor", "market", "technical", "regulatory", "none"];
    return valid.includes(text as SearchIntent) ? text as SearchIntent : "none";
  } catch {
    return "none";
  }
}

// buildMemoryNote — injects memory retrieval into system prompt. Updated v1.14.4.
// Fix: "both" source now defaults to "Decision found" for format precision.
function buildMemoryNote(retrieval: MemoryRetrieval): string {
  if (!retrieval.memoryHit || !retrieval.memoryContent) return "";
  if (retrieval.memoryConfidence === "none" || retrieval.memoryConfidence === "low") return "";

  // Fix v1.14.4: "both" defaults to Decision found — more precise than generic "Memory found"
  const sourceLabel = retrieval.memorySource === "risk" ? "Risk found"
    : retrieval.memorySource === "decision" || retrieval.memorySource === "both" ? "Decision found"
    : "Memory found";

  // Age qualifier — old memories get a softer hedge
  const ageNote = retrieval.memoryAge !== "unknown" && retrieval.memoryAge !== "just now"
    ? ` (recorded ${retrieval.memoryAge})`
    : "";

  // High confidence: lead with memory definitively
  // Medium confidence: reference memory but acknowledge it may not fully apply
  const confidenceInstruction = retrieval.memoryConfidence === "high"
    ? `Begin your response with: Memory: ${sourceLabel}${ageNote} — "${retrieval.memoryContent}"\nThen address whether this is still active. Ask if the user wants to revisit or proceed.`
    : `Reference this memory in your response: "${retrieval.memoryContent}"${ageNote}\nAcknowledge it may be partially relevant. Do not skip it entirely.`;

  const decisionNote = retrieval.matchedDecisions.length
    ? `\nMatched decisions:\n${retrieval.matchedDecisions.map(d => `- ${d}`).join("\n")}`
    : "";
  const riskNote = retrieval.matchedRisks.length
    ? `\nMatched risks:\n${retrieval.matchedRisks.map(r => `- ${r}`).join("\n")}`
    : "";

  return `\n\n--- PROJECT MEMORY RETRIEVAL ---
Confidence: ${retrieval.memoryConfidence}
Memory age: ${retrieval.memoryAge}
${decisionNote}${riskNote}

${confidenceInstruction}
Do NOT search the web. Answer from project memory first.
--- END MEMORY RETRIEVAL ---`;
}

// runConstitutionAnalysis — calls /api/constitution. Returns analysis + governanceUpdate. Updated v1.14.
async function runConstitutionAnalysis(
  project: ProjectState,
  message: string,
  betaPassword: string,
  baseUrl: string
): Promise<{ analysis: ConstitutionAnalysis; governanceUpdate: { projectType: string; governanceRiskLevel: string; riskDomains: string[] } } | null> {
  if (!project.mission || !message) return null;
  try {
    const response = await fetch(`${baseUrl}/api/constitution`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project, message, betaPassword })
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data.analysis) return null;
    return {
      analysis: data.analysis,
      governanceUpdate: data.governanceUpdate || { projectType: "", governanceRiskLevel: "", riskDomains: [] }
    };
  } catch {
    return null;
  }
}

// isMemoryFresh — returns true if memory age is within the freshness threshold. Updated v1.14.4.
// Fix: "unknown" now returns false — memories without timestamps should not claim routing authority.
function isMemoryFresh(memoryAge: string): boolean {
  if (memoryAge === "just now") return true;
  if (memoryAge === "unknown") return false; // fixed v1.14.4: was true
  const match = memoryAge.match(/^(\d+)\s+(minute|hour|day|month)/);
  if (!match) return false;
  const value = parseInt(match[1]);
  const unit = match[2];
  if (unit === "month") return value < 1;
  if (unit === "day") return value <= 30;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const betaPasswordRequired = process.env.BETA_PASSWORD;
    const body = await req.json();

    if (betaPasswordRequired && body?.betaPassword !== betaPasswordRequired) {
      return NextResponse.json({ error: "Invalid beta password." }, { status: 401 });
    }

    const message = String(body?.message || "").trim();
    const attachments: Attachment[] = Array.isArray(body?.attachments) ? body.attachments : [];

    if (!message && attachments.length === 0) {
      return NextResponse.json({ error: "Message or attachment required." }, { status: 400 });
    }

    const history: HistoryMessage[] = Array.isArray(body?.history) ? body.history.slice(-8) : [];
    const project: ProjectState = normalizeProjectState(body?.project || {}, defaultProjectState);
    const now = new Date().toISOString();
    const baseUrl = `${req.nextUrl.protocol}//${req.nextUrl.host}`;

    // LAYER 1: Semantic memory retrieval — always runs first
    const memoryRetrieval = await semanticMemoryCheck(message, project, history);
    const { memoryHit, memoryConfidence, memoryAge } = memoryRetrieval;

    // MEMORY-FIRST ROUTING — Added v1.14.1
    // High confidence + fresh memory → skip constitution and search entirely.
    const memoryAuthority = memoryHit
      && memoryConfidence === "high"
      && isMemoryFresh(memoryAge);

    // Parallelized: search intent + constitution run concurrently when memory has no authority.
    // Both are independent — neither depends on the other's result. Updated v1.14.4.
    let searchIntent: SearchIntent;
    let constitutionResult: Awaited<ReturnType<typeof runConstitutionAnalysis>>;

    if (memoryAuthority) {
      searchIntent = "none";
      constitutionResult = null;
    } else {
      [searchIntent, constitutionResult] = await Promise.all([
        classifySearchIntent(message, project, memoryHit),
        runConstitutionAnalysis(project, message, body?.betaPassword || "", baseUrl)
      ]);
    }

    const enableSearch = searchIntent !== "none";
    const constitutionAnalysis = constitutionResult?.analysis ?? null;

    // Build system prompt — memory-authority path uses base prompt only
    let systemPrompt: string;
    if (!memoryAuthority && constitutionAnalysis && project.mission) {
      const signals: ConstitutionSignals = {
        missionAlignment: constitutionAnalysis.missionAlignment,
        scopeDrift: constitutionAnalysis.scopeDrift,
        evidenceLevel: constitutionAnalysis.evidenceLevel,
        governanceProfile: constitutionAnalysis.governanceProfile
      };
      systemPrompt = buildJarvisSystemPromptWithConstitution(project, signals);
    } else {
      systemPrompt = buildJarvisSystemPrompt(project);
    }

    // Inject memory retrieval instruction if hit
    const memoryNote = buildMemoryNote(memoryRetrieval);
    if (memoryNote) systemPrompt += memoryNote;

    // Add search context if web search enabled
    if (enableSearch) {
      const missionLine = project.mission
        ? `Project mission: ${project.mission}\n`
        : "";
      systemPrompt += `\n\n--- SEARCH CONTEXT ---
When performing web searches, be specific and current.
${missionLine}Search intent: ${searchIntent}
${project.mission ? "Frame searches around the specific project context, not generic queries." : "Answer the question directly from search results."}
After searching, label any facts found as externally verified in your response.
--- END SEARCH CONTEXT ---`;
    }

    const jarvisMessages = [
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: buildUserContent(message, attachments) }
    ];

    // LAYER 3: Agentic Claude loop with optional web search
    const { reply, searchUsed } = await callAnthropicAgentLoop(jarvisMessages, systemPrompt, 1000, enableSearch);

    // State update — note search usage and persist governance profile
    let updatedProject = project;
    try {
      const stateUpdateMessage = searchUsed
        ? `${message}\n\n[Note: Web search was used. Any facts from search results should be labeled as externally_verified evidence.]`
        : message || "[File attached]";

      const stateJson = await callAnthropic(
        [{ role: "user", content: buildProjectStateUpdatePrompt(project, stateUpdateMessage, reply, now) }],
        "You are a strict JSON updater. Return only valid JSON.",
        700
      );
      updatedProject = normalizeProjectState(parseJsonObject(stateJson), project);

      // Persist governance profile from constitution analysis — only overwrite if project state is empty
      if (constitutionResult?.governanceUpdate) {
        const gu = constitutionResult.governanceUpdate;
        if (!updatedProject.projectType && gu.projectType) {
          updatedProject = { ...updatedProject, projectType: gu.projectType };
        }
        if (!updatedProject.governanceRiskLevel && gu.governanceRiskLevel) {
          updatedProject = {
            ...updatedProject,
            governanceRiskLevel: gu.governanceRiskLevel as ProjectState["governanceRiskLevel"]
          };
        }
        // Merge riskDomains — add new domains, never remove existing ones
        if (gu.riskDomains?.length) {
          const existing = new Set(updatedProject.riskDomains || []);
          gu.riskDomains.forEach((d: string) => existing.add(d));
          updatedProject = { ...updatedProject, riskDomains: Array.from(existing) };
        }
      }
    } catch {
      updatedProject = project;
    }

    return NextResponse.json({
      reply,
      project: updatedProject,
      constitutionAnalysis: constitutionAnalysis ?? null,
      searchUsed,
      searchIntent,
      memoryHit: memoryRetrieval.memoryHit,
      memorySource: memoryRetrieval.memorySource,
      memoryContent: memoryRetrieval.memoryContent,
      memoryConfidence: memoryRetrieval.memoryConfidence,
      memoryAge: memoryRetrieval.memoryAge
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown server error." },
      { status: 500 }
    );
  }
}
