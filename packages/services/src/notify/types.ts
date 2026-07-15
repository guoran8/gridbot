/** A notification the bot emits on a lifecycle event. */
export interface Notification {
  /** Short title, e.g. "Fill" / "Liquidation" / "Error". */
  title: string;
  body: string;
  level: "info" | "warn" | "error";
  botId?: string;
}

/** A sink that delivers notifications (Telegram, webhook, …). */
export interface Notifier {
  readonly name: string;
  send(n: Notification): Promise<void>;
}
