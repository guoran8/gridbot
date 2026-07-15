import { describe, expect, it } from "vitest";
import { computeLevelPrices } from "../src/levels.js";
import { desiredOrders, initialSlots, nextSlotsOnFill } from "../src/slots.js";
import { makeConfig } from "./helpers.js";

const prices = computeLevelPrices(makeConfig()); // 100..110 step 1

describe("initialSlots (neutral, mark=105)", () => {
  const slots = initialSlots(prices, 105, "neutral");
  it("quotes buys below and sells above the mark", () => {
    expect(slots[0]).toBe("buy"); // 100
    expect(slots[4]).toBe("buy"); // 104
    expect(slots[6]).toBe("sell"); // 106
    expect(slots[10]).toBe("sell"); // 110
  });
});

describe("nextSlotsOnFill", () => {
  const slots = initialSlots(prices, 105, "neutral");

  it("a buy fill arms a take-profit sell one rung up", () => {
    const next = nextSlotsOnFill(slots, 3, "buy");
    expect(next[3]).toBe("none");
    expect(next[4]).toBe("sell");
    expect(slots[3]).toBe("buy"); // original untouched (pure)
  });

  it("a sell fill arms a re-entry buy one rung down", () => {
    const next = nextSlotsOnFill(slots, 7, "sell");
    expect(next[7]).toBe("none");
    expect(next[6]).toBe("buy");
  });

  it("clamps at the top edge (no rung above)", () => {
    const next = nextSlotsOnFill(slots, 10, "buy");
    expect(next[10]).toBe("none");
    expect(next).toHaveLength(11);
  });

  it("clamps at the bottom edge (no rung below)", () => {
    const next = nextSlotsOnFill(slots, 0, "sell");
    expect(next[0]).toBe("none");
  });
});

describe("desiredOrders", () => {
  it("emits one order per non-empty rung with correct qty", () => {
    const slots = initialSlots(prices, 105, "neutral");
    const orders = desiredOrders(slots, prices, 100, 105, "neutral");
    const buy100 = orders.find((o) => o.gridIndex === 0);
    expect(buy100?.side).toBe("buy");
    expect(buy100?.size).toBeCloseTo(1); // 100 / 100
  });

  it("skips rungs whose side would immediately cross the mark", () => {
    // A stale slot map that wants to buy at 108 while mark has fallen to 103.
    const slots = initialSlots(prices, 105, "neutral");
    slots[8] = "buy"; // 108 buy, but mark below it
    const orders = desiredOrders(slots, prices, 100, 103, "neutral");
    expect(orders.find((o) => o.gridIndex === 8)).toBeUndefined();
  });
});
