import { z } from "zod";

/** Supported venues. `paper` is the built-in simulator (no keys, no network). */
export const ExchangeIdSchema = z.enum(["paper", "extended", "decibel", "risex"]);
export type ExchangeId = z.infer<typeof ExchangeIdSchema>;

/** Real (key-bearing) venues, excluding the paper simulator. */
export const LiveExchangeIdSchema = z.enum(["extended", "decibel", "risex"]);
export type LiveExchangeId = z.infer<typeof LiveExchangeIdSchema>;

/**
 * Grid direction:
 * - `neutral` — places buys below and sells above the mark; profits from chop.
 * - `long`    — buy-only ladder; accumulates into dips, sells on the way up.
 * - `short`   — sell-only ladder; distributes into rips, buys back on dips.
 */
export const GridModeSchema = z.enum(["neutral", "long", "short"]);
export type GridMode = z.infer<typeof GridModeSchema>;

/** Level spacing across the [lower, upper] band. */
export const GridSpacingSchema = z.enum(["arithmetic", "geometric"]);
export type GridSpacing = z.infer<typeof GridSpacingSchema>;

export const OrderSideSchema = z.enum(["buy", "sell"]);
export type OrderSide = z.infer<typeof OrderSideSchema>;

export const OrderStatusSchema = z.enum([
  "pending", // created locally, not yet acknowledged by the venue
  "open", // resting on the book
  "filled", // fully filled
  "cancelled", // cancelled before fully filling
  "rejected", // venue rejected it
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

/** Lifecycle of a single grid bot instance. */
export const BotStatusSchema = z.enum([
  "idle", // configured but not started
  "running", // actively quoting the grid
  "paused", // orders left resting, no re-quoting
  "stopping", // cancelling orders / winding down
  "error", // halted on an unrecoverable error
]);
export type BotStatus = z.infer<typeof BotStatusSchema>;

/** Trading mode for a bot instance. */
export const TradingModeSchema = z.enum(["paper", "live"]);
export type TradingMode = z.infer<typeof TradingModeSchema>;

export const LogLevelSchema = z.enum(["debug", "info", "warn", "error"]);
export type LogLevel = z.infer<typeof LogLevelSchema>;
