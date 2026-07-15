import { Hono } from "hono";
import { z } from "zod";
import type { AppContainer } from "../app.js";

const AdviceRequestSchema = z.object({
  symbol: z.string().min(1),
  markPrice: z.number().finite().positive(),
  closes: z.array(z.number().finite().positive()).min(10),
});

/** /v1/ai — LLM-backed grid parameter advice (optional; requires GRIDBOT_AI_*). */
export function aiRoutes(c: AppContainer): Hono {
  const app = new Hono();

  app.get("/status", (ctx) =>
    ctx.json({ enabled: Boolean(c.advisor), provider: c.advisor?.provider ?? null }),
  );

  app.post("/advise", async (ctx) => {
    if (!c.advisor) {
      return ctx.json(
        {
          error: {
            code: "ai_disabled",
            message: "no AI provider configured (set GRIDBOT_AI_PROVIDER + GRIDBOT_AI_API_KEY)",
          },
        },
        400,
      );
    }
    const body = await ctx.req.json().catch(() => null);
    const parsed = AdviceRequestSchema.safeParse(body);
    if (!parsed.success) {
      return ctx.json(
        {
          error: {
            code: "invalid_request",
            message: "invalid advice request",
            details: parsed.error.flatten(),
          },
        },
        400,
      );
    }
    try {
      const advice = await c.advisor.advise(parsed.data);
      return ctx.json(advice);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      c.logger.error({ err }, "ai advise failed");
      return ctx.json({ error: { code: "advise_failed", message } }, 502);
    }
  });

  return app;
}
