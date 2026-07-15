import type { ExchangeId } from "@gridbot/shared";
import type {
  ExchangeAdapter,
  PlaceOrderParams,
  Unsubscribe,
  VenueFill,
  VenueOrder,
} from "../../types.js";
import { ExtendedClient, type ExtendedNetwork, type ExtendedStarknetInfo } from "./client.js";
import { scaleAmounts, signOrder } from "./sign.js";

export interface ExtendedAdapterConfig {
  apiKey: string;
  /** Stark private key (hex). Only revealed at the signing boundary. */
  starkPrivateKey: string;
  /** Collateral position / vault id. */
  vaultId: string;
  network?: ExtendedNetwork;
  fetchImpl?: typeof fetch;
  /** Mark-price poll cadence (ms) for watchMarkPrice. */
  pollMs?: number;
  /**
   * Order signing is UNVERIFIED (see sign.ts). Placement throws unless this is
   * explicitly set true — a hard guard against sending mis-signed orders.
   */
  allowUnverifiedSigning?: boolean;
  /** Default per-order fee rate used when scaling the signed fee amount. */
  feeRate?: number;
}

/**
 * Live Extended (Starknet) adapter. Read paths (mark price, balance, open
 * orders, cancel) are functional. Order placement builds + signs per the
 * documented SNIP-12 scheme but is gated behind `allowUnverifiedSigning` until
 * validated against a testnet round-trip.
 */
export class ExtendedAdapter implements ExchangeAdapter {
  readonly id: ExchangeId = "extended";

  private readonly client: ExtendedClient;
  private readonly config: ExtendedAdapterConfig;
  private readonly pollMs: number;
  private starknetInfo: ExtendedStarknetInfo | null = null;
  private saltSeq = 0n;
  private readonly markTimers = new Set<ReturnType<typeof setInterval>>();

  constructor(config: ExtendedAdapterConfig) {
    this.config = config;
    this.pollMs = config.pollMs ?? 2000;
    this.client = new ExtendedClient({
      network: config.network ?? "testnet",
      apiKey: config.apiKey,
      fetchImpl: config.fetchImpl,
    });
  }

  async connect(): Promise<void> {
    // Cache the SNIP-12 signing domain up front.
    this.starknetInfo = await this.client.getStarknetInfo();
  }

  async disconnect(): Promise<void> {
    for (const t of this.markTimers) clearInterval(t);
    this.markTimers.clear();
  }

  getMarkPrice(symbol: string): Promise<number> {
    return this.client.getMarkPrice(symbol);
  }

  getBalanceUsd(): Promise<number> {
    return this.client.getBalanceUsd();
  }

  async placeOrder(params: PlaceOrderParams): Promise<VenueOrder> {
    if (!this.config.allowUnverifiedSigning) {
      throw new Error(
        "[extended] order signing is UNVERIFIED — refusing to place. Validate the " +
          "SNIP-12 signing against a testnet fill, then set allowUnverifiedSigning: true. " +
          "See packages/exchanges/src/live/extended/sign.ts.",
      );
    }
    const info = this.starknetInfo ?? (await this.client.getStarknetInfo());
    const market = await this.client.getMarket(params.symbol);
    const feeRate = this.config.feeRate ?? 0.0005;
    const expirationSeconds = Math.floor(Date.now() / 1000) + 3600;

    const amounts = scaleAmounts(params.side, params.size, params.price, feeRate, market.l2Config);
    const signed = signOrder(this.config.starkPrivateKey, info, {
      positionId: this.config.vaultId,
      amounts,
      l2: market.l2Config,
      expirationSeconds,
      salt: ++this.saltSeq,
    });

    const placed = await this.client.placeOrder({
      id: BigInt(signed.orderIdHex).toString(10),
      market: params.symbol,
      type: "LIMIT",
      side: params.side.toUpperCase(),
      qty: String(params.size),
      price: String(params.price),
      timeInForce: "GTT",
      expiryEpochMillis: expirationSeconds * 1000,
      fee: String(feeRate),
      nonce: String(this.saltSeq),
      reduceOnly: params.reduceOnly ?? false,
      postOnly: true,
      settlement: {
        signature: signed.signature,
        starkKey: signed.starkKey,
        collateralPosition: this.config.vaultId,
      },
    });

    return {
      exchangeOrderId: String(placed.id),
      clientOrderId: params.clientOrderId,
      symbol: params.symbol,
      side: params.side,
      price: params.price,
      size: params.size,
      status: "open",
    };
  }

  async cancelOrder(_symbol: string, exchangeOrderId: string): Promise<void> {
    await this.client.cancelOrder(exchangeOrderId);
  }

  async getOpenOrders(symbol: string): Promise<VenueOrder[]> {
    const orders = await this.client.getOpenOrders(symbol);
    return orders.map((o) => ({
      exchangeOrderId: String(o.id),
      clientOrderId: o.externalId,
      symbol: o.market,
      side: o.side.toLowerCase() === "buy" ? "buy" : "sell",
      price: Number(o.price),
      size: Number(o.qty),
      status: "open",
    }));
  }

  watchFills(_symbol: string, _cb: (fill: VenueFill) => void): Unsubscribe {
    // Fill streaming (WS) is not implemented yet; the runner also reconciles
    // via getOpenOrders on each tick, so fills are detected by order disappearance.
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
