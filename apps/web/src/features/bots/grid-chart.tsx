import type { BotSnapshot } from "@gridbot/shared";
import { CartesianGrid, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer } from "@/components/ui/chart";
import { useI18n } from "@/lib/i18n";
import { useMarkHistory } from "./use-mark-history";

const chartConfig = {
  mark: { label: "Mark", color: "var(--chart-2)" },
} satisfies ChartConfig;

/**
 * Grid band visualisation: the mark-price line over time, with a horizontal
 * ReferenceLine per grid level (buys green, sells red), bracketed by the band.
 */
export function GridChart({ bot }: { bot: BotSnapshot }) {
  const { t } = useI18n();
  const history = useMarkHistory(bot.id, bot.markPrice);

  const prices = bot.levels.map((l) => l.price);
  const min = Math.min(bot.config.lowerPrice, ...prices);
  const max = Math.max(bot.config.upperPrice, ...prices);
  const pad = (max - min) * 0.05;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("chart.gridBand")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[360px] w-full">
          <ComposedChart data={history} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
            <CartesianGrid vertical={false} strokeOpacity={0.15} />
            <XAxis dataKey="i" tick={false} axisLine={false} />
            <YAxis
              domain={[min - pad, max + pad]}
              tickFormatter={(v: number) => v.toFixed(0)}
              width={48}
              tick={{ fontSize: 11 }}
            />
            {bot.levels.map((level) => (
              <ReferenceLine
                key={level.index}
                y={level.price}
                stroke={level.side === "buy" ? "var(--chart-1)" : "var(--destructive)"}
                strokeOpacity={0.35}
                strokeDasharray="3 3"
              />
            ))}
            <Line
              type="monotone"
              dataKey="mark"
              stroke="var(--color-mark)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
