import { randomUUID } from "node:crypto";
import { GridEngine } from "@gridbot/core";
import type { ExchangeAdapter, VenueFill } from "@gridbot/exchanges";
import type {
  BotSnapshot,
  BotStatus,
  GridConfig,
  LogLevel,
  Order,
  Position,
} from "@gridbot/shared";
import type { EventBus } from "../events/bus.js";
import type { Logger } from "../logger.js";
import type { BotStore } from "../db/store.js";

interface TrackedOrder {
  localId: string;
  clientOrderId: string;
  exchangeOrderId: string;
  side: "buy" | "sell";
  price: number;
  size: number;
  gridIndex: number;
}

export interface RunnerDeps {
  store: BotStore;
  bus: EventBus;
  logger: Logger;
  reconcileMs: number;
}

export interface RunnerInit {
  id: string;
  config: GridConfig;
  adapter: ExchangeAdapter;
  engine: GridEngine;
  deps: RunnerDeps;
  status?: BotStatus;
  startedAt?: number | null;
}

const PRICE_EPS = 1e-9;

/**
 * Drives one grid bot: subscribes to venue fills, folds them into the engine,
 * and on each reconcile tick diffs the engine's desired orders against what is
 * resting — placing and cancelling to converge. All venue interaction goes
 * through the {@link ExchangeAdapter}, so paper and live behave identically.
 */
export class BotRunner {
  readonly id: string;
  readonly config: GridConfig;
  private readonly adapter: ExchangeAdapter;
  private readonly engine: GridEngine;
  private readonly deps: RunnerDeps;

  private status: BotStatus;
  private startedAt: number | null;
  private lastError: string | undefined;
  private latestMark = 0;

  private readonly openByIndex = new Map<number, TrackedOrder>();
  private readonly clientToIndex = new Map<string, number>();
  private readonly flattenClientIds = new Set<string>();
  private seq = 0;

  private timer: ReturnType<typeof setInterval> | null = null;
  private reconciling = false;
  private unsubFills: (() => void) | null = null;
  private unsubMark: (() => void) | null = null;

  constructor(init: RunnerInit) {
    this.id = init.id;
    this.config = init.config;
    this.adapter = init.adapter;
    this.engine = init.engine;
    this.deps = init.deps;
    this.status = init.status ?? "idle";
    this.startedAt = init.startedAt ?? null;
  }

  getStatus(): BotStatus {
    return this.status;
  }

  // --- lifecycle -----------------------------------------------------------

  async start(): Promise<void> {
    if (this.status === "running") return;
    this.unsubFills = this.adapter.watchFills(this.config.symbol, (f) => this.handleFill(f));
    this.unsubMark = this.adapter.watchMarkPrice(this.config.symbol, (m) => {
      this.latestMark = m;
      this.deps.bus.publish({ type: "markPrice", botId: this.id, markPrice: m });
    });
    await this.adapter.connect();
    this.latestMark = await this.adapter.getMarkPrice(this.config.symbol);

    this.startedAt ??= Date.now();
    this.setStatus("running");
    this.log("info", `bot started on ${this.config.exchange} ${this.config.symbol}`);

    if (this.deps.reconcileMs > 0) {
      this.timer = setInterval(() => void this.reconcileOnce(), this.deps.reconcileMs);
      this.timer.unref?.();
    }
    await this.reconcileOnce();
  }

  async pause(): Promise<void> {
    this.clearTimer();
    this.setStatus("paused");
    this.log("info", "bot paused (orders left resting)");
  }

  async resume(): Promise<void> {
    if (this.status === "running") return;
    this.setStatus("running");
    if (this.deps.reconcileMs > 0) {
      this.timer = setInterval(() => void this.reconcileOnce(), this.deps.reconcileMs);
      this.timer.unref?.();
    }
    await this.reconcileOnce();
    this.log("info", "bot resumed");
  }

  async stop(): Promise<void> {
    this.setStatus("stopping");
    this.clearTimer();
    await this.cancelAllOrders();
    this.unsubFills?.();
    this.unsubMark?.();
    this.unsubFills = null;
    this.unsubMark = null;
    await this.adapter.disconnect();
    this.setStatus("idle");
    this.log("info", "bot stopped");
  }

