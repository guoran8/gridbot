import type { Notification, Notifier } from "./types.js";

export interface WebhookConfig {
  url: string;
  fetchImpl?: typeof fetch;
}

/** Posts the raw notification JSON to a user-supplied webhook URL. */
export class WebhookNotifier implements Notifier {
  readonly name = "webhook";
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: WebhookConfig) {
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async send(n: Notification): Promise<void> {
    const res = await this.fetchImpl(this.config.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...n, ts: null }),
    });
    if (!res.ok) throw new Error(`webhook send failed: ${res.status}`);
  }
}
