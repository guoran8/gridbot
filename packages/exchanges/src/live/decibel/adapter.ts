import { Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";
import {
  DecibelReadDex,
  DecibelWriteDex,
  MAINNET_CONFIG,
  TESTNET_CONFIG,
  TimeInForce,
} from "@decibeltrade/sdk";
import type { ExchangeId } from "@gridbot/shared";
import type {
  ExchangeAdapter,
  PlaceOrderParams,
  Unsubscribe,
  VenueFill,
  VenueOrder,
} from "../../types.js";

export interface DecibelAdapterConfig {
  /** API Wallet Ed25519 private key (hex). Distinct from the login wallet. */
  privateKey: string;
  /** Trading Account (Subaccount) object address that holds collateral. */
  subaccountAddress: string;
  network?: "mainnet" | "testnet";
  /** Aptos node API key (geomi.dev) for REST reads / rate limits. */
  nodeApiKey?: string;
  pollMs?: number;
  /**
   * Placement submits a real on-chain Aptos transaction (gas + funds). Signing
   * is handled by the official @decibeltrade/sdk (trusted), but live trading is
   * still gated behind this explicit opt-in.
   */
  allowLive?: boolean;
}

/**
 * Live Decibel (Aptos) adapter. Order signing + submission goes through the
 * official @decibeltrade/sdk (`DecibelWriteDex`), which builds and signs the
 * Aptos Move transaction — so we never hand-roll the signing. Reads use
 * `DecibelReadDex`. Placement is gated behind `allowLive`.
 */
export class DecibelAdapter implements ExchangeAdapter {
  readonly id: ExchangeId = "decibel";

  private readonly read: DecibelReadDex;
  private readonly write: DecibelWriteDex;
  private readonly config: DecibelAdapterConfig;
  private readonly pollMs: number;
  private readonly markTimers = new Set<ReturnType<typeof setInterval>>();

  constructor(config: DecibelAdapterConfig) {
    this.config = config;
    this.pollMs = config.pollMs ?? 2000;
    const sdkConfig = config.network === "mainnet" ? MAINNET_CONFIG : TESTNET_CONFIG;
    const account = Account.fromPrivateKey({
      privateKey: new Ed25519PrivateKey(config.privateKey),
    });
    const opts = config.nodeApiKey ? { nodeApiKey: config.nodeApiKey } : undefined;
    this.read = new DecibelReadDex(sdkConfig, opts);
    this.write = new DecibelWriteDex(sdkConfig, account, opts);
  }

  async connect(): Promise<void> {
    /* readers/writers are stateless HTTP+chain clients; nothing to open */
  }

  async disconnect(): Promise<void> {
    for (const t of this.markTimers) clearInterval(t);
    this.markTimers.clear();
  }

  async getMarkPrice(symbol: string): Promise<number> {
    const prices = await this.read.marketPrices.getByName({ marketName: symbol });
    const price = Array.isArray(prices) ? prices[0] : prices;
    if (!price) throw new Error(`[decibel] no price for ${symbol}`);
    return price.mark_px;
  }

  async getBalanceUsd(): Promise<number> {
    const overview = await this.read.accountOverview.getByAddr({
      subAddr: this.config.subaccountAddress,
    });
    return overview.perp_equity_balance;
  }

  async placeOrder(params: PlaceOrderParams): Promise<VenueOrder> {
    if (!this.config.allowLive) {
      throw new Error(
        "[decibel] live trading disabled — placement submits a real on-chain Aptos " +
          "transaction. Set allowLive: true (GRIDBOT_DECIBEL_ALLOW_LIVE=true) to enable.",
      );
    }
    const result = await this.write.placeOrder({
      marketName: params.symbol,
      price: params.price,
      size: params.size,
      isBuy: params.side === "buy",
      timeInForce: params.reduceOnly ? TimeInForce.ImmediateOrCancel : TimeInForce.PostOnly,
      isReduceOnly: params.reduceOnly ?? false,
      clientOrderId: params.clientOrderId,
      subaccountAddr: this.config.subaccountAddress,
    });
    if (!result.success) throw new Error(`[decibel] placeOrder failed: ${result.error}`);

    return {
      exchangeOrderId: result.orderId ?? params.clientOrderId,
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
    await this.write.cancelOrder({
      orderId: exchangeOrderId,
      marketName: symbol,
      subaccountAddr: this.config.subaccountAddress,
    });
  }

  async getOpenOrders(symbol: string): Promise<VenueOrder[]> {
    const res = await this.read.userOpenOrders.getByAddr({
      subAddr: this.config.subaccountAddress,
    });
    return res.items
      .filter((o) => o.market === symbol)
      .map((o) => ({
        exchangeOrderId: o.order_id,
        clientOrderId: o.client_order_id ?? o.order_id,
        symbol: o.market,
        side: o.is_buy ? "buy" : "sell",
        price: o.price ?? 0,
        size: o.orig_size ?? 0,
        status: "open" as const,
      }));
  }

  watchFills(_symbol: string, _cb: (fill: VenueFill) => void): Unsubscribe {
    // The runner reconciles via getOpenOrders; a WS fill stream can be added later.
    return () => {};
  }

  watchMarkPrice(symbol: string, cb: (mark: number) => void): Unsubscribe {
    const timer = setInterval(() => {
      void this.getMarkPrice(symbol)
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
