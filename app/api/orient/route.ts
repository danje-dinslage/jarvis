// API: /api/orient
// Generates a returning-user orientation from project state.
// Called on project load (import or localStorage resume) when project is initialized.
// Returns: { orientation: string }
// Added: v1.3

import { NextRequest, NextResponse } from "next/server";
import {
  buildOrientationPrompt,
  defaultProjectState,
  normalizeProjectState
} from "@/lib/jarvis";

export const runtime = "nodejs";

async function callAnthropic(prompt: string, maxTokens = 400) {
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
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }]
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || "Claude request failed.");

  const text = data?.content?.[0]?.text;
  if (typeof text !== "string") throw new Error("Claude returned an unexpected response.");

  return text;
}

export async function POST(req: NextRequest) {
  try {
    const betaPasswordRequired = process.env.BETA_PASSWORD;
    const body = await req.json();

    if (betaPasswordRequired && body?.betaPassword !== betaPasswordRequired) {
      return NextResponse.json({ error: "Invalid beta password." }, { status: 401 });
    }

    const project = normalizeProjectState(body?.project || {}, defaultProjectState);

    // Only orient if mission exists — no point orienting an empty project
    if (!project.mission) {
      return NextResponse.json({ orientation: null });
    }

    const orientation = await callAnthropic(buildOrientationPrompt(project), 400);

    return NextResponse.json({ orientation });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown server error." },
      { status: 500 }
    );
  }
}
