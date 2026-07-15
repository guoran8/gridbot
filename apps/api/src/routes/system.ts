import { Hono } from "hono";
import type { AppContainer } from "../app.js";

/** Health + logs endpoints. */
export function systemRoutes(c: AppContainer): Hono {
  const app = new Hono();

  app.get("/health", (ctx) => ctx.json({ status: "ok", bots: c.manager.snapshots().length }));

  app.get("/logs", (ctx) => {
    const limit = Number(ctx.req.query("limit") ?? 200);
    return ctx.json({ logs: c.store.listLogs(Number.isFinite(limit) ? limit : 200) });
  });

  return app;
}
