import type { GridMode, OrderSide } from "@gridbot/shared";
import { initialSideForLevel } from "./levels.js";

/** What a grid rung currently intends to rest: an order side, or nothing. */
export type SlotSide = OrderSide | "none";

/**
 * Initial resting intent for every rung, given the mark price and mode.
 * The rung closest to `mark` is intentionally left empty on the side it would
 * cross (a buy above mark / sell below mark would fill instantly), which the
 * `price < mark` / `price > mark` split already guarantees.
 */
export function initialSlots(prices: number[], mark: number, mode: GridMode): SlotSide[] {
  return prices.map((p) => initialSideForLevel(p, mark, mode));
}

/**
 * Apply a fill to the slot map and return the next map (pure — input untouched).
 *
 * Grid reprice rule (mode-independent):
 * - a BUY filling at rung `i` arms a take-profit SELL one rung up (`i+1`);
 * - a SELL filling at rung `i` arms a re-entry BUY one rung down (`i-1`);
 * - the filled rung itself goes empty.
 *
 * Rungs at the band edge whose counterpart would fall outside [0, n) are simply
 * left empty (the position rides until price re-enters the band, or the bot
 * recenters).
 */
export function nextSlotsOnFill(
  slots: SlotSide[],
  filledIndex: number,
  filledSide: OrderSide,
): SlotSide[] {
  const next = slots.slice();
  if (filledIndex >= 0 && filledIndex < next.length) next[filledIndex] = "none";
  if (filledSide === "buy") {
    const up = filledIndex + 1;
    if (up < next.length) next[up] = "sell";
  } else {
    const down = filledIndex - 1;
    if (down >= 0) next[down] = "buy";
  }
  return next;
}

/**
 * Whether an order on `side` only *closes* a position under `mode` (never opens
 * the opposite direction). In a long grid, sells only take profit on the long;
 * in a short grid, buys only cover the short. Neutral opens both ways.
 */
export function isReduceOnly(side: OrderSide, mode: GridMode): boolean {
  if (mode === "long") return side === "sell";
  if (mode === "short") return side === "buy";
  return false;
}

/** A desired resting order derived from the slot map. */
export interface DesiredOrder {
  gridIndex: number;
  side: OrderSide;
  price: number;
  size: number;
  /** True when this order may only reduce the position (long/short modes). */
  reduceOnly: boolean;
}

/**
 * Derive the full set of orders that should currently rest, from the slot map.
 * Skips any rung whose intended side would immediately cross the mark (defensive
 * — the slot map should never produce these, but a fresh mark can drift).
 */
export function desiredOrders(
  slots: SlotSide[],
  prices: number[],
  perGridSizeUsd: number,
  mark: number,
  mode: GridMode,
): DesiredOrder[] {
  const orders: DesiredOrder[] = [];
  for (let i = 0; i < slots.length; i++) {
    const side = slots[i];
    if (side === undefined || side === "none") continue;
    const price = prices[i]!;
    if (side === "buy" && price >= mark) continue; // would cross
    if (side === "sell" && price <= mark) continue; // would cross
    orders.push({
      gridIndex: i,
      side,
      price,
      size: perGridSizeUsd / price,
      reduceOnly: isReduceOnly(side, mode),
    });
  }
  return orders;
}
