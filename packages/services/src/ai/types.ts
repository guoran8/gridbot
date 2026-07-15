import { z } from "zod";

export const AiProviderSchema = z.enum(["anthropic", "deepseek", "gemini"]);
export type AiProvider = z.infer<typeof AiProviderSchema>;

export interface AiConfig {
  provider: AiProvider;
  apiKey: string;
  /** Override the default model for the provider. */
  model?: string;
  fetchImpl?: typeof fetch;
}

/** Market context handed to the advisor. */
export interface AdviceContext {
  symbol: string;
  markPrice: number;
  /** Recent close prices, oldest first. */
  closes: number[];
}

/** The advisor's structured recommendation for a grid. */
export const GridAdviceSchema = z.object({
  mode: z.enum(["neutral", "long", "short"]),
  lowerPrice: z.number().positive(),
  upperPrice: z.number().positive(),
  gridCount: z.number().int().min(2).max(500),
  rationale: z.string(),
});
export type GridAdvice = z.infer<typeof GridAdviceSchema>;
