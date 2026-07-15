import type { AdviceContext, AiConfig, GridAdvice } from "./types.js";
import { adviseWithAnthropic } from "./anthropic.js";
import { adviseWithDeepseek } from "./openai-compatible.js";
import { adviseWithGemini } from "./gemini.js";

/**
 * Provider-agnostic grid advisor. Dispatches to the configured LLM provider;
 * every provider returns the same validated {@link GridAdvice} shape.
 */
export class AiAdvisor {
  constructor(private readonly config: AiConfig) {}

  get provider() {
    return this.config.provider;
  }

  async advise(ctx: AdviceContext): Promise<GridAdvice> {
    switch (this.config.provider) {
      case "anthropic":
        return adviseWithAnthropic(this.config, ctx);
      case "deepseek":
        return adviseWithDeepseek(this.config, ctx);
      case "gemini":
        return adviseWithGemini(this.config, ctx);
    }
  }
}
