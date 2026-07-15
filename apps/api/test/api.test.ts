import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { GridConfig } from "@gridbot/shared";
import { createApp, createContainer, type AppContainer } from "../src/app.js";
import { loadConfig } from "../src/config.js";

let container: AppContainer;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  const config = loadConfig({
    GRIDBOT_DB_PATH: ":memory:",
    GRIDBOT_RECONCILE_MS: "0",
  } as NodeJS.ProcessEnv);
  container = createContainer(config);
  app = createApp(container);
});

afterEach(async () => {
  await container.manager.shutdown();
  container.close();
});

const paperConfig: GridConfig = {
  exchange: "paper",
  symbol: "BTC-USD",
  mode: "neutral",
  tradingMode: "paper",
  lowerPrice: 90,
  upperPrice: 110,
  gridCount: 21,
  spacing: "arithmetic",
  perGridSizeUsd: 100,
  leverage: 1,
  recenterOnBreakout: false,
};

describe("gridbot API", () => {
  it("health endpoint reports ok", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok" });
  });

  it("rejects an invalid grid config", async () => {
    const res = await app.request("/v1/bots", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...paperConfig, upperPrice: 50 }),
    });
    expect(res.status).toBe(400);
  });

  it("creates, lists, and controls a paper bot end to end", async () => {
    const createRes = await app.request("/v1/bots", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(paperConfig),
    });
    expect(createRes.status).toBe(201);
    const bot = (await createRes.json()) as { id: string; status: string };
    expect(bot.status).toBe("idle");

    const listRes = await app.request("/v1/bots");
    expect((await listRes.json()).bots).toHaveLength(1);

    const startRes = await app.request(`/v1/bots/${bot.id}/start`, { method: "POST" });
    expect(startRes.status).toBe(200);
    expect((await startRes.json()).status).toBe("running");

    // After starting, the bot should have placed resting orders on both sides.
    const detail = await (await app.request(`/v1/bots/${bot.id}`)).json();
    expect(detail.openOrders.length).toBeGreaterThan(0);
    expect(detail.openOrders.some((o: { side: string }) => o.side === "buy")).toBe(true);
    expect(detail.openOrders.some((o: { side: string }) => o.side === "sell")).toBe(true);

    const stopRes = await app.request(`/v1/bots/${bot.id}/stop`, { method: "POST" });
    expect((await stopRes.json()).status).toBe("idle");
  });

  it("accumulates fills and volume as the paper price oscillates", async () => {
    const bot = (await (
      await app.request("/v1/bots", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(paperConfig),
      })
    ).json()) as { id: string };
    await app.request(`/v1/bots/${bot.id}/start`, { method: "POST" });

    // Drive the paper adapter deterministically via the manager's runner.
    const runner = getRunner(container, bot.id);
    const adapter = getAdapter(runner);
    for (let i = 0; i < 400; i++) {
      adapter.stepOnce();
      await runner.reconcileOnce();
    }

    const fills = (await (await app.request(`/v1/bots/${bot.id}/fills`)).json()).fills;
    expect(fills.length).toBeGreaterThan(0);

    const snap = await (await app.request(`/v1/bots/${bot.id}`)).json();
    expect(snap.pnl.volumeUsd).toBeGreaterThan(0);
    expect(snap.pnl.feesPaid).toBeGreaterThan(0);
  });

  it("deletes a bot", async () => {
    const bot = (await (
      await app.request("/v1/bots", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(paperConfig),
      })
    ).json()) as { id: string };
    const del = await app.request(`/v1/bots/${bot.id}`, { method: "DELETE" });
    expect(del.status).toBe(204);
    const listRes = await app.request("/v1/bots");
    expect((await listRes.json()).bots).toHaveLength(0);
  });
});

// --- test-only accessors into private runner internals ---------------------

interface RunnerLike {
  reconcileOnce(): Promise<void>;
}
function getRunner(c: AppContainer, id: string): RunnerLike {
  // @ts-expect-error reaching into manager internals for a white-box test
  return c.manager.runners.get(id);
}
function getAdapter(runner: RunnerLike): { stepOnce(): number } {
  // @ts-expect-error the paper adapter exposes stepOnce for deterministic tests
  return runner.adapter;
}
