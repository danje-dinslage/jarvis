import { NextResponse } from "next/server";
import { buildJarvisSystemPrompt, defaultProjectState, type ProjectState } from "@/lib/jarvis";

export const runtime = "nodejs";

type ChatMessage = { role: "user" | "assistant"; content: string };

type RequestBody = {
  message: string;
  history?: ChatMessage[];
  project?: ProjectState;
  betaPassword?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;

    if (process.env.JARVIS_BETA_PASSWORD) {
      if (body.betaPassword !== process.env.JARVIS_BETA_PASSWORD) {
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

    const project = body.project ?? defaultProjectState;
    const history = (body.history ?? []).slice(-8).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const messages = [
      ...history,
      { role: "user" as const, content: body.message },
    ];

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
        max_tokens: 900,
        temperature: 0.3,
        system: buildJarvisSystemPrompt(project),
        messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: `Claude API error: ${errorText}` }, { status: response.status });
    }

    const data = await response.json();
    const text = data?.content?.map((part: any) => part?.text).filter(Boolean).join("\n") || "No response text returned.";

    return NextResponse.json({ reply: text });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
