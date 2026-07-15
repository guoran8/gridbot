import type { AdviceContext, AiConfig, GridAdvice } from "./types.js";
import { GridAdviceSchema } from "./types.js";
import { buildAdvicePrompt } from "./prompt.js";

const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";
const DEFAULT_MODEL = "deepseek-chat";

/**
 * DeepSeek advisor via its OpenAI-compatible chat/completions endpoint.
 * Requests JSON object mode and validates the reply against the grid schema.
 */
export async function adviseWithDeepseek(
  config: AiConfig,
  ctx: AdviceContext,
): Promise<GridAdvice> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const { system, user } = buildAdvicePrompt(ctx);
  const schemaHint =
    'Respond as JSON: {"mode":"neutral|long|short","lowerPrice":number,"upperPrice":number,"gridCount":integer,"rationale":string}';

  const res = await fetchImpl(DEEPSEEK_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model ?? DEFAULT_MODEL,
      messages: [
        { role: "system", content: `${system}\n${schemaHint}` },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1024,
    }),
  });
  if (!res.ok)
    throw new Error(`deepseek advisor failed: ${res.status} ${await res.text().catch(() => "")}`);

  const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error("deepseek advisor returned no content");
  return GridAdviceSchema.parse(JSON.parse(content));
}
