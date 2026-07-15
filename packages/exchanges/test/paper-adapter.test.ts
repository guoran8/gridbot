import { describe, expect, it } from "vitest";
import { PaperAdapter } from "../src/paper/paper-adapter.js";
import type { VenueFill } from "../src/types.js";

function makeAdapter() {
  return new PaperAdapter({
    startPrice: 100,
    tickMs: 0, // manual stepping for determinism
    seed: 42,
    volatility: 0.01,
    feeSchedule: { makerRate: 0.0002, takerRate: 0.0005 },
  });
}

describe("PaperAdapter", () => {
  it("fills a resting buy when the mark crosses down to it, charging maker fee", async () => {
    const adapter = makeAdapter();
    const fills: VenueFill[] = [];
    adapter.watchFills("BTC-USD", (f) => fills.push(f));

    // Buy above the current mark (100) fills on the next step (mark <= price).
    await adapter.placeOrder({
      symbol: "BTC-USD",
      side: "buy",
      price: 105,
      size: 2,
      clientOrderId: "c1",
    });
    adapter.stepOnce();

    expect(fills).toHaveLength(1);
    expect(fills[0]!.side).toBe("buy");
    expect(fills[0]!.price).toBe(105);
    expect(fills[0]!.clientOrderId).toBe("c1");
    expect(fills[0]!.fee).toBeCloseTo(105 * 2 * 0.0002); // 0.042
  });

  it("does not fill a resting order that has not been crossed", async () => {
    const adapter = makeAdapter();
    const fills: VenueFill[] = [];
    adapter.watchFills("BTC-USD", (f) => fills.push(f));

    // A sell far above the mark should not fill on a single small step.
    await adapter.placeOrder({
      symbol: "BTC-USD",
      side: "sell",
      price: 200,
      size: 1,
      clientOrderId: "c2",
    });
    adapter.stepOnce();
    expect(fills).toHaveLength(0);
    expect(await adapter.getOpenOrders("BTC-USD")).toHaveLength(1);
  });

  it("removes a cancelled order so it never fills", async () => {
    const adapter = makeAdapter();
    const fills: VenueFill[] = [];
    adapter.watchFills("BTC-USD", (f) => fills.push(f));

    const order = await adapter.placeOrder({
      symbol: "BTC-USD",
      side: "buy",
      price: 105,
      size: 1,
      clientOrderId: "c3",
    });
    await adapter.cancelOrder("BTC-USD", order.exchangeOrderId);
    adapter.stepOnce();
    expect(fills).toHaveLength(0);
  });

  it("eventually fills both sides of a tight grid as price oscillates", async () => {
    const adapter = makeAdapter();
    const fills: VenueFill[] = [];
    adapter.watchFills("BTC-USD", (f) => fills.push(f));

    await adapter.placeOrder({
      symbol: "BTC-USD",
      side: "buy",
      price: 99,
      size: 1,
      clientOrderId: "b",
    });
    await adapter.placeOrder({
      symbol: "BTC-USD",
      side: "sell",
      price: 101,
      size: 1,
      clientOrderId: "s",
    });
    for (let i = 0; i < 500; i++) adapter.stepOnce();

    const sides = new Set(fills.map((f) => f.side));
    expect(sides.has("buy")).toBe(true);
    expect(sides.has("sell")).toBe(true);
  });

  it("deducts fees from the simulated balance", async () => {
    const adapter = new PaperAdapter({
      startPrice: 100,
      tickMs: 0,
      seed: 42,
      startBalanceUsd: 1000,
    });
    await adapter.placeOrder({
      symbol: "BTC-USD",
      side: "buy",
      price: 105,
      size: 10,
      clientOrderId: "x",
    });
    adapter.stepOnce();
    // fee = 105 * 10 * 0.0002 = 0.21
    expect(await adapter.getBalanceUsd()).toBeCloseTo(1000 - 0.21);
  });
});
