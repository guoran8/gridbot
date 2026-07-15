import type { BotSnapshot, StreamEvent } from "@gridbot/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { API_BASE } from "./api.js";
import { botsKey } from "./queries.js";

/**
 * Subscribe to the server SSE feed and fold incremental events into the
 * React Query cache, so every view updates live without polling.
 */
export function useBotStream(): void {
  const qc = useQueryClient();

  useEffect(() => {
    const es = new EventSource(`${API_BASE}/v1/stream`);

    es.onmessage = (msg) => {
      let event: StreamEvent;
      try {
        event = JSON.parse(msg.data) as StreamEvent;
      } catch {
        return;
      }
      qc.setQueryData<BotSnapshot[]>(botsKey, (prev) => applyEvent(prev ?? [], event));
    };

    es.onerror = () => {
      // EventSource auto-reconnects; nothing to do but let it retry.
    };

    return () => es.close();
  }, [qc]);
}

function applyEvent(bots: BotSnapshot[], event: StreamEvent): BotSnapshot[] {
  const patch = (id: string, fn: (b: BotSnapshot) => BotSnapshot): BotSnapshot[] =>
    bots.map((b) => (b.id === id ? fn(b) : b));

  switch (event.type) {
    case "snapshot": {
      const exists = bots.some((b) => b.id === event.bot.id);
      return exists ? patch(event.bot.id, () => event.bot) : [...bots, event.bot];
    }
    case "status":
      return patch(event.botId, (b) => ({ ...b, status: event.status }));
    case "markPrice":
      return patch(event.botId, (b) => ({ ...b, markPrice: event.markPrice }));
    case "pnl":
      return patch(event.botId, (b) => ({ ...b, pnl: event.pnl }));
    case "position":
      return patch(event.botId, (b) => ({ ...b, position: event.position }));
    default:
      return bots;
  }
}
