import { describe, expect, it } from "vitest";
import { GridEngine } from "../src/engine.js";
import { makeConfig } from "./helpers.js";

describe("GridEngine", () => {
  it("initializes the slot map once from the first mark", () => {
    const eng = new GridEngine(makeConfig());
    expect(eng.isInitialized()).toBe(false);
    eng.initialize(105);
    expect(eng.isInitialized()).toBe(true);
    // buys below 105, sells above
    const orders = eng.desiredOrders(105);
    expect(orders.some((o) => o.side === "buy" && o.price < 105)).toBe(true);
    expect(orders.some((o) => o.side === "sell" && o.price > 105)).toBe(true);
  });

  it("completes a buy→sell round trip with positive realised PnL", () => {
    const eng = new GridEngine(makeConfig({ perGridSizeUsd: 104 }));
    eng.initialize(105);
    // Buy fills at rung 4 (price 104): notional 104 → qty 1
    eng.recordFill({ gridIndex: 4, side: "buy", price: 104, size: 1, fee: 0 });
    // The engine should now arm a take-profit sell at rung 5 (price 105)
    const afterBuy = eng.desiredOrders(104);
    expect(afterBuy.some((o) => o.gridIndex === 5 && o.side === "sell")).toBe(true);
    // Sell fills at 105
    eng.recordFill({ gridIndex: 5, side: "sell", price: 105, size: 1, fee: 0 });
    const pnl = eng.pnl(105);
    expect(pnl.realizedPnl).toBeCloseTo(1); // (105-104)*1
    expect(pnl.matchedTrades).toBe(1);
    expect(pnl.volumeUsd).toBeCloseTo(209); // 104 + 105
    expect(eng.position.netQty).toBeCloseTo(0);
  });

  it("nets fees into netPnl", () => {
    const eng = new GridEngine(makeConfig({ perGridSizeUsd: 104 }));
    eng.initialize(105);
    eng.recordFill({ gridIndex: 4, side: "buy", price: 104, size: 1, fee: 0.1 });
    eng.recordFill({ gridIndex: 5, side: "sell", price: 105, size: 1, fee: 0.1 });
    const pnl = eng.pnl(105);
    expect(pnl.feesPaid).toBeCloseTo(0.2);
    expect(pnl.netPnl).toBeCloseTo(0.8); // 1 realised - 0.2 fees
  });

  it("round-trips its state for crash recovery", () => {
    const eng = new GridEngine(makeConfig());
    eng.initialize(105);
    eng.recordFill({ gridIndex: 4, side: "buy", price: 104, size: 1, fee: 0 });
    const state = eng.getState();

    const restored = new GridEngine(makeConfig(), state);
    expect(restored.isInitialized()).toBe(true);
    expect(restored.position.netQty).toBeCloseTo(1);
    // The armed take-profit sell at rung 5 survives the restore
    const orders = restored.desiredOrders(104);
    expect(orders.some((o) => o.gridIndex === 5 && o.side === "sell")).toBe(true);
  });

  it("does not re-initialize an already-running engine", () => {
    const eng = new GridEngine(makeConfig());
    eng.initialize(105);
    eng.recordFill({ gridIndex: 4, side: "buy", price: 104, size: 1, fee: 0 });
    eng.initialize(101); // should be a no-op
    expect(eng.position.netQty).toBeCloseTo(1);
  });
});
