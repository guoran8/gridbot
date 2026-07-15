import type { GridConfig, GridLevel, GridMode, OrderSide } from "@gridbot/shared";

/**
 * Compute the ladder prices across [lowerPrice, upperPrice].
 *
 * `arithmetic` spacing gives equal absolute gaps; `geometric` gives equal
 * percentage gaps (better when the band spans a wide range). Returns exactly
 * `gridCount` ascending prices, endpoints inclusive.
 */
export function computeLevelPrices(config: GridConfig): number[] {
  const { lowerPrice, upperPrice, gridCount, spacing } = config;
  const n = gridCount;
  const prices: number[] = new Array(n);

  if (spacing === "geometric") {
    const ratio = (upperPrice / lowerPrice) ** (1 / (n - 1));
    for (let i = 0; i < n; i++) prices[i] = lowerPrice * ratio ** i;
  } else {
    const step = (upperPrice - lowerPrice) / (n - 1);
    for (let i = 0; i < n; i++) prices[i] = lowerPrice + step * i;
  }
  // Pin endpoints exactly (guard against float drift on the last rung).
  prices[0] = lowerPrice;
  prices[n - 1] = upperPrice;
  return prices;
}

/**
 * The side a rung quotes if resting right now, given the mark and mode.
 * `none` means the rung holds no resting order in its initial state.
 */
export function initialSideForLevel(
  price: number,
  mark: number,
  mode: GridMode,
): OrderSide | "none" {
  const below = price < mark;
  switch (mode) {
    case "neutral":
      return below ? "buy" : "sell";
    case "long":
      // Open only on dips; take-profit sells are armed dynamically on fills.
      return below ? "buy" : "none";
    case "short":
      // Open only on rips; take-profit buys are armed dynamically on fills.
      return below ? "none" : "sell";
  }
}

/** Build display levels with their current resting side derived from a slot map. */
export function toGridLevels(prices: number[], sides: Array<OrderSide | "none">): GridLevel[] {
  const levels: GridLevel[] = [];
  for (let i = 0; i < prices.length; i++) {
    const side = sides[i] ?? "none";
    // Levels holding no order are still shown; default their display side by
    // position relative to neighbours is not needed — mark them by last intent.
    levels.push({ index: i, price: prices[i]!, side: side === "none" ? "buy" : side });
  }
  return levels;
}

/** Base-asset quantity for a rung: notional / price. */
export function sizeForPrice(perGridSizeUsd: number, price: number): number {
  return perGridSizeUsd / price;
}
