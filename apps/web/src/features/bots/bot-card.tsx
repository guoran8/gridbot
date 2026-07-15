import type { BotSnapshot } from "@gridbot/shared";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { useControlBot, useDeleteBot } from "@/lib/queries";
import { fmtNum, fmtUsd, pnlColor } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

export function BotCard({ bot }: { bot: BotSnapshot }) {
  const { t } = useI18n();
  const control = useControlBot();
  const del = useDeleteBot();
  const running = bot.status === "running";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <div className="flex flex-col gap-1">
          <Link to="/bots/$id" params={{ id: bot.id }} className="font-semibold hover:underline">
            {bot.config.symbol}
          </Link>
          <span className="text-xs text-muted-foreground">
            {bot.config.exchange} · {t(`bot.mode.${bot.config.mode}`)} · {bot.config.gridCount}{" "}
            grids
          </span>
        </div>
        <StatusBadge status={bot.status} />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2 text-sm">
          <Metric label={t("bot.mark")} value={fmtUsd(bot.markPrice)} />
          <Metric
            label={t("bot.netPnl")}
            value={fmtUsd(bot.pnl.netPnl)}
            className={pnlColor(bot.pnl.netPnl)}
          />
          <Metric label={t("bot.volume")} value={`$${fmtUsd(bot.pnl.volumeUsd, 0)}`} />
          <Metric label={t("bot.matched")} value={String(bot.pnl.matchedTrades)} />
          <Metric label={t("bot.fees")} value={fmtUsd(bot.pnl.feesPaid)} />
          <Metric
            label={t("bot.position")}
            value={bot.position ? fmtNum(bot.position.netQty) : t("bot.flat")}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {running ? (
            <>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => control.mutate({ id: bot.id, action: "pause" })}
              >
                {t("action.pause")}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => control.mutate({ id: bot.id, action: "stop" })}
              >
                {t("action.stop")}
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={() =>
                control.mutate({ id: bot.id, action: bot.status === "paused" ? "resume" : "start" })
              }
            >
              {bot.status === "paused" ? t("action.resume") : t("action.start")}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => control.mutate({ id: bot.id, action: "flatten" })}
          >
            {t("action.flatten")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-red-500 hover:text-red-500"
            onClick={() => {
              if (confirm(t("action.confirmDelete"))) del.mutate(bot.id);
            }}
          >
            {t("action.delete")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`font-medium tabular-nums ${className ?? ""}`}>{value}</span>
    </div>
  );
}
