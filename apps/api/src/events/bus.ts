import { EventEmitter } from "node:events";
import type { StreamEvent } from "@gridbot/shared";

/**
 * In-process pub/sub for dashboard stream events. The bot runners publish;
 * each SSE connection subscribes and unsubscribes on disconnect.
 */
export class EventBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    // Many concurrent SSE clients are expected; lift the default cap.
    this.emitter.setMaxListeners(0);
  }

  publish(event: StreamEvent): void {
    this.emitter.emit("event", event);
  }

  subscribe(listener: (event: StreamEvent) => void): () => void {
    this.emitter.on("event", listener);
    return () => this.emitter.off("event", listener);
  }
}
