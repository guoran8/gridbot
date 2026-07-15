import type { OrderSide } from "@gridbot/shared";

export interface PositionState {
  /** Signed base quantity: positive long, negative short. */
  netQty: number;
  /** Volume-weighted average entry of the open position (0 when flat). */
  avgEntry: number;
}

export interface AccountingState {
  position: PositionState;
  realizedPnl: number;
  feesPaid: number;
  volumeUsd: number;
  matchedTrades: number;
  filledOrders: number;
}

export function emptyAccounting(): AccountingState {
  return {
    position: { netQty: 0, avgEntry: 0 },
    realizedPnl: 0,
    feesPaid: 0,
    volumeUsd: 0,
    matchedTrades: 0,
    filledOrders: 0,
  };
}

export interface FillInput {
  side: OrderSide;
  price: number;
  size: number;
  /** Quote-currency fee (USD); negative for a maker rebate. */
  fee: number;
}

const EPS = 1e-12;

/**
 * Fold a fill into accounting state (pure). Realises PnL via the average-cost
 * method whenever a fill reduces the open position, handling partial closes and
 * position flips. `matchedTrades` counts each discrete close.
 */
export function applyFill(state: AccountingState, fill: FillInput): AccountingState {
  const { side, price, size, fee } = fill;
  const signed = side === "buy" ? size : -size;
  const { netQty, avgEntry } = state.position;

  let newNet = netQty;
  let newEntry = avgEntry;
  let realizedDelta = 0;
  let matchedDelta = 0;

  const sameSign = netQty === 0 || Math.sign(netQty) === Math.sign(signed);

  if (netQty === 0 || sameSign) {
    // Opening or adding to the position — roll the weighted-average entry.
    const absOld = Math.abs(netQty);
    const absAdd = Math.abs(signed);
    newNet = netQty + signed;
    newEntry =
      absOld + absAdd < EPS ? price : (avgEntry * absOld + price * absAdd) / (absOld + absAdd);
  } else {
    // Reducing / closing / flipping the position.
    const closeQty = Math.min(Math.abs(netQty), Math.abs(signed));
    const direction = Math.sign(netQty); // +1 long, -1 short
    realizedDelta = closeQty * (price - avgEntry) * direction;
    matchedDelta = 1;
    newNet = netQty + signed;
    if (Math.abs(newNet) < EPS) {
      newNet = 0;
      newEntry = 0;
    } else if (Math.sign(newNet) === Math.sign(signed)) {
      // Flipped through zero — the residual opens a fresh position at `price`.
      newEntry = price;
    } // else: partial close, avgEntry unchanged
  }

  return {
    position: { netQty: newNet, avgEntry: newEntry },
    realizedPnl: state.realizedPnl + realizedDelta,
    feesPaid: state.feesPaid + fee,
    volumeUsd: state.volumeUsd + price * size,
    matchedTrades: state.matchedTrades + matchedDelta,
    filledOrders: state.filledOrders + 1,
  };
}

/** Mark-to-market PnL of the open position. */
export function unrealizedPnl(position: PositionState, markPrice: number): number {
  if (position.netQty === 0) return 0;
  return (markPrice - position.avgEntry) * position.netQty;
}
