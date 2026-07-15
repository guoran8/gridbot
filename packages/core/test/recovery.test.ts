import { describe, expect, it } from "vitest";
import { GridEngine, recoveryLadder } from "../src/index.js";
import { makeConfig } from "./helpers.js";

describe("recoveryLadder", () => {
  it("unwinds a long with reduce-only sells stepping up from the mark", () => {
    const ladder = recoveryLadder(3, 100, 3, 0.01);
    expect(ladder).toHaveLength(3);
    expect(ladder.every((o) => o.side === "sell" && o.reduceOnly)).toBe(true);
    expect(ladder[0]!.price).toBeCloseTo(101); // 100×(1+0.01×1)
    expect(ladder[2]!.price).toBeCloseTo(103);
    // sizes sum exactly to the position
    expect(ladder.reduce((s, o) => s + o.size, 0)).toBeCloseTo(3);
  });

  it("unwinds a short with reduce-only buys stepping down", () => {
    const ladder = recoveryLadder(-2, 200, 2, 0.005);
    expect(ladder.every((o) => o.side === "buy" && o.reduceOnly)).toBe(true);
    expect(ladder[0]!.price).toBeCloseTo(199); // 200×(1−0.005×1)
    expect(ladder.reduce((s, o) => s + o.size, 0)).toBeCloseTo(2);
  });

  it("is empty when flat", () => {
    expect(recoveryLadder(0, 100)).toHaveLength(0);
  });
});

describe("GridEngine.reband", () => {
  it("recomputes the ladder and reseeds from the mark, preserving position", () => {
    const eng = new GridEngine(makeConfig({ lowerPrice: 90, upperPrice: 110, gridCount: 11 }));
    eng.initialize(100);
    eng.recordFill({ gridIndex: 4, side: "buy", price: 96, size: 1, fee: 0 });
    const posBefore = eng.position.netQty;

    eng.reband({ lowerPrice: 80, upperPrice: 120, gridCount: 21 }, 100);
    expect(eng.config.lowerPrice).toBe(80);
    expect(eng.config.gridCount).toBe(21);
    expect(eng.prices[0]).toBe(80);
    expect(eng.prices[eng.prices.length - 1]).toBe(120);
    // position survives the re-band
    expect(eng.position.netQty).toBeCloseTo(posBefore);
    // fresh orders are seeded around the new mark
    const orders = eng.desiredOrders(100);
    expect(orders.some((o) => o.side === "buy" && o.price < 100)).toBe(true);
    expect(orders.some((o) => o.side === "sell" && o.price > 100)).toBe(true);
  });
});
