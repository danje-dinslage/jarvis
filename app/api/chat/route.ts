import { NextRequest, NextResponse } from "next/server";
import {
  buildJarvisSystemPrompt,
  buildProjectStateUpdatePrompt,
  defaultProjectState,
  normalizeProjectState,
  type ProjectState
} from "@/lib/jarvis";

export const runtime = "nodejs";

type HistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

// Attachment from client — added v1.9
type Attachment = {
  name: string;
  type: "image" | "text";
  mediaType: string;
  data: string;
};

async function callAnthropic(messages: any[], system: string, maxTokens = 900) {
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
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || "Claude request failed.");
  const text = data?.content?.[0]?.text;
  if (typeof text !== "string") throw new Error("Claude returned an unexpected response.");
  return text;
}

function parseJsonObject(text: string) {
  const trimmed = text.trim();
  try { return JSON.parse(trimmed); } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON object returned.");
    return JSON.parse(match[0]);
  }
}

// buildUserContent — constructs Claude content array for a user message with optional attachments
function buildUserContent(message: string, attachments: Attachment[]): any[] | string {
  if (!attachments.length) return message;

  const blocks: any[] = [];

  // Add text block first if there's a message
  if (message.trim()) {
    blocks.push({ type: "text", text: message });
  }

  for (const att of attachments) {
    if (att.type === "image") {
      blocks.push({
        type: "image",
        source: { type: "base64", media_type: att.mediaType, data: att.data }
      });
    } else {
      // Text files: include as a text block with filename context
      blocks.push({
        type: "text",
        text: `[Attached file: ${att.name}]\n\n${att.data}`
      });
    }
  }

  return blocks;
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

    // Build message array — history as plain text, current message with attachments
    const jarvisMessages = [
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: buildUserContent(message, attachments) }
    ];

    const reply = await callAnthropic(jarvisMessages, buildJarvisSystemPrompt(project), 1000);

    let updatedProject = project;
    try {
      const stateJson = await callAnthropic(
        [{ role: "user", content: buildProjectStateUpdatePrompt(project, message || "[File attached — see conversation]", reply, now) }],
        "You are a strict JSON updater. Return only valid JSON.",
        700
      );
      updatedProject = normalizeProjectState(parseJsonObject(stateJson), project);
    } catch {
      updatedProject = project;
    }

    return NextResponse.json({ reply, project: updatedProject });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown server error." },
      { status: 500 }
    );
  }
}


export const runtime = "nodejs";

type Message = {
  role: "user" | "assistant";
  content: string;
};

async function callAnthropic(messages: any[], system: string, maxTokens = 900) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }

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
      system,
      messages
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "Claude request failed.");
  }

  const text = data?.content?.[0]?.text;
  if (typeof text !== "string") {
    throw new Error("Claude returned an unexpected response.");
  }

  return text;
}

function parseJsonObject(text: string) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON object returned.");
    return JSON.parse(match[0]);
  }
}
