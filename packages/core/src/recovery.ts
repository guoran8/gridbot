import type { OrderSide } from "@gridbot/shared";

export interface LadderOrder {
  side: OrderSide;
  price: number;
  size: number;
  reduceOnly: true;
}

/**
 * Build a reduce-only ladder that unwinds a net position back to flat, stepping
 * *away* from the mark so each rung fills as price moves favourably.
 *
 * - Long (netQty > 0): reduce-only SELLs at mark×(1 + k·step), k = 1..steps.
 * - Short (netQty < 0): reduce-only BUYs at mark×(1 − k·step).
 *
 * Each rung closes an equal slice of the position; the last rung takes any
 * rounding remainder so the ladder sums exactly to |netQty|.
 */
export function recoveryLadder(
  netQty: number,
  markPrice: number,
  steps = 5,
  stepFraction = 0.002,
): LadderOrder[] {
  const total = Math.abs(netQty);
  if (total <= 0 || steps <= 0 || markPrice <= 0) return [];
  const side: OrderSide = netQty > 0 ? "sell" : "buy";
  const dir = netQty > 0 ? 1 : -1;

  const slice = total / steps;
  const ladder: LadderOrder[] = [];
  let placed = 0;
  for (let k = 1; k <= steps; k++) {
    const price = markPrice * (1 + dir * stepFraction * k);
    const size = k === steps ? total - placed : slice;
    placed += size;
    ladder.push({ side, price, size, reduceOnly: true });
  }
  return ladder;
}
