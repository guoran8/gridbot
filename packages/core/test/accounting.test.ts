import { describe, expect, it } from "vitest";
import { applyFill, emptyAccounting, unrealizedPnl } from "../src/accounting.js";

describe("applyFill", () => {
  it("opens a position at the fill price", () => {
    const s = applyFill(emptyAccounting(), { side: "buy", price: 100, size: 1, fee: 0 });
    expect(s.position.netQty).toBe(1);
    expect(s.position.avgEntry).toBe(100);
    expect(s.filledOrders).toBe(1);
    expect(s.volumeUsd).toBe(100);
  });

  it("rolls a weighted-average entry when adding", () => {
    let s = applyFill(emptyAccounting(), { side: "buy", price: 100, size: 1, fee: 0 });
    s = applyFill(s, { side: "buy", price: 102, size: 1, fee: 0 });
    expect(s.position.netQty).toBe(2);
    expect(s.position.avgEntry).toBeCloseTo(101);
  });

  it("realises PnL and counts a matched trade on close", () => {
    let s = applyFill(emptyAccounting(), { side: "buy", price: 100, size: 1, fee: 0 });
    s = applyFill(s, { side: "sell", price: 110, size: 1, fee: 0 });
    expect(s.position.netQty).toBe(0);
    expect(s.realizedPnl).toBeCloseTo(10);
    expect(s.matchedTrades).toBe(1);
  });

  it("accumulates fees into the ledger", () => {
    let s = applyFill(emptyAccounting(), { side: "buy", price: 100, size: 1, fee: 0.05 });
    s = applyFill(s, { side: "sell", price: 110, size: 1, fee: 0.055 });
    expect(s.feesPaid).toBeCloseTo(0.105);
  });

  it("handles a position flip through zero", () => {
    let s = applyFill(emptyAccounting(), { side: "buy", price: 100, size: 1, fee: 0 });
    // sell 2 while long 1 → close 1 (realise -), open short 1 at 90
    s = applyFill(s, { side: "sell", price: 90, size: 2, fee: 0 });
    expect(s.realizedPnl).toBeCloseTo(-10); // (90-100)*1
    expect(s.position.netQty).toBe(-1);
    expect(s.position.avgEntry).toBe(90);
    expect(s.matchedTrades).toBe(1);
  });

  it("partial close leaves avgEntry unchanged", () => {
    let s = applyFill(emptyAccounting(), { side: "buy", price: 100, size: 2, fee: 0 });
    s = applyFill(s, { side: "sell", price: 110, size: 1, fee: 0 });
    expect(s.position.netQty).toBe(1);
    expect(s.position.avgEntry).toBe(100);
    expect(s.realizedPnl).toBeCloseTo(10);
  });
});

describe("unrealizedPnl", () => {
  it("is zero when flat", () => {
    expect(unrealizedPnl({ netQty: 0, avgEntry: 0 }, 100)).toBe(0);
  });
  it("is positive for a long marked up", () => {
    expect(unrealizedPnl({ netQty: 2, avgEntry: 100 }, 105)).toBeCloseTo(10);
  });
  it("is positive for a short marked down", () => {
    expect(unrealizedPnl({ netQty: -1, avgEntry: 90 }, 80)).toBeCloseTo(10);
  });
});
