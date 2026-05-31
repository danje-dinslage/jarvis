import { NextRequest, NextResponse } from "next/server";
import {
  buildJarvisSystemPrompt,
  buildOrientationPrompt,
  buildProjectStateUpdatePrompt,
  defaultProjectState,
  normalizeProjectState,
  type ProjectState
} from "@/lib/jarvis";

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

export async function POST(req: NextRequest) {
  try {
    const betaPasswordRequired = process.env.BETA_PASSWORD;
    const body = await req.json();

    if (betaPasswordRequired && body?.betaPassword !== betaPasswordRequired) {
      return NextResponse.json({ error: "Invalid beta password." }, { status: 401 });
    }

    const message = String(body?.message || "").trim();
    if (!message) {
      return NextResponse.json({ error: "Message required." }, { status: 400 });
    }

    const history: Message[] = Array.isArray(body?.history) ? body.history.slice(-8) : [];
    const project: ProjectState = normalizeProjectState(body?.project || {}, defaultProjectState);

    const now = new Date().toISOString();

    const jarvisMessages = [
      ...history.map((m) => ({
        role: m.role,
        content: m.content
      })),
      {
        role: "user",
        content: message
      }
    ];

    const reply = await callAnthropic(jarvisMessages, buildJarvisSystemPrompt(project), 1000);

    let updatedProject = project;
    try {
      const stateJson = await callAnthropic(
        [
          {
            role: "user",
            content: buildProjectStateUpdatePrompt(project, message, reply, now)
          }
        ],
        "You are a strict JSON updater. Return only valid JSON.",
        700
      );

      updatedProject = normalizeProjectState(parseJsonObject(stateJson), project);
    } catch {
      updatedProject = project;
    }

    return NextResponse.json({
      reply,
      project: updatedProject
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown server error." },
      { status: 500 }
    );
  }
}
