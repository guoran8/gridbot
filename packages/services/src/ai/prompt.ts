import { detectTrend, suggestBand, suggestMode } from "@gridbot/core";
import type { AdviceContext } from "./types.js";

/**
 * Build the advisor prompt. We pre-compute indicator context locally (trend,
 * suggested mode/band) so the model reasons over concrete numbers rather than a
 * raw price dump — cheaper and more grounded.
 */
export function buildAdvicePrompt(ctx: AdviceContext): { system: string; user: string } {
  const reading = detectTrend(ctx.closes);
  const heuristicMode = suggestMode(reading);
  const band = suggestBand(ctx.closes, ctx.markPrice);

  const system =
    "You are a grid-trading strategy advisor. Given recent price action and " +
    "pre-computed indicators, recommend grid parameters (mode, band, grid count). " +
    "Prefer a neutral grid in ranging markets, a long grid in uptrends, a short " +
    "grid in downtrends. Keep the band within ~2 sigma of realized volatility. " +
    "Respond only with the structured fields requested.";

  const user = [
    `Symbol: ${ctx.symbol}`,
    `Current mark price: ${ctx.markPrice}`,
    `Detected regime: ${reading.direction} (EMA spread ${reading.emaSpread.toFixed(4)}, RSI ${reading.rsi?.toFixed(1) ?? "n/a"})`,
    `Realized volatility: ${reading.vol?.toFixed(4) ?? "n/a"}`,
    `Heuristic suggestion: mode=${heuristicMode}, band=[${band.lowerPrice.toFixed(2)}, ${band.upperPrice.toFixed(2)}]`,
    "",
    "Recommend the final grid parameters as structured output.",
  ].join("\n");

  return { system, user };
}
