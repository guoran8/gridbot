import { describe, expect, it } from "vitest";
import {
  desiredOrders,
  initialSlots,
  isReduceOnly,
  minSpacingFraction,
  validateGridEconomics,
  worstCaseMarginUsd,
} from "../src/index.js";
import { computeLevelPrices } from "../src/levels.js";
import { makeConfig } from "./helpers.js";

describe("isReduceOnly", () => {
  it("neutral opens both directions", () => {
    expect(isReduceOnly("buy", "neutral")).toBe(false);
    expect(isReduceOnly("sell", "neutral")).toBe(false);
  });
  it("long: only sells reduce (take profit on the long)", () => {
    expect(isReduceOnly("sell", "long")).toBe(true);
    expect(isReduceOnly("buy", "long")).toBe(false);
  });
  it("short: only buys reduce (cover the short)", () => {
    expect(isReduceOnly("buy", "short")).toBe(true);
    expect(isReduceOnly("sell", "short")).toBe(false);
  });
});

describe("desiredOrders reduceOnly tagging", () => {
  it("tags long-grid sells reduce-only, buys not", () => {
    const cfg = makeConfig({ mode: "long" });
    const prices = computeLevelPrices(cfg);
    const slots = initialSlots(prices, 105, "long");
    // arm a take-profit sell above the mark
    slots[8] = "sell";
    const orders = desiredOrders(slots, prices, 100, 105, "long");
    const sell = orders.find((o) => o.side === "sell");
    const buy = orders.find((o) => o.side === "buy");
    expect(sell?.reduceOnly).toBe(true);
    expect(buy?.reduceOnly).toBe(false);
  });
});

describe("validateGridEconomics", () => {
  it("passes a grid whose spacing beats the round-trip fee", () => {
    // band 90–110, 21 levels → spacing 1.0 ≈ 0.9% at top, fee 2×0.0002=0.04%
    const res = validateGridEconomics(makeConfig(), 0.0002);
    expect(res.ok).toBe(true);
  });

  it("rejects a grid whose spacing is thinner than the round-trip fee", () => {
    // Very tight band with many levels → sub-fee spacing.
    const cfg = makeConfig({ lowerPrice: 100, upperPrice: 100.5, gridCount: 500 });
    const res = validateGridEconomics(cfg, 0.005);
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/round-trip fee/);
  });

  it("minSpacingFraction is the tightest gap as a fraction of price", () => {
    // arithmetic 90–110/20 → spacing 1.0, tightest fraction at price 110
    expect(minSpacingFraction(makeConfig())).toBeCloseTo(1 / 110, 4);
  });
});

describe("worstCaseMarginUsd", () => {
  it("is total notional over leverage", () => {
    const cfg = makeConfig({ gridCount: 20, perGridSizeUsd: 100, leverage: 5 });
    expect(worstCaseMarginUsd(cfg)).toBe((20 * 100) / 5);
  });
});
