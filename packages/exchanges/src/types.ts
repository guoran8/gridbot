import type { ExchangeId, OrderSide, OrderStatus } from "@gridbot/shared";

export interface PlaceOrderParams {
  symbol: string;
  side: OrderSide;
  price: number;
  size: number;
  /** Idempotency key the bot assigns; echoed back on the order and its fills. */
  clientOrderId: string;
  /** Only reduce an existing position (used when flattening). */
  reduceOnly?: boolean;
}

export interface VenueOrder {
  exchangeOrderId: string;
  clientOrderId: string;
  symbol: string;
  side: OrderSide;
  price: number;
  size: number;
  status: OrderStatus;
}

export interface VenueFill {
  exchangeOrderId: string;
  clientOrderId: string;
  symbol: string;
  side: OrderSide;
  price: number;
  size: number;
  /** Quote-currency fee (USD); negative = maker rebate. */
  fee: number;
  timestamp: number;
}

export type Unsubscribe = () => void;

/**
 * The uniform contract every venue implements. The bot runner speaks only this
 * interface — paper simulator and the three live DEXs are interchangeable.
 *
 * Fills and mark-price updates are push-based (`watch*`); everything else is a
 * request/response the runner calls on its reconcile tick.
 */
export interface ExchangeAdapter {
  readonly id: ExchangeId;

  /** Open connections / authenticate. Safe to call once before use. */
  connect(): Promise<void>;
  /** Tear down connections and timers. */
  disconnect(): Promise<void>;

  getMarkPrice(symbol: string): Promise<number>;
  /** Free collateral in USD available for new orders. */
  getBalanceUsd(): Promise<number>;

  placeOrder(params: PlaceOrderParams): Promise<VenueOrder>;
  cancelOrder(symbol: string, exchangeOrderId: string): Promise<void>;
  getOpenOrders(symbol: string): Promise<VenueOrder[]>;

  /** Subscribe to executions for a symbol. Returns an unsubscribe fn. */
  watchFills(symbol: string, cb: (fill: VenueFill) => void): Unsubscribe;
  /** Subscribe to mark-price updates for a symbol. Returns an unsubscribe fn. */
  watchMarkPrice(symbol: string, cb: (mark: number) => void): Unsubscribe;
}

/** Fee schedule used to price fills (fraction of notional). */
export interface FeeSchedule {
  makerRate: number;
  takerRate: number;
}
