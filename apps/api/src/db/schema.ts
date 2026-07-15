import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** One grid bot instance: its config plus the serialised engine state for recovery. */
export const bots = sqliteTable("bots", {
  id: text("id").primaryKey(),
  /** JSON-serialised GridConfig. */
  config: text("config").notNull(),
  status: text("status").notNull(),
  /** JSON-serialised EngineState (slots + accounting) for crash recovery. */
  engineState: text("engine_state"),
  lastError: text("last_error"),
  startedAt: integer("started_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

/** Historical record of every order the bot placed (the local ledger). */
export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  botId: text("bot_id").notNull(),
  exchange: text("exchange").notNull(),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(),
  price: real("price").notNull(),
  size: real("size").notNull(),
  status: text("status").notNull(),
  gridIndex: integer("grid_index").notNull(),
  clientOrderId: text("client_order_id").notNull(),
  exchangeOrderId: text("exchange_order_id"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

/** Executions — the source of truth for realised PnL and volume. */
export const fills = sqliteTable("fills", {
  id: text("id").primaryKey(),
  botId: text("bot_id").notNull(),
  orderId: text("order_id").notNull(),
  exchange: text("exchange").notNull(),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(),
  price: real("price").notNull(),
  size: real("size").notNull(),
  fee: real("fee").notNull(),
  gridIndex: integer("grid_index").notNull(),
  timestamp: integer("timestamp").notNull(),
});

/** Rolling application/bot log, surfaced in the dashboard. */
export const logs = sqliteTable("logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  botId: text("bot_id"),
  exchange: text("exchange"),
  level: text("level").notNull(),
  message: text("message").notNull(),
  ts: integer("ts").notNull(),
});

export type BotRow = typeof bots.$inferSelect;
export type OrderRow = typeof orders.$inferSelect;
export type FillRow = typeof fills.$inferSelect;
export type LogRow = typeof logs.$inferSelect;
