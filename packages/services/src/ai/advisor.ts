import type { AdviceContext, AiConfig, GridAdvice } from "./types.js";
import { adviseWithAnthropic } from "./anthropic.js";
import { adviseWithDeepseek } from "./openai-compatible.js";
import { adviseWithGemini } from "./gemini.js";
import { completeText } from "./complete.js";

/** Compact per-bot state handed to the AI capabilities. */
export interface BotBrief {
  id: string;
  exchange: string;
  symbol: string;
  mode: string;
  status: string;
  markPrice: number;
  lowerPrice: number;
  upperPrice: number;
  netPnl: number;
  volumeUsd: number;
  position: number;
  /** True when the mark is outside [lowerPrice, upperPrice]. */
  outOfRange: boolean;
}

export interface SentinelResult {
  ok: boolean;
  /** Concerns worth alerting on (empty when healthy). */
  alerts: string[];
  summary: string;
}

/**
 * Provider-agnostic AI service. Beyond structured grid advice, it provides the
 * five assistant capabilities (sentinel / daily report / market analysis /
 * conversational control / out-of-range recommendation). It is advisory only —
 * it never places or cancels orders; suggestions require user confirmation.
 */
export class AiAdvisor {
  constructor(private readonly config: AiConfig) {}

  get provider() {
    return this.config.provider;
  }

  /** 1. Structured grid-parameter advice. */
  async advise(ctx: AdviceContext): Promise<GridAdvice> {
    switch (this.config.provider) {
      case "anthropic":
        return adviseWithAnthropic(this.config, ctx);
      case "deepseek":
        return adviseWithDeepseek(this.config, ctx);
      case "gemini":
        return adviseWithGemini(this.config, ctx);
    }
  }

  /** 2. Risk sentinel — flag anomalies across the running bots. */
  async sentinel(bots: BotBrief[]): Promise<SentinelResult> {
    // Cheap deterministic pre-screen; the model explains + prioritises.
    const flagged = bots.filter((b) => b.status === "error" || b.outOfRange || b.netPnl < 0);
    if (bots.length === 0) return { ok: true, alerts: [], summary: "no bots running" };
    const system =
      "You are a trading-bot risk sentinel. Given a snapshot of grid bots, list " +
      "concrete concerns (errored bots, out-of-range positions, large drawdowns). " +
      "Be terse. If everything is fine, say so.";
    const summary = await completeText(this.config, system, this.botsTable(bots), 512);
    return {
      ok: flagged.length === 0,
      alerts: flagged.map((b) =>
        b.status === "error"
          ? `${b.exchange}/${b.symbol}: errored`
          : b.outOfRange
            ? `${b.exchange}/${b.symbol}: price out of grid range`
            : `${b.exchange}/${b.symbol}: net PnL ${b.netPnl.toFixed(2)}`,
      ),
      summary,
    };
  }

  /** 3. Daily report — a human-readable summary of the day's trading. */
  dailyReport(bots: BotBrief[]): Promise<string> {
    const system =
      "You are a trading assistant writing a concise daily report for a grid-bot " +
      "operator. Cover per-venue PnL, volume, and anything notable. Lead with the outcome.";
    return completeText(this.config, system, this.botsTable(bots), 800);
  }

  /** 4. Market analysis — regime read for a symbol from recent closes. */
  marketAnalysis(symbol: string, closes: number[]): Promise<string> {
    const system =
      "You are a crypto market analyst. From the recent close series, give a brief " +
      "read of the regime (trending/ranging, volatility) and what it implies for a " +
      "grid strategy. Keep it under 120 words.";
    const user = `Symbol: ${symbol}\nRecent closes (oldest→newest): ${closes.slice(-60).join(", ")}`;
    return completeText(this.config, system, user, 512);
  }

  /** 5. Conversational control — answer status questions; propose only, never act. */
  chat(message: string, bots: BotBrief[]): Promise<string> {
    const system =
      "You are the operator's assistant for a grid-trading bot. Answer questions " +
      "about the running bots from the provided state. You may PROPOSE actions " +
      "(start/stop/adjust/recover) but you cannot execute them — always tell the " +
      "user to confirm in the dashboard. Never claim you performed an action.";
    const user = `Bots:\n${this.botsTable(bots)}\n\nUser: ${message}`;
    return completeText(this.config, system, user, 800);
  }

  /** Out-of-range recommendation for a single bot that broke its band. */
  outOfRangeAdvice(bot: BotBrief): Promise<string> {
    const system =
      "A grid bot's price has left its configured range. Recommend one action: " +
      "close-and-stop, reduce-only recovery ladder, or re-band around the new price. " +
      "Explain the tradeoff in 2-3 sentences. Advisory only.";
    return completeText(this.config, system, this.botsTable([bot]), 400);
  }

  private botsTable(bots: BotBrief[]): string {
    return bots
      .map(
        (b) =>
          `- ${b.exchange}/${b.symbol} [${b.mode}] status=${b.status} mark=${b.markPrice} ` +
          `band=[${b.lowerPrice},${b.upperPrice}]${b.outOfRange ? " OUT-OF-RANGE" : ""} ` +
          `netPnl=${b.netPnl.toFixed(2)} vol=${b.volumeUsd.toFixed(0)} pos=${b.position}`,
      )
      .join("\n");
  }
}
