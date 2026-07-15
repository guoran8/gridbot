import type { ExchangeId } from "@gridbot/shared";
import { type ExchangeClient, OrderType, Side, StpMode, TimeInForce } from "risex-client";
import type {
  ExchangeAdapter,
  PlaceOrderParams,
  Unsubscribe,
  VenueFill,
  VenueOrder,
} from "../../types.js";
import { priceToTicks, RisexClient, type RisexNetwork, sizeToSteps } from "./client.js";

export interface RisexAdapterConfig {
  /** Signer/session-key private key (hex). Registered in the RISEx web UI. */
  privateKey: string;
  /** Account address (0x…) that holds collateral. */
  accountAddress: string;
  network?: RisexNetwork;
  fetchImpl?: typeof fetch;
  pollMs?: number;
  /** Token address for balance queries (USDC on RISE). */
  collateralToken?: string;
  /**
   * Placement uses the community risex-client SDK's EIP-712 signing (local, key
   * never leaves the process). Still gated: RISE is an early-mainnet venue and
   * the SDK is explicitly "not production ready", so live trading is opt-in.
   */
  allowLive?: boolean;
}

const REST_BASE = {
  mainnet: "https://api.rise.trade",
  testnet: "https://api.testnet.rise.trade",
} as const;

/**
 * Live RISEx (RISE Chain) adapter. Reads go through the plain REST client;
 * order placement/cancellation go through the community `risex-client` SDK,
 * which signs the EIP-712 VerifyWitness permit locally with the signer key
 * (ethers). Placement is gated behind `allowLive`.
 */
export class RisexAdapter implements ExchangeAdapter {
  readonly id: ExchangeId = "risex";

  private readonly reader: RisexClient;
  private readonly config: RisexAdapterConfig;
  private readonly network: RisexNetwork;
  private readonly pollMs: number;
  private readonly markTimers = new Set<ReturnType<typeof setInterval>>();
  private exchange: ExchangeClient | null = null;

  constructor(config: RisexAdapterConfig) {
    this.config = config;
    this.network = config.network ?? "testnet";
    this.pollMs = config.pollMs ?? 2000;
    this.reader = new RisexClient({ network: this.network, fetchImpl: config.fetchImpl });
  }

  async connect(): Promise<void> {
    /* readers are stateless; the signing client is built lazily on first order */
  }

  async disconnect(): Promise<void> {
    for (const t of this.markTimers) clearInterval(t);
    this.markTimers.clear();
  }

  getMarkPrice(symbol: string): Promise<number> {
    return this.reader.getMarkPrice(symbol);
  }

  async getBalanceUsd(): Promise<number> {
    const raw = await this.reader.getBalance(
      this.config.accountAddress,
      this.config.collateralToken,
    );
    return Number(raw);
  }

  /** Lazily build + init the signing client (dynamic import keeps ethers off the read path). */
  private async getExchange(): Promise<ExchangeClient> {
    if (this.exchange) return this.exchange;
    const { ExchangeClient } = await import("risex-client");
    const client = new ExchangeClient({
      account: this.config.accountAddress,
      signerKey: this.config.privateKey,
      baseUrl: REST_BASE[this.network],
    });
    await client.init();
    this.exchange = client;
    return client;
  }

  async placeOrder(params: PlaceOrderParams): Promise<VenueOrder> {
    if (!this.config.allowLive) {
      throw new Error(
        "[risex] live trading disabled — RISE is early-mainnet and risex-client is " +
          "marked not-production-ready. Set allowLive: true after testnet validation.",
      );
    }
    const market = await this.reader.getMarket(params.symbol);
    const priceTicks = priceToTicks(params.price, Number(market.step_price));
    const sizeSteps = sizeToSteps(params.size, Number(market.step_size));
    const exchange = await this.getExchange();

    const res = await exchange.placeOrder({
      market_id: market.market_id,
      side: params.side === "buy" ? Side.Long : Side.Short,
      order_type: OrderType.Limit,
      price_ticks: priceTicks,
      size_steps: sizeSteps,
      time_in_force: TimeInForce.GoodTillCancelled,
      post_only: !params.reduceOnly,
      reduce_only: params.reduceOnly ?? false,
      stp_mode: StpMode.ExpireMaker,
      ttl_units: 0,
      client_order_id: params.clientOrderId,
    });

    return {
      exchangeOrderId: res.order_id,
      clientOrderId: params.clientOrderId,
      symbol: params.symbol,
      side: params.side,
      price: params.price,
      size: params.size,
      status: "open",
    };
  }

  async cancelOrder(symbol: string, exchangeOrderId: string): Promise<void> {
    if (!this.config.allowLive) return;
    const market = await this.reader.getMarket(symbol);
    const exchange = await this.getExchange();
    await exchange.cancelOrder({ market_id: market.market_id, order_id: exchangeOrderId });
  }

  async getOpenOrders(symbol: string): Promise<VenueOrder[]> {
    const market = await this.reader.getMarket(symbol).catch(() => null);
    if (!market) return [];
    try {
      const { InfoClient } = await import("risex-client");
      const info = new InfoClient({ baseUrl: REST_BASE[this.network] });
      const orders = await info.getOpenOrders(this.config.accountAddress, market.market_id);
      return orders.map((o) => ({
        exchangeOrderId: String(o.order_id),
        clientOrderId: String(o.client_order_id ?? o.order_id),
        symbol,
        side: Number(o.side) === Side.Long ? "buy" : "sell",
        price: priceToNumber(o.price_ticks, Number(market.step_price)),
        size: sizeToNumber(o.size_steps, Number(market.step_size)),
        status: "open" as const,
      }));
    } catch {
      return [];
    }
  }

  watchFills(_symbol: string, _cb: (fill: VenueFill) => void): Unsubscribe {
    return () => {};
  }

  watchMarkPrice(symbol: string, cb: (mark: number) => void): Unsubscribe {
    const timer = setInterval(() => {
      void this.reader
        .getMarkPrice(symbol)
        .then(cb)
        .catch(() => {});
    }, this.pollMs);
    timer.unref?.();
    this.markTimers.add(timer);
    return () => {
      clearInterval(timer);
      this.markTimers.delete(timer);
    };
  }
}

function priceToNumber(ticks: unknown, stepPrice: number): number {
  return Number(ticks) * stepPrice;
}
function sizeToNumber(steps: unknown, stepSize: number): number {
  return Number(steps) * stepSize;
}
