import type { AdviceContext, AiConfig, GridAdvice } from "./types.js";
import { GridAdviceSchema } from "./types.js";
import { buildAdvicePrompt } from "./prompt.js";

const DEFAULT_MODEL = "gemini-2.5-flash";

/** Google Gemini advisor via the generativeLanguage REST API, JSON-constrained. */
export async function adviseWithGemini(config: AiConfig, ctx: AdviceContext): Promise<GridAdvice> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const model = config.model ?? DEFAULT_MODEL;
  const { system, user } = buildAdvicePrompt(ctx);

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`;
  const res = await fetchImpl(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            mode: { type: "string", enum: ["neutral", "long", "short"] },
            lowerPrice: { type: "number" },
            upperPrice: { type: "number" },
            gridCount: { type: "integer" },
            rationale: { type: "string" },
          },
          required: ["mode", "lowerPrice", "upperPrice", "gridCount", "rationale"],
        },
      },
    }),
  });
  if (!res.ok)
    throw new Error(`gemini advisor failed: ${res.status} ${await res.text().catch(() => "")}`);

  const body = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const content = body.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error("gemini advisor returned no content");
  return GridAdviceSchema.parse(JSON.parse(content));
}
