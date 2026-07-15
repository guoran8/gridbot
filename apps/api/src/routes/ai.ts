import type { BotBrief } from "@gridbot/services";
import type { BotSnapshot } from "@gridbot/shared";
import { type Context, Hono } from "hono";
import { z } from "zod";
import type { AppContainer } from "../app.js";

const AdviceRequestSchema = z.object({
  symbol: z.string().min(1),
  markPrice: z.number().finite().positive(),
  closes: z.array(z.number().finite().positive()).default([]),
});

const ChatSchema = z.object({ message: z.string().min(1) });
const MarketSchema = z.object({
  symbol: z.string().min(1),
  closes: z.array(z.number().finite().positive()).min(2),
});

/** Compact per-bot brief for the AI capabilities. */
function toBrief(b: BotSnapshot): BotBrief {
  return {
    id: b.id,
    exchange: b.config.exchange,
    symbol: b.config.symbol,
    mode: b.config.mode,
    status: b.status,
    markPrice: b.markPrice,
    lowerPrice: b.config.lowerPrice,
    upperPrice: b.config.upperPrice,
    netPnl: b.pnl.netPnl,
    volumeUsd: b.pnl.volumeUsd,
    position: b.position?.netQty ?? 0,
    outOfRange:
      b.markPrice > 0 && (b.markPrice < b.config.lowerPrice || b.markPrice > b.config.upperPrice),
  };
}

/** /v1/ai — grid advice + the five assistant capabilities (advisory only). */
export function aiRoutes(c: AppContainer): Hono {
  const app = new Hono();

  app.get("/status", (ctx) =>
    ctx.json({ enabled: Boolean(c.advisor), provider: c.advisor?.provider ?? null }),
  );

  app.post("/advise", async (ctx) => {
    if (!c.advisor)
      return ctx.json(
        { error: { code: "ai_disabled", message: "no AI provider configured" } },
        400,
      );
    const parsed = AdviceRequestSchema.safeParse(await ctx.req.json().catch(() => null));
    if (!parsed.success)
      return ctx.json(
        { error: { code: "invalid_request", message: "invalid advice request" } },
        400,
      );
    try {
      return ctx.json(await c.advisor.advise(parsed.data));
    } catch (err) {
      return aiError(ctx, c, err);
    }
  });

  app.post("/chat", async (ctx) => {
    if (!c.advisor)
      return ctx.json(
        { error: { code: "ai_disabled", message: "no AI provider configured" } },
        400,
      );
    const parsed = ChatSchema.safeParse(await ctx.req.json().catch(() => null));
    if (!parsed.success)
      return ctx.json({ error: { code: "invalid_request", message: "message required" } }, 400);
    try {
      const reply = await c.advisor.chat(parsed.data.message, c.manager.snapshots().map(toBrief));
      return ctx.json({ reply });
    } catch (err) {
      return aiError(ctx, c, err);
    }
  });

  app.post("/sentinel", async (ctx) => {
    if (!c.advisor)
      return ctx.json(
        { error: { code: "ai_disabled", message: "no AI provider configured" } },
        400,
      );
    try {
      return ctx.json(await c.advisor.sentinel(c.manager.snapshots().map(toBrief)));
    } catch (err) {
      return aiError(ctx, c, err);
    }
  });

  app.post("/report", async (ctx) => {
    if (!c.advisor)
      return ctx.json(
        { error: { code: "ai_disabled", message: "no AI provider configured" } },
        400,
      );
    try {
      return ctx.json({ report: await c.advisor.dailyReport(c.manager.snapshots().map(toBrief)) });
    } catch (err) {
      return aiError(ctx, c, err);
    }
  });

  app.post("/market", async (ctx) => {
    if (!c.advisor)
      return ctx.json(
        { error: { code: "ai_disabled", message: "no AI provider configured" } },
        400,
      );
    const parsed = MarketSchema.safeParse(await ctx.req.json().catch(() => null));
    if (!parsed.success)
      return ctx.json(
        { error: { code: "invalid_request", message: "symbol + closes required" } },
        400,
      );
    try {
      return ctx.json({
        analysis: await c.advisor.marketAnalysis(parsed.data.symbol, parsed.data.closes),
      });
    } catch (err) {
      return aiError(ctx, c, err);
    }
  });

  return app;
}

function aiError(ctx: Context, c: AppContainer, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  c.logger.error({ err }, "ai capability failed");
  return ctx.json({ error: { code: "ai_failed", message } }, 502);
}
