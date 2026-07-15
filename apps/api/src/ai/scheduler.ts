import type { AiAdvisor, NotifierRegistry } from "@gridbot/services";
import type { BotSnapshot } from "@gridbot/shared";
import type { Logger } from "../logger.js";

interface SchedulerDeps {
  advisor: AiAdvisor;
  notifiers: NotifierRegistry;
  logger: Logger;
  snapshots: () => BotSnapshot[];
  sentinelMinutes: number;
  reportHour: number;
}

function toBrief(b: BotSnapshot) {
  return {
    id: b.id,
    exchange: b.config.exchange,
    symbol: b.config.symbol,
    mode: b.config.mode,
    status: b.status,
    markPrice: b.markPrice,
    lowerPrice: b.config.lowerPrice,
    upperPrice: b.config.upperPrice,
    netPnl: b.pnl.netPnl,
    volumeUsd: b.pnl.volumeUsd,
    position: b.position?.netQty ?? 0,
    outOfRange:
      b.markPrice > 0 && (b.markPrice < b.config.lowerPrice || b.markPrice > b.config.upperPrice),
  };
}

/**
 * Runs the scheduled AI capabilities: a periodic risk sentinel (pushes a
 * notification when it flags something) and a once-daily report at a target
 * local hour. Both are best-effort and never throw into the caller.
 */
export class AiScheduler {
  private timers: Array<ReturnType<typeof setInterval>> = [];
  private lastReportDay = -1;

  constructor(private readonly deps: SchedulerDeps) {}

  start(): void {
    const { sentinelMinutes, reportHour, logger } = this.deps;

    if (sentinelMinutes > 0) {
      const t = setInterval(() => void this.runSentinel(), sentinelMinutes * 60_000);
      t.unref?.();
      this.timers.push(t);
      logger.info({ sentinelMinutes }, "ai sentinel scheduled");
    }
    if (reportHour >= 0) {
      // Check every 5 min whether we've crossed into the report hour today.
      const t = setInterval(() => void this.maybeRunReport(), 5 * 60_000);
      t.unref?.();
      this.timers.push(t);
      logger.info({ reportHour }, "ai daily report scheduled");
    }
  }

  stop(): void {
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
  }

  private async runSentinel(): Promise<void> {
    const bots = this.deps.snapshots();
    if (bots.length === 0) return;
    try {
      const result = await this.deps.advisor.sentinel(bots.map(toBrief));
      if (!result.ok) {
        await this.deps.notifiers.notify({
          title: "AI risk sentinel",
          body: `${result.alerts.join("; ")}\n\n${result.summary}`,
          level: "warn",
        });
      }
    } catch (err) {
      this.deps.logger.warn({ err }, "ai sentinel run failed");
    }
  }

  private async maybeRunReport(): Promise<void> {
    const now = new Date();
    const day = now.getDate();
    if (now.getHours() !== this.deps.reportHour || day === this.lastReportDay) return;
    this.lastReportDay = day;
    try {
      const report = await this.deps.advisor.dailyReport(this.deps.snapshots().map(toBrief));
      await this.deps.notifiers.notify({ title: "AI daily report", body: report, level: "info" });
    } catch (err) {
      this.deps.logger.warn({ err }, "ai daily report failed");
    }
  }
}
