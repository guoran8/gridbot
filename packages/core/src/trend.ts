import type { GridMode } from "@gridbot/shared";
import { ema, realizedVol, rsi } from "./indicators.js";

export type TrendDirection = "up" | "down" | "range";

export interface TrendReading {
  direction: TrendDirection;
  /** Fast/slow EMA spread as a fraction of price (signed). */
  emaSpread: number;
  rsi: number | null;
  /** Realised vol of log returns over the window. */
  vol: number | null;
}

/**
 * Classify the recent regime from a close series. Uptrend/downtrend when the
 * fast EMA leads the slow EMA by more than `threshold` (default 0.3%),
 * otherwise range.
 */
export function detectTrend(
  closes: number[],
  opts: { fast?: number; slow?: number; threshold?: number } = {},
): TrendReading {
  const fast = opts.fast ?? 12;
  const slow = opts.slow ?? 48;
  const threshold = opts.threshold ?? 0.003;

  const fastEma = ema(closes, fast);
  const slowEma = ema(closes, slow);
  const last = closes[closes.length - 1] ?? 0;

  let emaSpread = 0;
  let direction: TrendDirection = "range";
  if (fastEma !== null && slowEma !== null && last > 0) {
    emaSpread = (fastEma - slowEma) / last;
    if (emaSpread > threshold) direction = "up";
    else if (emaSpread < -threshold) direction = "down";
  }

  return { direction, emaSpread, rsi: rsi(closes), vol: realizedVol(closes) };
}

/**
 * Heuristic mapping from regime to grid mode:
 * range → neutral, uptrend → long, downtrend → short.
 * This is advisory only; the user's explicit config always wins.
 */
export function suggestMode(reading: TrendReading): GridMode {
  switch (reading.direction) {
    case "up":
      return "long";
    case "down":
      return "short";
    case "range":
      return "neutral";
  }
}

/**
 * Suggest a grid band around the current price sized to recent volatility.
 * Width defaults to ±2σ of log returns (clamped to a sane 2%–40% half-range).
 */
export function suggestBand(
  closes: number[],
  markPrice: number,
  sigmas = 2,
): { lowerPrice: number; upperPrice: number } {
  const vol = realizedVol(closes) ?? 0.05;
  const half = Math.min(0.4, Math.max(0.02, vol * sigmas));
  return {
    lowerPrice: markPrice * (1 - half),
    upperPrice: markPrice * (1 + half),
  };
}
