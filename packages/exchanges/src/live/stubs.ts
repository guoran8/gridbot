import type { ExchangeId } from "@gridbot/shared";
import type {
  ExchangeAdapter,
  PlaceOrderParams,
  Unsubscribe,
  VenueFill,
  VenueOrder,
} from "../types.js";

/**
 * Credentials for a live venue. Held opaquely here; the real adapters
 * (Phase 6) reveal them only at the signing boundary.
 */
export interface LiveCredentials {
  /** Extended: Stark private key. Decibel: Aptos Ed25519 key. RISEx: signer key. */
  privateKey: string;
  /** Optional API/L2 credentials some venues require alongside the signer. */
  apiKey?: string;
  apiSecret?: string;
  /** Optional funding/account address override. */
  accountAddress?: string;
}

export class NotImplementedError extends Error {
  constructor(exchange: ExchangeId, method: string) {
    super(
      `[${exchange}] ${method} is not implemented yet — live signing lands in Phase 6. ` +
        `Use tradingMode: "paper" until then.`,
    );
    this.name = "NotImplementedError";
  }
}

/**
 * Base for the three live DEX adapters. Every method throws until Phase 6 wires
 * the real signing + REST/WS calls. Keeping them behind the same interface lets
 * the API, registry, and dashboard be built and tested against paper today.
 */
abstract class LiveAdapterStub implements ExchangeAdapter {
  abstract readonly id: ExchangeId;
  protected readonly creds: LiveCredentials;

  constructor(creds: LiveCredentials) {
    this.creds = creds;
  }

  async connect(): Promise<void> {
    throw new NotImplementedError(this.id, "connect");
  }
  async disconnect(): Promise<void> {
    /* no-op: nothing to tear down before Phase 6 */
  }
  async getMarkPrice(): Promise<number> {
    throw new NotImplementedError(this.id, "getMarkPrice");
  }
  async getBalanceUsd(): Promise<number> {
    throw new NotImplementedError(this.id, "getBalanceUsd");
  }
  async placeOrder(_params: PlaceOrderParams): Promise<VenueOrder> {
    throw new NotImplementedError(this.id, "placeOrder");
  }
  async cancelOrder(): Promise<void> {
    throw new NotImplementedError(this.id, "cancelOrder");
  }
  async getOpenOrders(): Promise<VenueOrder[]> {
    throw new NotImplementedError(this.id, "getOpenOrders");
  }
  watchFills(_symbol: string, _cb: (f: VenueFill) => void): Unsubscribe {
    throw new NotImplementedError(this.id, "watchFills");
  }
  watchMarkPrice(_symbol: string, _cb: (m: number) => void): Unsubscribe {
    throw new NotImplementedError(this.id, "watchMarkPrice");
  }
}

/** Decibel (Aptos) — Ed25519 order signing. Filled in Phase 6. */
export class DecibelAdapter extends LiveAdapterStub {
  readonly id: ExchangeId = "decibel";
}

/** RISEx — signer-key order submission. Filled in Phase 6. */
export class RisexAdapter extends LiveAdapterStub {
  readonly id: ExchangeId = "risex";
}