  /** Cancel all orders and force-close any open position at the mark. */
  async flatten(): Promise<void> {
    await this.cancelAllOrders();
    const pos = this.engine.position;
    if (Math.abs(pos.netQty) < PRICE_EPS) return;
    const mark = this.latestMark || (await this.adapter.getMarkPrice(this.config.symbol));
    const side = pos.netQty > 0 ? "sell" : "buy";
    // Cross the mark so the closing order fills immediately.
    const price = side === "sell" ? mark * 0.999 : mark * 1.001;
    const clientOrderId = `${this.id}:flatten:${++this.seq}`;
    this.flattenClientIds.add(clientOrderId);
    await this.adapter.placeOrder({
      symbol: this.config.symbol,
      side,
      price,
      size: Math.abs(pos.netQty),
      clientOrderId,
      reduceOnly: true,
    });
    this.log(
      "warn",
      `flattening ${pos.netQty > 0 ? "long" : "short"} ${Math.abs(pos.netQty)} at ~${mark}`,
    );
  }

  dispose(): void {
    this.clearTimer();
    this.unsubFills?.();
    this.unsubMark?.();
  }

  // --- reconcile -----------------------------------------------------------

  /** One convergence pass: seed the engine, honour exits, diff and converge orders. */
  async reconcileOnce(): Promise<void> {
    if (this.reconciling || this.status !== "running") return;
    this.reconciling = true;
    try {
      const mark = await this.adapter.getMarkPrice(this.config.symbol);
      this.latestMark = mark;
      this.engine.initialize(mark);

      if (this.checkExits(mark)) return;

      const desired = this.engine.desiredOrders(mark);
      const desiredByIndex = new Map(desired.map((d) => [d.gridIndex, d]));

      // Cancel stale / mismatched resting orders.
      for (const [gi, tracked] of [...this.openByIndex]) {
        const d = desiredByIndex.get(gi);
        if (!d || d.side !== tracked.side || Math.abs(d.price - tracked.price) > PRICE_EPS) {
          await this.cancelTracked(tracked);
        }
      }
      // Place newly-desired orders.
      for (const d of desired) {
        if (this.openByIndex.has(d.gridIndex)) continue;
        await this.placeOrder(d.gridIndex, d.side, d.price, d.size);
      }
    } catch (err) {
      this.fail(err);
    } finally {
      this.reconciling = false;
    }
  }

  /** Returns true if an exit fired (and the bot is winding down). */
  private checkExits(mark: number): boolean {
    const { stopLossPrice, takeProfitPrice } = this.config;
    if (stopLossPrice !== undefined && mark <= stopLossPrice) {
      this.log("warn", `stop-loss hit at ${mark} (<= ${stopLossPrice})`);
      void this.flatten().then(() => this.stop());
      return true;
    }
    if (takeProfitPrice !== undefined && mark >= takeProfitPrice) {
      this.log("warn", `take-profit hit at ${mark} (>= ${takeProfitPrice})`);
      void this.flatten().then(() => this.stop());
      return true;
    }
    return false;
  }

  private async placeOrder(
    gridIndex: number,
    side: "buy" | "sell",
    price: number,
    size: number,
  ): Promise<void> {
    const clientOrderId = `${this.id}:${gridIndex}:${++this.seq}`;
    const venueOrder = await this.adapter.placeOrder({
      symbol: this.config.symbol,
      side,
      price,
      size,
      clientOrderId,
    });
    const localId = randomUUID();
    const tracked: TrackedOrder = {
      localId,
      clientOrderId,
      exchangeOrderId: venueOrder.exchangeOrderId,
      side,
      price,
      size,
      gridIndex,
    };
    this.openByIndex.set(gridIndex, tracked);
    this.clientToIndex.set(clientOrderId, gridIndex);

    const now = Date.now();
    this.deps.store.insertOrder({
      id: localId,
      botId: this.id,
      exchange: this.config.exchange,
      symbol: this.config.symbol,
      side,
      price,
      size,
      status: "open",
      gridIndex,
      clientOrderId,
      exchangeOrderId: venueOrder.exchangeOrderId,
      createdAt: now,
      updatedAt: now,
    });
    this.deps.bus.publish({ type: "order", order: this.toSharedOrder(tracked, "open", now) });
  }

  private async cancelTracked(tracked: TrackedOrder): Promise<void> {
    await this.adapter.cancelOrder(this.config.symbol, tracked.exchangeOrderId);
    this.openByIndex.delete(tracked.gridIndex);
    this.clientToIndex.delete(tracked.clientOrderId);
    const now = Date.now();
    this.deps.store.updateOrder(tracked.localId, { status: "cancelled", updatedAt: now });
    this.deps.bus.publish({ type: "order", order: this.toSharedOrder(tracked, "cancelled", now) });
  }

  private async cancelAllOrders(): Promise<void> {
    for (const tracked of [...this.openByIndex.values()]) {
      try {
        await this.cancelTracked(tracked);
      } catch (err) {
        this.deps.logger.warn({ err }, "cancel failed during teardown");
      }
    }
  }

