import type { Notification, Notifier } from "./types.js";

/**
 * Fans a notification out to every registered sink. A failing sink is isolated
 * (logged via `onError`) and never blocks the others or the caller.
 */
export class NotifierRegistry {
  private readonly notifiers: Notifier[] = [];

  constructor(private readonly onError?: (name: string, err: unknown) => void) {}

  add(notifier: Notifier): this {
    this.notifiers.push(notifier);
    return this;
  }

  get size(): number {
    return this.notifiers.length;
  }

  /** Best-effort broadcast; resolves once all sinks have settled. */
  async notify(n: Notification): Promise<void> {
    await Promise.all(
      this.notifiers.map(async (sink) => {
        try {
          await sink.send(n);
        } catch (err) {
          this.onError?.(sink.name, err);
        }
      }),
    );
  }
}
