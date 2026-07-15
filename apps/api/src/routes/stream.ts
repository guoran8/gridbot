import type { StreamEvent } from "@gridbot/shared";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { AppContainer } from "../app.js";

/** GET /v1/stream — SSE feed of the live system state for the dashboard. */
export function streamRoutes(c: AppContainer): Hono {
  const app = new Hono();

  app.get("/", (ctx) =>
    streamSSE(ctx, async (stream) => {
      // Prime the client with the current snapshot of every bot.
      for (const bot of c.manager.snapshots()) {
        await stream.writeSSE({
          event: "message",
          data: JSON.stringify({ type: "snapshot", bot } satisfies StreamEvent),
        });
      }

      const queue: StreamEvent[] = [];
      const state = { closed: false };
      let notify: (() => void) | null = null;
      const wake = () => {
        notify?.();
        notify = null;
      };

      const unsubscribe = c.bus.subscribe((event) => {
        queue.push(event);
        wake();
      });
      stream.onAbort(() => {
        state.closed = true;
        unsubscribe();
        wake();
      });

      try {
        while (!state.closed) {
          const event = queue.shift();
          if (event === undefined) {
            await new Promise<void>((resolve) => {
              notify = resolve;
            });
            continue;
          }
          await stream.writeSSE({ event: "message", data: JSON.stringify(event) });
        }
      } finally {
        unsubscribe();
      }
    }),
  );

  return app;
}
