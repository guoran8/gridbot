import type { Notification, Notifier } from "./types.js";

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  fetchImpl?: typeof fetch;
}

const emoji: Record<Notification["level"], string> = {
  info: "ℹ️",
  warn: "⚠️",
  error: "🛑",
};

/** Delivers notifications to a Telegram chat via the Bot API. */
export class TelegramNotifier implements Notifier {
  readonly name = "telegram";
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: TelegramConfig) {
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async send(n: Notification): Promise<void> {
    const text = `${emoji[n.level]} *${n.title}*\n${n.body}`;
    const res = await this.fetchImpl(
      `https://api.telegram.org/bot${this.config.botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: this.config.chatId, text, parse_mode: "Markdown" }),
      },
    );
    if (!res.ok) {
      throw new Error(`telegram send failed: ${res.status} ${await res.text().catch(() => "")}`);
    }
  }
}
