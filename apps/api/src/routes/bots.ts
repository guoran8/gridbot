import { AdjustRangeSchema, CreateBotRequestSchema } from "@gridbot/shared";
import { Hono } from "hono";
import { z } from "zod";
import type { AppContainer } from "../app.js";
import { GridEconomicsError } from "../bot/manager.js";

const BotActionParam = z.enum(["start", "pause", "resume", "stop", "flatten", "recover"]);

/** /v1/bots — create, list, inspect, control, and delete grid bot instances. */
export function botsRoutes(c: AppContainer): Hono {
  const app = new Hono();

  app.get("/", (ctx) => ctx.json({ bots: c.manager.snapshots() }));

  app.post("/", async (ctx) => {
    const body = await ctx.req.json().catch(() => null);
    const parsed = CreateBotRequestSchema.safeParse(body);
    if (!parsed.success) {
      return ctx.json(
        {
          error: {
            code: "invalid_config",
            message: "invalid grid config",
            details: parsed.error.flatten(),
          },
        },
        400,
      );
    }
    try {
      const snapshot = c.manager.createBot(parsed.data);
      return ctx.json(snapshot, 201);
    } catch (err) {
      if (err instanceof GridEconomicsError) {
        return ctx.json({ error: { code: "uneconomic_grid", message: err.message } }, 400);
      }
      throw err;
    }
  });

  app.get("/:id", (ctx) => {
    const snap = c.manager.snapshot(ctx.req.param("id"));
    if (!snap) return ctx.json({ error: { code: "not_found", message: "bot not found" } }, 404);
    return ctx.json(snap);
  });

  app.delete("/:id", async (ctx) => {
    const id = ctx.req.param("id");
    if (!c.manager.has(id))
      return ctx.json({ error: { code: "not_found", message: "bot not found" } }, 404);
    await c.manager.deleteBot(id);
    return ctx.body(null, 204);
  });

  // Live range adjustment (body-carrying) — must precede the generic action route.
  app.post("/:id/adjust", async (ctx) => {
    const id = ctx.req.param("id");
    if (!c.manager.has(id))
      return ctx.json({ error: { code: "not_found", message: "bot not found" } }, 404);
    const body = await ctx.req.json().catch(() => null);
    const parsed = AdjustRangeSchema.safeParse(body);
    if (!parsed.success) {
      return ctx.json(
        {
          error: {
            code: "invalid_range",
            message: "invalid range",
            details: parsed.error.flatten(),
          },
        },
        400,
      );
    }
    if (parsed.data.upperPrice <= parsed.data.lowerPrice) {
      return ctx.json(
        { error: { code: "invalid_range", message: "upper must exceed lower" } },
        400,
      );
    }
    try {
      return ctx.json(await c.manager.adjustRange(id, parsed.data));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return ctx.json({ error: { code: "adjust_failed", message } }, 500);
    }
  });

  app.post("/:id/:action", async (ctx) => {
    const id = ctx.req.param("id");
    const action = BotActionParam.safeParse(ctx.req.param("action"));
    if (!action.success)
      return ctx.json({ error: { code: "invalid_action", message: "unknown action" } }, 400);
    if (!c.manager.has(id))
      return ctx.json({ error: { code: "not_found", message: "bot not found" } }, 404);
    try {
      const snap = await c.manager.control(id, action.data);
      return ctx.json(snap);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return ctx.json({ error: { code: "action_failed", message } }, 500);
    }
  });

  app.get("/:id/fills", (ctx) => {
    const id = ctx.req.param("id");
    return ctx.json({ fills: c.store.listFills(id) });
  });

  app.get("/:id/orders", (ctx) => {
    const id = ctx.req.param("id");
    return ctx.json({ orders: c.store.listOrders(id) });
  });

  return app;
}
