import { z } from "zod";
import { BotStatusSchema, ExchangeIdSchema, LogLevelSchema } from "./enums.js";
import { GridConfigSchema, GridLevelSchema } from "./grid.js";
import { OrderSchema, PositionSchema } from "./order.js";

/** Realised/unrealised accounting for a bot instance. */
export const PnlSummarySchema = z.object({
  realizedPnl: z.number().finite(),
  unrealizedPnl: z.number().finite(),
  feesPaid: z.number().finite(),
  /** realizedPnl - feesPaid + unrealizedPnl. */
  netPnl: z.number().finite(),
  /** Count of round-trips (a buy rung matched by its sell rung, or vice versa). */
  matchedTrades: z.number().int().nonnegative(),
  filledOrders: z.number().int().nonnegative(),
  /** Cumulative traded notional (USD) — the number that farms volume points. */
  volumeUsd: z.number().finite().nonnegative(),
});
export type PnlSummary = z.infer<typeof PnlSummarySchema>;

export const LogEntrySchema = z.object({
  ts: z.number().int(),
  level: LogLevelSchema,
  botId: z.string().optional(),
  exchange: ExchangeIdSchema.optional(),
  message: z.string(),
});
export type LogEntry = z.infer<typeof LogEntrySchema>;

/**
 * Full runtime state of one grid bot instance — the shape pushed to the
 * dashboard on every snapshot tick.
 */
export const BotSnapshotSchema = z.object({
  id: z.string(),
  config: GridConfigSchema,
  status: BotStatusSchema,
  markPrice: z.number().finite().nonnegative(),
  levels: z.array(GridLevelSchema),
  openOrders: z.array(OrderSchema),
  position: PositionSchema.nullable(),
  pnl: PnlSummarySchema,
  /** Last error message when status === "error". */
  lastError: z.string().optional(),
  startedAt: z.number().int().nullable(),
  updatedAt: z.number().int(),
});
export type BotSnapshot = z.infer<typeof BotSnapshotSchema>;

/** The whole system: every configured bot instance. */
export const SystemSnapshotSchema = z.object({
  bots: z.array(BotSnapshotSchema),
  serverTime: z.number().int(),
});
export type SystemSnapshot = z.infer<typeof SystemSnapshotSchema>;
