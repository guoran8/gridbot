import type { ExchangeId } from "@gridbot/shared";
import type {
  ExchangeAdapter,
  PlaceOrderParams,
  Unsubscribe,
  VenueFill,
  VenueOrder,
} from "../../types.js";
import { priceToTicks, RisexClient, type RisexNetwork, sizeToSteps } from "./client.js";

export interface RisexAdapterConfig {
  /** EVM API-wallet private key (hex). */
  privateKey: string;
  /** Account address (0x…) that holds collateral. */
  accountAddress: string;
  network?: RisexNetwork;
  fetchImpl?: typeof fetch;
  pollMs?: number;
  /** Token address for balance queries (USDC on RISE). */
  collateralToken?: string;
  /**
   * DEV/TEST ONLY. When set, placement uses the API's `signer_private_key`
   * permit field — i.e. the RISEx server signs on your behalf, which means
   * sending the key to the API. Never enable this with real funds.
   */
  allowInsecureServerSigning?: boolean;
}

/**
 * Live RISEx (RISE Chain) adapter. Reads (markets, mark price, balance) work.
 *
 * ⚠️ Order placement is NOT production-ready: RISEx signs orders with an
 * EIP-712 "VerifyWitness" permit whose struct + nonce scheme are not yet
 * published (the API is under heavy development). The only documented path is
 * the dev-only `signer_private_key` field, which sends the key to the server —
 * so `placeOrder` throws unless `allowInsecureServerSigning` is explicitly set
 * (testnet only). Client-side EIP-712 signing lands when RISEx publishes the
 * typed-data struct.
 */
export class RisexAdapter implements ExchangeAdapter {
  readonly id: ExchangeId = "risex";

  private readonly client: RisexClient;
  private readonly config: RisexAdapterConfig;
  private readonly pollMs: number;
  private readonly markTimers = new Set<ReturnType<typeof setInterval>>();

  constructor(config: RisexAdapterConfig) {
    this.config = config;
    this.pollMs = config.pollMs ?? 2000;
    this.client = new RisexClient({
      network: config.network ?? "testnet",
      fetchImpl: config.fetchImpl,
    });
  }

  async connect(): Promise<void> {
    /* stateless REST client */
  }

  async disconnect(): Promise<void> {
    for (const t of this.markTimers) clearInterval(t);
    this.markTimers.clear();
  }

  getMarkPrice(symbol: string): Promise<number> {
    return this.client.getMarkPrice(symbol);
  }

  async getBalanceUsd(): Promise<number> {
    const raw = await this.client.getBalance(
      this.config.accountAddress,
      this.config.collateralToken,
    );
    return Number(raw);
  }

  async placeOrder(params: PlaceOrderParams): Promise<VenueOrder> {
    if (!this.config.allowInsecureServerSigning) {
      throw new Error(
        "[risex] order placement is not enabled — RISEx's EIP-712 VerifyWitness " +
          "struct is not published, and the only documented path (permit.signer_private_key) " +
          "sends your key to the API. Testnet-only: set allowInsecureServerSigning: true. " +
          "See packages/exchanges/src/live/risex/adapter.ts.",
      );
    }
    const market = await this.client.getMarket(params.symbol);
    const priceTicks = priceToTicks(params.price, Number(market.step_price));
    const sizeSteps = sizeToSteps(params.size, Number(market.step_size));

    const placed = await this.client.placeOrder({
      market_id: market.market_id,
      size_steps: sizeSteps,
      price_ticks: priceTicks,
      side: params.side === "buy" ? 0 : 1,
      post_only: !params.reduceOnly,
      reduce_only: params.reduceOnly ?? false,
      order_type: 1, // Limit
      time_in_force: 0, // GTC
      client_order_id: params.clientOrderId,
      permit: {
        account: this.config.accountAddress,
        signer: this.config.accountAddress,
        deadline: Math.floor(Date.now() / 1000) + 60,
        // DEV ONLY — server-side signing.
        signer_private_key: this.config.privateKey,
      },
      no_retry: false,
    });

    return {
      exchangeOrderId: placed.order_id,
      clientOrderId: params.clientOrderId,
      symbol: params.symbol,
      side: params.side,
      price: params.price,
      size: params.size,
      status: "open",
    };
  }

  async cancelOrder(symbol: string, exchangeOrderId: string): Promise<void> {
    if (!this.config.allowInsecureServerSigning) return;
    const market = await this.client.getMarket(symbol);
    await this.client.cancelOrder({
      market_id: market.market_id,
      order_id: exchangeOrderId,
      permit: {
        account: this.config.accountAddress,
        signer: this.config.accountAddress,
        deadline: Math.floor(Date.now() / 1000) + 60,
        signer_private_key: this.config.privateKey,
      },
      no_retry: false,
    });
  }

  async getOpenOrders(_symbol: string): Promise<VenueOrder[]> {
    // RISEx's open-orders endpoint path isn't stably documented yet; the runner
    // reconciles from its own tracked set, so returning [] is safe (no orders
    // are ever placed live until signing is enabled anyway).
    return [];
  }

  watchFills(_symbol: string, _cb: (fill: VenueFill) => void): Unsubscribe {
    return () => {};
  }

  watchMarkPrice(symbol: string, cb: (mark: number) => void): Unsubscribe {
    const timer = setInterval(() => {
      void this.client
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
