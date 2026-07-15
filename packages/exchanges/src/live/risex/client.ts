/**
 * REST client for RISEx — a fully on-chain orderbook perp DEX on RISE Chain
 * (an Ethereum L2). API at developer.rise.trade; base at api.<net>.rise.trade.
 *
 * Reads (markets, mark price, balance) are documented and low-risk. Order
 * placement needs an EIP-712 "VerifyWitness" permit whose struct + nonce scheme
 * are NOT yet published (the API is "under heavy development") — so the signing
 * lives behind a gate in adapter.ts.
 */

export const RISEX_BASE_URLS = {
  mainnet: "https://api.rise.trade",
  testnet: "https://api.testnet.rise.trade",
} as const;

export type RisexNetwork = keyof typeof RISEX_BASE_URLS;

export interface RisexMarket {
  market_id: number;
  base_asset_symbol: string;
  quote_asset_symbol: string;
  display_name: string;
  mark_price: string;
  index_price: string;
  last_price: string;
  /** Minimum price increment — price is submitted as price/step_price ticks. */
  step_price: string;
  /** Minimum size increment — size is submitted as size/step_size steps. */
  step_size: string;
}

export interface RisexClientOptions {
  network: RisexNetwork;
  fetchImpl?: typeof fetch;
}

export class RisexClient {
  readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: RisexClientOptions) {
    this.baseUrl = RISEX_BASE_URLS[opts.network];
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...init?.headers },
    });
    if (!res.ok) {
      throw new Error(`risex ${path} failed: ${res.status} ${await res.text().catch(() => "")}`);
    }
    return res.json() as Promise<T>;
  }

  async getMarkets(): Promise<RisexMarket[]> {
    const body = await this.request<{ markets: RisexMarket[] }>("/v1/markets");
    return body.markets;
  }

  /** Resolve a display name (e.g. "BTC-PERP") to its market row. */
  async getMarket(symbol: string): Promise<RisexMarket> {
    const markets = await this.getMarkets();
    const market = markets.find((m) => m.display_name === symbol);
    if (!market) throw new Error(`risex market not found: ${symbol}`);
    return market;
  }

  async getMarkPrice(symbol: string): Promise<number> {
    return Number((await this.getMarket(symbol)).mark_price);
  }

  /** Raw token balance (uint256 string, token units) for an account. */
  async getBalance(account: string, token?: string): Promise<string> {
    const q = new URLSearchParams({ account });
    if (token) q.set("token", token);
    const body = await this.request<{ balance: string }>(`/v1/account/balance?${q.toString()}`);
    return body.balance;
  }

  /** POST a fully-built order request (permit signing is the caller's job). */
  placeOrder(payload: Record<string, unknown>): Promise<{
    order_id: string;
    tx_hash: string;
    sc_order_id: string;
  }> {
    return this.request("/v1/orders/place", { method: "POST", body: JSON.stringify(payload) });
  }

  cancelOrder(payload: Record<string, unknown>): Promise<{ tx_hash: string; success: boolean }> {
    return this.request("/v1/orders/cancel", { method: "POST", body: JSON.stringify(payload) });
  }
}

/** price → integer ticks (round to nearest step_price). */
export function priceToTicks(price: number, stepPrice: number): number {
  return Math.round(price / stepPrice);
}

/** size → integer steps (round down to step_size to avoid over-ordering). */
export function sizeToSteps(size: number, stepSize: number): number {
  return Math.floor(size / stepSize);
}
