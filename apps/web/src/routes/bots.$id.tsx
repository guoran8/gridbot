import { createFileRoute, Link } from "@tanstack/react-router";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/status-badge";
import { AdjustRange } from "@/features/bots/adjust-range";
import { GridChart } from "@/features/bots/grid-chart";
import { FillsTable, OrdersTable } from "@/features/bots/order-tables";
import { useBots, useControlBot, useDeleteBot } from "@/lib/queries";
import { fmtNum, fmtUsd, pnlColor } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/bots/$id")({
  component: BotDetailPage,
});

function BotDetailPage() {
  const { id } = Route.useParams();
  const { t } = useI18n();
  const { data: bots = [] } = useBots();
  const control = useControlBot();
  const del = useDeleteBot();
  const bot = bots.find((b) => b.id === id);

  if (!bot) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <p>{t("table.empty")}</p>
          <Link to="/" className={buttonVariants({ variant: "link" })}>
            {t("nav.overview")}
          </Link>
        </CardContent>
      </Card>
    );
  }

  const running = bot.status === "running";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">{bot.config.symbol}</h1>
          <span className="text-sm text-muted-foreground">
            {bot.config.exchange} · {t(`bot.mode.${bot.config.mode}`)}
          </span>
          <StatusBadge status={bot.status} />
        </div>
        <div className="flex gap-2">
          {running ? (
            <>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => control.mutate({ id, action: "pause" })}
              >
                {t("action.pause")}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => control.mutate({ id, action: "stop" })}
              >
                {t("action.stop")}
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={() =>
                control.mutate({ id, action: bot.status === "paused" ? "resume" : "start" })
              }
            >
              {bot.status === "paused" ? t("action.resume") : t("action.start")}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => control.mutate({ id, action: "flatten" })}
          >
            {t("action.flatten")}
          </Button>
          {bot.position && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (confirm(t("action.confirmRecover"))) control.mutate({ id, action: "recover" });
              }}
            >
              {t("action.recover")}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="text-red-500 hover:text-red-500"
            onClick={() => {
              if (confirm(t("action.confirmDelete"))) del.mutate(id);
            }}
          >
            {t("action.delete")}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-2 pt-4">
          <span className="text-sm font-medium">{t("adjust.title")}</span>
          <AdjustRange bot={bot} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
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

      <GridChart bot={bot} />

      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">{t("tabs.orders")}</TabsTrigger>
          <TabsTrigger value="fills">{t("tabs.fills")}</TabsTrigger>
        </TabsList>
        <TabsContent value="orders">
          <Card>
            <CardContent className="pt-6">
              <OrdersTable botId={id} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="fills">
          <Card>
            <CardContent className="pt-6">
              <FillsTable botId={id} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Metric({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 py-4">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={`text-lg font-medium tabular-nums ${className ?? ""}`}>{value}</span>
      </CardContent>
    </Card>
  );
}
