import { desc, eq } from "drizzle-orm";
import type { Db } from "./client.js";
import {
  type BotRow,
  bots,
  type FillRow,
  fills,
  type LogRow,
  logs,
  type OrderRow,
  orders,
} from "./schema.js";

export type NewBot = BotRow;
export type BotPatch = Partial<
  Pick<BotRow, "status" | "engineState" | "lastError" | "startedAt" | "updatedAt" | "config">
>;

/**
 * Persistence boundary for the bot runtime. Synchronous (better-sqlite3 is), so
 * the runner can persist inline on every fill without awaiting. Tests can swap
 * in an in-memory implementation of this interface.
 */
export interface BotStore {
  createBot(row: NewBot): void;
  updateBot(id: string, patch: BotPatch): void;
  listBots(): BotRow[];
  getBot(id: string): BotRow | undefined;
  deleteBot(id: string): void;

  insertOrder(row: OrderRow): void;
  updateOrder(id: string, patch: Partial<OrderRow>): void;
  listOrders(botId: string, limit?: number): OrderRow[];

  insertFill(row: FillRow): void;
  listFills(botId: string, limit?: number): FillRow[];

  appendLog(row: Omit<LogRow, "id">): void;
  listLogs(limit?: number): LogRow[];
}

export class DrizzleBotStore implements BotStore {
  constructor(private readonly db: Db) {}

  createBot(row: NewBot): void {
    this.db.insert(bots).values(row).run();
  }

  updateBot(id: string, patch: BotPatch): void {
    this.db.update(bots).set(patch).where(eq(bots.id, id)).run();
  }

  listBots(): BotRow[] {
    return this.db.select().from(bots).all();
  }

  getBot(id: string): BotRow | undefined {
    return this.db.select().from(bots).where(eq(bots.id, id)).get();
  }

  deleteBot(id: string): void {
    this.db.delete(orders).where(eq(orders.botId, id)).run();
    this.db.delete(fills).where(eq(fills.botId, id)).run();
    this.db.delete(bots).where(eq(bots.id, id)).run();
  }

  insertOrder(row: OrderRow): void {
    this.db.insert(orders).values(row).run();
  }

  updateOrder(id: string, patch: Partial<OrderRow>): void {
    this.db.update(orders).set(patch).where(eq(orders.id, id)).run();
  }

  listOrders(botId: string, limit = 200): OrderRow[] {
    return this.db
      .select()
      .from(orders)
      .where(eq(orders.botId, botId))
      .orderBy(desc(orders.updatedAt))
      .limit(limit)
      .all();
  }

  insertFill(row: FillRow): void {
    this.db.insert(fills).values(row).run();
  }

  listFills(botId: string, limit = 200): FillRow[] {
    return this.db
      .select()
      .from(fills)
      .where(eq(fills.botId, botId))
      .orderBy(desc(fills.timestamp))
      .limit(limit)
      .all();
  }

  appendLog(row: Omit<LogRow, "id">): void {
    this.db.insert(logs).values(row).run();
  }

  listLogs(limit = 200): LogRow[] {
    return this.db.select().from(logs).orderBy(desc(logs.ts)).limit(limit).all();
  }
}
