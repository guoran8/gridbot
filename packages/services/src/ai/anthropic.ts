import Anthropic from "@anthropic-ai/sdk";
import type { AdviceContext, AiConfig, GridAdvice } from "./types.js";
import { GridAdviceSchema } from "./types.js";
import { buildAdvicePrompt } from "./prompt.js";

/** Default model — the latest, most capable Claude Opus. */
const DEFAULT_MODEL = "claude-opus-4-8";

/** JSON schema handed to the API's structured-output mode (validated by zod after). */
const ADVICE_JSON_SCHEMA = {
  type: "object",
  properties: {
    mode: { type: "string", enum: ["neutral", "long", "short"] },
    lowerPrice: { type: "number" },
    upperPrice: { type: "number" },
    gridCount: { type: "integer" },
    rationale: { type: "string" },
  },
  required: ["mode", "lowerPrice", "upperPrice", "gridCount", "rationale"],
  additionalProperties: false,
} as const;

/**
 * Claude-backed advisor using the official Anthropic SDK. Uses structured
 * outputs (`output_config.format`) so the model emits schema-shaped JSON, then
 * validates it against the grid advice schema.
 */
export async function adviseWithAnthropic(
  config: AiConfig,
  ctx: AdviceContext,
): Promise<GridAdvice> {
  const client = new Anthropic({ apiKey: config.apiKey, fetch: config.fetchImpl });
  const { system, user } = buildAdvicePrompt(ctx);

  const response = await client.messages.create({
    model: config.model ?? DEFAULT_MODEL,
    max_tokens: 1024,
    system,
    messages: [{ role: "user", content: user }],
    output_config: { format: { type: "json_schema", schema: ADVICE_JSON_SCHEMA } },
  });

  const text = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text;
  if (!text) throw new Error("anthropic advisor returned no text output");
  return GridAdviceSchema.parse(JSON.parse(text));
}
