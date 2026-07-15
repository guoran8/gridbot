import { createFileRoute, Link } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BotCard } from "@/features/bots/bot-card";
import { useBots } from "@/lib/queries";
import { fmtUsd, pnlColor } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  component: OverviewPage,
});

function OverviewPage() {
  const { t } = useI18n();
  const { data: bots = [], isLoading } = useBots();

  const totalPnl = bots.reduce((s, b) => s + b.pnl.netPnl, 0);
  const totalVol = bots.reduce((s, b) => s + b.pnl.volumeUsd, 0);
  const running = bots.filter((b) => b.status === "running").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Summary
          label={t("overview.totalPnl")}
          value={fmtUsd(totalPnl)}
          className={pnlColor(totalPnl)}
        />
        <Summary label={t("overview.totalVolume")} value={`$${fmtUsd(totalVol, 0)}`} />
        <Summary label={t("overview.activeBots")} value={`${running} / ${bots.length}`} />
      </div>

      {!isLoading && bots.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <p className="text-muted-foreground">{t("overview.empty")}</p>
            <Link to="/create" className={buttonVariants()}>
              {t("nav.create")}
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {bots.map((bot) => (
            <BotCard key={bot.id} bot={bot} />
          ))}
        </div>
      )}
    </div>
  );
}

function Summary({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 py-5">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={`text-2xl font-semibold tabular-nums ${className ?? ""}`}>{value}</span>
      </CardContent>
    </Card>
  );
}