  // --- fills ---------------------------------------------------------------

  private handleFill(f: VenueFill): void {
    try {
      const isFlatten = this.flattenClientIds.has(f.clientOrderId);
      const gridIndex = isFlatten ? -1 : (this.clientToIndex.get(f.clientOrderId) ?? -1);

      if (isFlatten) {
        this.flattenClientIds.delete(f.clientOrderId);
        this.engine.recordFlattenFill({ side: f.side, price: f.price, size: f.size, fee: f.fee });
      } else {
        this.engine.recordFill({
          gridIndex,
          side: f.side,
          price: f.price,
          size: f.size,
          fee: f.fee,
        });
        const tracked = this.openByIndex.get(gridIndex);
        if (tracked && tracked.clientOrderId === f.clientOrderId) {
          this.openByIndex.delete(gridIndex);
          this.clientToIndex.delete(f.clientOrderId);
        }
      }

      const fillId = randomUUID();
      const fillRecord = {
        id: fillId,
        botId: this.id,
        orderId: f.clientOrderId,
        exchange: this.config.exchange,
        symbol: f.symbol,
        side: f.side,
        price: f.price,
        size: f.size,
        fee: f.fee,
        gridIndex,
        timestamp: f.timestamp,
      };
      this.deps.store.insertFill(fillRecord);
      this.persistEngineState();

      this.deps.bus.publish({ type: "fill", fill: fillRecord });
      this.deps.bus.publish({ type: "pnl", botId: this.id, pnl: this.engine.pnl(this.latestMark) });
      this.deps.bus.publish({ type: "position", botId: this.id, position: this.buildPosition() });

      // Re-quote the counter rung promptly rather than waiting a full tick.
      void this.reconcileOnce();
    } catch (err) {
      this.fail(err);
    }
  }

  // --- snapshot / persistence ---------------------------------------------

  snapshot(): BotSnapshot {
    return {
      id: this.id,
      config: this.config,
      status: this.status,
      markPrice: this.latestMark,
      levels: this.engine.levels(),
      openOrders: [...this.openByIndex.values()].map((t) =>
        this.toSharedOrder(t, "open", Date.now()),
      ),
      position: this.buildPosition(),
      pnl: this.engine.pnl(this.latestMark),
      lastError: this.lastError,
      startedAt: this.startedAt,
      updatedAt: Date.now(),
    };
  }

  private buildPosition(): Position | null {
    const p = this.engine.position;
    if (Math.abs(p.netQty) < PRICE_EPS) return null;
    const unrealized = (this.latestMark - p.avgEntry) * p.netQty;
    return {
      exchange: this.config.exchange,
      symbol: this.config.symbol,
      netQty: p.netQty,
      avgEntry: p.avgEntry,
      markPrice: this.latestMark,
      unrealizedPnl: unrealized,
      updatedAt: Date.now(),
    };
  }

  private toSharedOrder(t: TrackedOrder, status: Order["status"], now: number): Order {
    return {
      id: t.localId,
      botId: this.id,
      exchange: this.config.exchange,
      symbol: this.config.symbol,
      side: t.side,
      price: t.price,
      size: t.size,
      status,
      gridIndex: t.gridIndex,
      clientOrderId: t.clientOrderId,
      exchangeOrderId: t.exchangeOrderId,
      filledSize: status === "filled" ? t.size : 0,
      createdAt: now,
      updatedAt: now,
    };
  }

  private persistEngineState(): void {
    this.deps.store.updateBot(this.id, {
      engineState: JSON.stringify(this.engine.getState()),
      status: this.status,
      updatedAt: Date.now(),
    });
  }

  private setStatus(status: BotStatus): void {
    this.status = status;
    this.deps.store.updateBot(this.id, {
      status,
      startedAt: this.startedAt,
      lastError: this.lastError ?? null,
      updatedAt: Date.now(),
    });
    this.deps.bus.publish({ type: "status", botId: this.id, status });
  }

  private fail(err: unknown): void {
    this.lastError = err instanceof Error ? err.message : String(err);
    this.deps.logger.error({ err, botId: this.id }, "bot error");
    this.clearTimer();
    this.setStatus("error");
    this.log("error", this.lastError);
  }

  private clearTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private log(level: LogLevel, message: string): void {
    const ts = Date.now();
    this.deps.store.appendLog({
      botId: this.id,
      exchange: this.config.exchange,
      level,
      message,
      ts,
    });
    this.deps.bus.publish({
      type: "log",
      entry: { ts, level, botId: this.id, exchange: this.config.exchange, message },
    });
  }
}
