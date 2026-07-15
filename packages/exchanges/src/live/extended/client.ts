/**
 * Thin REST client for the Extended (x10 / Starknet) perp DEX.
 *
 * Endpoint paths, headers, and response shapes are sourced from the official
 * API reference (api.docs.extended.exchange) and the official example repo
 * (github.com/x10xchange/examples). Read paths are low-risk; the order-signing
 * path lives in ./sign.ts and is gated — see adapter.ts.
 */

export const EXTENDED_BASE_URLS = {
  mainnet: "https://api.starknet.extended.exchange",
  testnet: "https://api.starknet.sepolia.extended.exchange",
} as const;

export type ExtendedNetwork = keyof typeof EXTENDED_BASE_URLS;

/** StarkEx per-market config needed to scale signed amounts. */
export interface ExtendedL2Config {
  collateralId: string;
  collateralResolution: number;
  syntheticId: string;
  syntheticResolution: number;
}

export interface ExtendedMarket {
  name: string;
  marketStats: {
    lastPrice: string;
    markPrice: string;
    indexPrice: string;
    bidPrice: string;
    askPrice: string;
  };
  l2Config: ExtendedL2Config;
}

/** SNIP-12 domain params for order signing (from GET /api/v1/info/starknet). */
export interface ExtendedStarknetInfo {
  name: string;
  version: string;
  chainId: string;
  revision?: string;
}

export interface ExtendedClientOptions {
  network: ExtendedNetwork;
  apiKey: string;
  fetchImpl?: typeof fetch;
  /** Sent as User-Agent (mandatory on all Extended requests). */
  userAgent?: string;
}

export class ExtendedClient {
  readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly userAgent: string;

  constructor(opts: ExtendedClientOptions) {
    this.baseUrl = EXTENDED_BASE_URLS[opts.network];
    this.apiKey = opts.apiKey;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.userAgent = opts.userAgent ?? "gridbot/0.0.0";
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        "user-agent": this.userAgent,
        "x-api-key": this.apiKey,
        ...init?.headers,
      },
    });
    if (!res.ok) {
      throw new Error(`extended ${path} failed: ${res.status} ${await res.text().catch(() => "")}`);
    }
    const body = (await res.json()) as { data?: T };
    // Extended wraps successful payloads in a `data` envelope.
    return (body.data ?? (body as unknown)) as T;
  }

  /** SNIP-12 signing domain — required before any order can be signed. */
  getStarknetInfo(): Promise<ExtendedStarknetInfo> {
    return this.request<ExtendedStarknetInfo>("/api/v1/info/starknet");
  }

  async getMarket(symbol: string): Promise<ExtendedMarket> {
    const markets = await this.request<ExtendedMarket[]>(
      `/api/v1/info/markets?market=${encodeURIComponent(symbol)}`,
    );
    const market = markets.find((m) => m.name === symbol) ?? markets[0];
    if (!market) throw new Error(`extended market not found: ${symbol}`);
    return market;
  }

  async getMarkPrice(symbol: string): Promise<number> {
    const market = await this.getMarket(symbol);
    return Number(market.marketStats.markPrice);
  }

  async getBalanceUsd(): Promise<number> {
    const balance = await this.request<{ availableForTrade: string }>("/api/v1/user/balance");
    return Number(balance.availableForTrade);
  }

  async getOpenOrders(symbol: string): Promise<
    Array<{
      id: number;
      externalId: string;
      market: string;
      side: string;
      price: string;
      qty: string;
      status: string;
    }>
  > {
    return this.request(`/api/v1/user/orders?market=${encodeURIComponent(symbol)}`);
  }

  /** Submit a fully-built + signed order payload (see sign.ts). */
  placeOrder(payload: Record<string, unknown>): Promise<{ id: number; externalId: string }> {
    return this.request("/api/v1/user/order", { method: "POST", body: JSON.stringify(payload) });
  }

  /** Cancel by Extended-assigned order id. Authenticated by API key (no Stark sig). */
  async cancelOrder(exchangeOrderId: string): Promise<void> {
    await this.request(`/api/v1/user/orders/${exchangeOrderId}`, { method: "DELETE" });
  }
}
