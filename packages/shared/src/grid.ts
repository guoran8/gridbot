import { z } from "zod";
import {
  ExchangeIdSchema,
  GridModeSchema,
  GridSpacingSchema,
  OrderSideSchema,
  TradingModeSchema,
} from "./enums.js";

const positive = z.number().finite().positive();

/**
 * User-facing configuration for one grid bot instance.
 *
 * A grid is defined by a price band `[lowerPrice, upperPrice]` cut into
 * `gridCount` levels. `perGridSizeUsd` is the notional placed at each level;
 * base quantity for a level is `perGridSizeUsd / levelPrice`.
 */
export const GridConfigSchema = z
  .object({
    exchange: ExchangeIdSchema,
    /** Venue market symbol, e.g. "BTC-USD". Normalised per-adapter. */
    symbol: z.string().min(1),
    mode: GridModeSchema,
    tradingMode: TradingModeSchema.default("paper"),

    lowerPrice: positive,
    upperPrice: positive,
    /** Number of grid levels (>= 2). Intervals = gridCount - 1. */
    gridCount: z.number().int().min(2).max(500),
    spacing: GridSpacingSchema.default("arithmetic"),

    /** Notional (USD) placed at each grid level. */
    perGridSizeUsd: positive,
    /** Position leverage applied on the venue. */
    leverage: z.number().finite().min(1).max(50).default(1),

    /** Optional hard exits — bot flattens and stops if mark crosses these. */
    stopLossPrice: positive.optional(),
    takeProfitPrice: positive.optional(),

    /**
     * If true, when price exits the band the bot re-centres a fresh band around
     * the new mark instead of sitting idle. Off by default (safer).
     */
    recenterOnBreakout: z.boolean().default(false),
  })
  .refine((c) => c.upperPrice > c.lowerPrice, {
    message: "upperPrice must be greater than lowerPrice",
    path: ["upperPrice"],
  })
  .refine((c) => c.stopLossPrice === undefined || c.stopLossPrice < c.lowerPrice, {
    message: "stopLossPrice should sit below the grid band",
    path: ["stopLossPrice"],
  })
  .refine((c) => c.takeProfitPrice === undefined || c.takeProfitPrice > c.upperPrice, {
    message: "takeProfitPrice should sit above the grid band",
    path: ["takeProfitPrice"],
  });
export type GridConfig = z.infer<typeof GridConfigSchema>;

/** One computed price rung of the ladder. */
export const GridLevelSchema = z.object({
  index: z.number().int().nonnegative(),
  price: positive,
  /** Side this rung quotes when resting (relative to current mark). */
  side: OrderSideSchema,
});
export type GridLevel = z.infer<typeof GridLevelSchema>;
