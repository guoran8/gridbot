import type { LiveExchangeId } from "@gridbot/shared";
import { Hono } from "hono";
import type { AppContainer } from "../app.js";
import { buildLiveAdapter, configuredVenues } from "../venues/build-adapter.js";

const LIVE_IDS: LiveExchangeId[] = ["extended", "decibel", "risex"];

/** Per-venue gating/config status derived from config alone (no network). */
function venueStatus(c: AppContainer) {
  const configured = new Set(configuredVenues(c.config));
  return LIVE_IDS.map((id) => {
    let liveTradingEnabled = false;
    if (id === "extended") liveTradingEnabled = c.config.extended?.allowUnverifiedSigning ?? false;
    if (id === "decibel") liveTradingEnabled = c.config.decibel?.allowLive ?? false;
    if (id === "risex") liveTradingEnabled = c.config.risex?.allowLive ?? false;
    return {
      id,
      configured: configured.has(id),
      network: "testnet" as const,
      liveTradingEnabled,
    };
  });
}

/** /v1/venues — read-only live venue status + on-demand account/mark probe. */
export function venuesRoutes(c: AppContainer): Hono {
  const app = new Hono();

  app.get("/", (ctx) => ctx.json({ venues: venueStatus(c) }));

  // Probe a configured venue's read paths: balance + a symbol's mark price.
  // Never places orders — pure reads, safe regardless of the live-trading gate.
  app.get("/:id/probe", async (ctx) => {
    const id = ctx.req.param("id") as LiveExchangeId;
    if (!LIVE_IDS.includes(id)) {
      return ctx.json({ error: { code: "unknown_venue", message: "unknown venue" } }, 404);
    }
    if (!configuredVenues(c.config).includes(id)) {
      return ctx.json(
        { error: { code: "not_configured", message: `${id} is not configured` } },
        400,
      );
    }
    const symbol = ctx.req.query("symbol");

    let adapter;
    try {
      adapter = buildLiveAdapter(c.config, id);
      await adapter.connect();
      const balanceUsd = await adapter.getBalanceUsd().catch(() => null);
      const markPrice = symbol ? await adapter.getMarkPrice(symbol).catch(() => null) : null;
      const openOrders = symbol ? await adapter.getOpenOrders(symbol).catch(() => []) : [];
      return ctx.json({ id, symbol: symbol ?? null, balanceUsd, markPrice, openOrders });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      c.logger.warn({ err, venue: id }, "venue probe failed");
      return ctx.json({ error: { code: "probe_failed", message } }, 502);
    } finally {
      await adapter?.disconnect().catch(() => {});
    }
  });

  return app;
}
