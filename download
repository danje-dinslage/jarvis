import { NextResponse } from "next/server";
import { buildJarvisSystemPrompt, buildProjectStateUpdatePrompt, defaultProjectState, normalizeProjectState, type ProjectState } from "@/lib/jarvis";

export const runtime = "nodejs";

type ChatMessage = { role: "user" | "assistant"; content: string };

type RequestBody = {
  message: string;
  history?: ChatMessage[];
  project?: ProjectState;
  betaPassword?: string;
};

function extractText(data: any) {
  return data?.content?.map((part: any) => part?.text).filter(Boolean).join("\n") || "";
}

async function callClaude(apiKey: string, body: any) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error: ${errorText}`);
  }

  return response.json();
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;

    const configuredPassword = process.env.JARVIS_BETA_PASSWORD || process.env.BETA_PASSWORD;
    if (configuredPassword) {
      if (body.betaPassword !== configuredPassword) {
        return NextResponse.json({ error: "Invalid beta password." }, { status: 401 });
      }
    }

    if (!body.message?.trim()) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured on the server." }, { status: 500 });
    }

    const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";
    const project = normalizeProjectState(body.project ?? defaultProjectState, defaultProjectState);
    const history = (body.history ?? []).slice(-8).map((m) => ({ role: m.role, content: m.content }));

    const replyData = await callClaude(apiKey, {
      model,
      max_tokens: 900,
      temperature: 0.35,
      system: buildJarvisSystemPrompt(project),
      messages: [...history, { role: "user", content: body.message }],
    });

    const reply = extractText(replyData) || "No response text returned.";

    let updatedProject = project;
    try {
      const stateData = await callClaude(apiKey, {
        model,
        max_tokens: 700,
        temperature: 0,
        system: "You are a precise JSON state updater. Return only valid JSON. No markdown. No commentary.",
        messages: [
          {
            role: "user",
            content: buildProjectStateUpdatePrompt(project, body.message, reply),
          },
        ],
      });

      const stateText = extractText(stateData).trim();
      const parsed = JSON.parse(stateText);
      updatedProject = normalizeProjectState(parsed, project);
    } catch (stateError) {
      // If state extraction fails, keep the chat working and preserve current project state.
      updatedProject = project;
    }

    return NextResponse.json({ reply, project: updatedProject });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
