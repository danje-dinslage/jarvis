// lib/api.ts
// Shared Anthropic API utilities. Extracted v1.14.4 — was duplicated across all three route files.

export const getApiKey = () => {
  const k = process.env.ANTHROPIC_API_KEY;
  if (!k) throw new Error("ANTHROPIC_API_KEY is not configured.");
  return k;
};

export const getModel = () => process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";

// callAnthropicText — simple single-turn text call. No tools.
export async function callAnthropicText(
  messages: any[],
  system: string,
  maxTokens = 900
): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": getApiKey(),
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({ model: getModel(), max_tokens: maxTokens, system, messages })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || "Claude request failed.");
  const text = data?.content?.[0]?.text;
  if (typeof text !== "string") throw new Error("Unexpected response from Claude.");
  return text;
}
