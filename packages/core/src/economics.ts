import type { GridConfig } from "@gridbot/shared";
import { computeLevelPrices } from "./levels.js";

/**
 * The smallest spacing between adjacent rungs *as a fraction of price*. For a
 * grid to be profitable after fees this must exceed the round-trip fee rate.
 * Arithmetic grids have a constant absolute gap → the fraction is smallest at
 * the highest price; geometric grids have a constant fraction.
 */
export function minSpacingFraction(config: GridConfig): number {
  const prices = computeLevelPrices(config);
  let min = Infinity;
  for (let i = 1; i < prices.length; i++) {
    const frac = (prices[i]! - prices[i - 1]!) / prices[i]!;
    if (frac < min) min = frac;
  }
  return Number.isFinite(min) ? min : 0;
}

export interface EconomicsCheck {
  ok: boolean;
  /** min spacing as a fraction of price. */
  spacingFraction: number;
  /** the round-trip fee rate the grid must beat (2 × feeRate). */
  roundTripFee: number;
  reason?: string;
}

/**
 * Reject grids whose spacing can't cover the round-trip fee — every completed
 * buy→sell cycle would net a loss. Mirrors the original bot's startup guard.
 *
 * Profit per rung ≈ spacing × size; round-trip fee ≈ 2 × feeRate × notional,
 * so profitability requires `spacing/price > 2 × feeRate`.
 */
export function validateGridEconomics(config: GridConfig, feeRate: number): EconomicsCheck {
  const spacingFraction = minSpacingFraction(config);
  const roundTripFee = 2 * feeRate;
  const ok = spacingFraction > roundTripFee;
  return {
    ok,
    spacingFraction,
    roundTripFee,
    reason: ok
      ? undefined
      : `grid spacing ${(spacingFraction * 100).toFixed(3)}% does not cover the ` +
        `round-trip fee ${(roundTripFee * 100).toFixed(3)}% — every cycle would lose. ` +
        `Widen the band, reduce gridCount, or trade a lower-fee venue.`,
  };
}

/**
 * Worst-case margin (USD) if every rung fills in the same direction as price
 * trends through the whole band. Conservative: all levels × per-grid notional,
 * divided by leverage. Used to pre-check against available balance.
 */
export function worstCaseMarginUsd(config: GridConfig): number {
  const totalNotional = config.gridCount * config.perGridSizeUsd;
  return totalNotional / config.leverage;
}
