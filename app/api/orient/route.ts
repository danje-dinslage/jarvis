// API: /api/orient
// Generates a returning-user orientation from project state.
// Called on project load (import or localStorage resume) when project is initialized.
// Returns: { orientation: string }
// Added: v1.3. Updated v1.14.4 — uses shared callAnthropicText.

import { NextRequest, NextResponse } from "next/server";
import {
  buildOrientationPrompt,
  defaultProjectState,
  normalizeProjectState
} from "@/lib/jarvis";
import { callAnthropicText } from "@/lib/api";

export const runtime = "nodejs";

async function callAnthropic(prompt: string, maxTokens = 400) {
  return callAnthropicText([{ role: "user", content: prompt }], "You are Jarvis, an AI project navigator.", maxTokens);
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
