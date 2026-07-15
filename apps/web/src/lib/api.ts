import type {
  BotAction,
  BotSnapshot,
  Fill,
  GridConfig,
  GridMode,
  LogEntry,
  Order,
} from "@gridbot/shared";

export interface GridAdvice {
  mode: GridMode;
  lowerPrice: number;
  upperPrice: number;
  gridCount: number;
  rationale: string;
}

/** API base — same-origin in dev (Vite proxy), overridable for prod builds. */
const BASE = import.meta.env.VITE_API_BASE_URL ?? "";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = body?.error?.message ?? `request failed: ${res.status}`;
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  listBots: () => req<{ bots: BotSnapshot[] }>("/v1/bots").then((r) => r.bots),
  getBot: (id: string) => req<BotSnapshot>(`/v1/bots/${id}`),
  createBot: (config: GridConfig) =>
    req<BotSnapshot>("/v1/bots", { method: "POST", body: JSON.stringify(config) }),
  control: (id: string, action: BotAction) =>
    req<BotSnapshot>(`/v1/bots/${id}/${action}`, { method: "POST" }),
  deleteBot: (id: string) => req<void>(`/v1/bots/${id}`, { method: "DELETE" }),
  listOrders: (id: string) =>
    req<{ orders: Order[] }>(`/v1/bots/${id}/orders`).then((r) => r.orders),
  listFills: (id: string) => req<{ fills: Fill[] }>(`/v1/bots/${id}/fills`).then((r) => r.fills),
  listLogs: () => req<{ logs: LogEntry[] }>("/logs").then((r) => r.logs),
  aiStatus: () => req<{ enabled: boolean; provider: string | null }>("/v1/ai/status"),
  advise: (input: { symbol: string; markPrice: number; closes?: number[] }) =>
    req<GridAdvice>("/v1/ai/advise", { method: "POST", body: JSON.stringify(input) }),
};

export { BASE as API_BASE };
