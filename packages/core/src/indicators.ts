/**
 * Small, dependency-free indicator kit used by trend detection and the AI
 * advisor. All functions take a chronological array (oldest first) and return
 * either a single latest value or a series aligned to the input tail.
 */

/** Simple moving average of the last `period` values, or null if too short. */
export function sma(values: number[], period: number): number | null {
  if (period <= 0 || values.length < period) return null;
  let sum = 0;
  for (let i = values.length - period; i < values.length; i++) sum += values[i]!;
  return sum / period;
}

/** Exponential moving average (latest value). Seeded with the SMA of the first window. */
export function ema(values: number[], period: number): number | null {
  if (period <= 0 || values.length < period) return null;
  const k = 2 / (period + 1);
  let e = sma(values.slice(0, period), period)!;
  for (let i = period; i < values.length; i++) e = values[i]! * k + e * (1 - k);
  return e;
}

/** Population standard deviation of the last `period` values. */
export function stddev(values: number[], period = values.length): number | null {
  if (period <= 1 || values.length < period) return null;
  const window = values.slice(values.length - period);
  const mean = window.reduce((a, b) => a + b, 0) / period;
  const variance = window.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
  return Math.sqrt(variance);
}

/** Wilder's RSI over `period` (default 14). Returns 0..100, or null if too short. */
export function rsi(values: number[], period = 14): number | null {
  if (values.length < period + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i]! - values[i - 1]!;
    if (diff >= 0) gain += diff;
    else loss -= diff;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i]! - values[i - 1]!;
    const g = diff > 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
  }
  if (avgLoss < 1e-12) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/** Annualisation-free realised volatility: stddev of log returns over the window. */
export function realizedVol(values: number[], period = values.length): number | null {
  if (values.length < 2) return null;
  const rets: number[] = [];
  const start = Math.max(1, values.length - period);
  for (let i = start; i < values.length; i++) {
    const prev = values[i - 1]!;
    if (prev > 0) rets.push(Math.log(values[i]! / prev));
  }
  return stddev(rets, rets.length);
}
