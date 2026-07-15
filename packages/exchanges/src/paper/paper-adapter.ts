import type { ExchangeId } from "@gridbot/shared";
import type {
  ExchangeAdapter,
  FeeSchedule,
  PlaceOrderParams,
  Unsubscribe,
  VenueFill,
  VenueOrder,
} from "../types.js";
import { PriceSim } from "./price-sim.js";

export interface PaperAdapterOptions {
  /** Seed price for the simulator (typically the grid band midpoint). */
  startPrice: number;
  feeSchedule?: FeeSchedule;
  /** Simulator step cadence in ms (0 disables the internal timer). */
  tickMs?: number;
  volatility?: number;
  reversion?: number;
  seed?: number;
  startBalanceUsd?: number;
}

interface RestingOrder extends VenueOrder {}

const DEFAULT_FEES: FeeSchedule = { makerRate: 0.0002, takerRate: 0.0005 };

/**
 * Fully-working in-memory exchange used by paper mode. No keys, no network.
 * Steps a bounded random-walk price and fills resting limit orders when the
 * simulated mark crosses them, charging the maker fee — so paper PnL reflects
 * the fee drag that actually decides whether a grid is profitable.
 */
export class PaperAdapter implements ExchangeAdapter {
  readonly id: ExchangeId = "paper";

  private readonly sim: PriceSim;
  private readonly fees: FeeSchedule;
  private readonly tickMs: number;
  private balanceUsd: number;

  private readonly orders = new Map<string, RestingOrder>();
  private readonly fillSubs = new Set<(f: VenueFill) => void>();
  private readonly markSubs = new Set<(m: number) => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private seq = 0;

  constructor(opts: PaperAdapterOptions) {
    this.sim = new PriceSim({
      start: opts.startPrice,
      anchor: opts.startPrice,
      volatility: opts.volatility,
      reversion: opts.reversion,
      seed: opts.seed,
    });
    this.fees = opts.feeSchedule ?? DEFAULT_FEES;
    this.tickMs = opts.tickMs ?? 1000;
    this.balanceUsd = opts.startBalanceUsd ?? 10_000;
  }

  async connect(): Promise<void> {
    if (this.timer || this.tickMs <= 0) return;
    this.timer = setInterval(() => this.stepOnce(), this.tickMs);
    // Don't keep the event loop alive solely for the paper clock.
    this.timer.unref?.();
  }

  async disconnect(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.fillSubs.clear();
    this.markSubs.clear();
  }

  async getMarkPrice(_symbol: string): Promise<number> {
    return this.sim.current();
  }

  async getBalanceUsd(): Promise<number> {
    return this.balanceUsd;
  }

  async placeOrder(params: PlaceOrderParams): Promise<VenueOrder> {
    const order: RestingOrder = {
      exchangeOrderId: `paper-${++this.seq}`,
      clientOrderId: params.clientOrderId,
      symbol: params.symbol,
      side: params.side,
      price: params.price,
      size: params.size,
      status: "open",
    };
    this.orders.set(order.exchangeOrderId, order);
    return { ...order };
  }

  async cancelOrder(_symbol: string, exchangeOrderId: string): Promise<void> {
    this.orders.delete(exchangeOrderId);
  }

  async getOpenOrders(symbol: string): Promise<VenueOrder[]> {
    return [...this.orders.values()].filter((o) => o.symbol === symbol).map((o) => ({ ...o }));
  }

  watchFills(_symbol: string, cb: (f: VenueFill) => void): Unsubscribe {
    this.fillSubs.add(cb);
    return () => this.fillSubs.delete(cb);
  }

  watchMarkPrice(_symbol: string, cb: (m: number) => void): Unsubscribe {
    this.markSubs.add(cb);
    return () => this.markSubs.delete(cb);
  }

  /** Advance the simulated price one step and fill any crossed resting orders. */
  stepOnce(): number {
    const mark = this.sim.step();
    for (const m of this.markSubs) m(mark);

    for (const order of [...this.orders.values()]) {
      const crossed =
        (order.side === "buy" && mark <= order.price) ||
        (order.side === "sell" && mark >= order.price);
      if (!crossed) continue;

      this.orders.delete(order.exchangeOrderId);
      const notional = order.price * order.size;
      const fee = notional * this.fees.makerRate;
      // Maker fill executes at the resting limit price.
      this.balanceUsd -= fee;
      const fill: VenueFill = {
        exchangeOrderId: order.exchangeOrderId,
        clientOrderId: order.clientOrderId,
        symbol: order.symbol,
        side: order.side,
        price: order.price,
        size: order.size,
        fee,
        timestamp: this.simClock(),
      };
      for (const cb of this.fillSubs) cb(fill);
    }
    return mark;
  }

  /**
   * Monotonic-ish clock for fill timestamps. Uses Date.now when available; the
   * paper adapter runs in a normal Node process (not a workflow sandbox).
   */
  private simClock(): number {
    return Date.now();
  }
}
