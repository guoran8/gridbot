import Anthropic from "@anthropic-ai/sdk";
import type { AiConfig } from "./types.js";

/**
 * Provider-agnostic plain-text completion (no schema). Powers the conversational
 * + report capabilities. Structured grid advice stays in advisor.ts.
 */
export async function completeText(
  config: AiConfig,
  system: string,
  user: string,
  maxTokens = 1024,
): Promise<string> {
  switch (config.provider) {
    case "anthropic":
      return completeAnthropic(config, system, user, maxTokens);
    case "deepseek":
      return completeDeepseek(config, system, user, maxTokens);
    case "gemini":
      return completeGemini(config, system, user, maxTokens);
  }
}

async function completeAnthropic(
  config: AiConfig,
  system: string,
  user: string,
  maxTokens: number,
): Promise<string> {
  const client = new Anthropic({ apiKey: config.apiKey, fetch: config.fetchImpl });
  const response = await client.messages.create({
    model: config.model ?? "claude-opus-4-8",
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

async function completeDeepseek(
  config: AiConfig,
  system: string,
  user: string,
  maxTokens: number,
): Promise<string> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const res = await fetchImpl("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({
      model: config.model ?? "deepseek-chat",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: maxTokens,
    }),
  });
  if (!res.ok) throw new Error(`deepseek complete failed: ${res.status}`);
  const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return (body.choices?.[0]?.message?.content ?? "").trim();
}

async function completeGemini(
  config: AiConfig,
  system: string,
  user: string,
  maxTokens: number,
): Promise<string> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const model = config.model ?? "gemini-2.5-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`;
  const res = await fetchImpl(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  });
  if (!res.ok) throw new Error(`gemini complete failed: ${res.status}`);
  const body = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return (body.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
}
