import type { VenueStatus } from "@/lib/api";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useProbeVenue } from "@/lib/queries";
import { fmtUsd } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

export function VenueCard({ venue }: { venue: VenueStatus }) {
  const { t } = useI18n();
  const probe = useProbeVenue();
  const [symbol, setSymbol] = useState("BTC-USD");
  const result = probe.data;

  const runProbe = () => {
    probe.mutate(
      { id: venue.id, symbol: symbol.trim() || undefined },
      {
        onError: (err) =>
          toast.error(t("venues.probeFailed"), {
            description: err instanceof Error ? err.message : undefined,
          }),
      },
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-base capitalize">{venue.id}</CardTitle>
        <div className="flex gap-1.5">
          <Badge
            variant="outline"
            className={
              venue.configured
                ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
                : "bg-muted text-muted-foreground"
            }
          >
            {venue.configured ? t("venues.configured") : t("venues.notConfigured")}
          </Badge>
          <Badge
            variant="outline"
            className={
              venue.liveTradingEnabled
                ? "bg-amber-500/15 text-amber-500 border-amber-500/30"
                : "bg-muted text-muted-foreground"
            }
          >
            {venue.liveTradingEnabled ? t("venues.liveOn") : t("venues.liveOff")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <span className="text-xs text-muted-foreground">{venue.network}</span>

        {venue.configured ? (
          <>
            <div className="flex gap-2">
              <Input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder={t("venues.symbolPlaceholder")}
                className="h-8"
              />
              <Button size="sm" onClick={runProbe} disabled={probe.isPending}>
                {probe.isPending ? t("venues.probing") : t("venues.probe")}
              </Button>
            </div>
            {result && (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Metric
                  label={t("venues.balance")}
                  value={result.balanceUsd !== null ? `$${fmtUsd(result.balanceUsd)}` : "—"}
                />
                <Metric
                  label={t("venues.mark")}
                  value={result.markPrice !== null ? fmtUsd(result.markPrice) : "—"}
                />
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">{t("venues.notConfiguredHint")}</p>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
