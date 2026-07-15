import { type GridConfig, GridConfigSchema } from "@gridbot/shared";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles } from "lucide-react";
import { useAdvise, useAiStatus, useCreateBot } from "@/lib/queries";
import { useI18n } from "@/lib/i18n";

const EXCHANGES = ["paper", "extended", "decibel", "risex"] as const;
const MODES = ["neutral", "long", "short"] as const;
const SPACINGS = ["arithmetic", "geometric"] as const;

export function CreateBotForm() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const createBot = useCreateBot();
  const aiStatus = useAiStatus();
  const advise = useAdvise();

  const form = useForm({
    defaultValues: {
      exchange: "paper",
      symbol: "BTC-USD",
      mode: "neutral",
      tradingMode: "paper",
      lowerPrice: 90,
      upperPrice: 110,
      gridCount: 20,
      spacing: "arithmetic",
      perGridSizeUsd: 100,
      leverage: 1,
      recenterOnBreakout: false,
    },
    onSubmit: async ({ value }) => {
      const parsed = GridConfigSchema.safeParse(value);
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? "invalid config");
        return;
      }
      try {
        const bot = await createBot.mutateAsync(parsed.data as GridConfig);
        toast.success(t("create.success"));
        navigate({ to: "/bots/$id", params: { id: bot.id } });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "failed");
      }
    },
  });

  const runAdvise = async () => {
    const v = form.state.values;
    const lower = Number(v.lowerPrice);
    const upper = Number(v.upperPrice);
    if (!(lower > 0) || !(upper > lower)) {
      toast.info(t("ai.needPrice"));
      return;
    }
    const markPrice = (lower + upper) / 2;
    try {
      const advice = await advise.mutateAsync({ symbol: v.symbol, markPrice });
      form.setFieldValue("mode", advice.mode);
      form.setFieldValue("lowerPrice", advice.lowerPrice);
      form.setFieldValue("upperPrice", advice.upperPrice);
      form.setFieldValue("gridCount", advice.gridCount);
      toast.success(t("ai.applied"), { description: advice.rationale });
    } catch (err) {
      toast.error(t("ai.failed"), {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const aiEnabled = aiStatus.data?.enabled ?? false;

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{t("create.title")}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{t("create.paperOnly")}</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!aiEnabled || advise.isPending}
            title={aiEnabled ? undefined : t("ai.disabled")}
            onClick={() => void runAdvise()}
          >
            <Sparkles className="size-3.5" />
            {advise.isPending ? t("ai.thinking") : t("ai.suggest")}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form
          className="grid grid-cols-2 gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.Field name="exchange">
            {(field) => (
              <Field label={t("create.exchange")}>
                <Select
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v ?? field.state.value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXCHANGES.map((e) => (
                      <SelectItem key={e} value={e}>
                        {e}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </form.Field>

          <form.Field name="symbol">
            {(field) => (
              <Field label={t("create.symbol")}>
                <Input
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </Field>
            )}
          </form.Field>

          <form.Field name="mode">
            {(field) => (
              <Field label={t("create.mode")}>
                <Select
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v ?? field.state.value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODES.map((m) => (
                      <SelectItem key={m} value={m}>
                        {t(`bot.mode.${m}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </form.Field>

          <form.Field name="spacing">
            {(field) => (
              <Field label={t("create.spacing")}>
                <Select
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v ?? field.state.value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SPACINGS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {t(`create.spacing.${s}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </form.Field>

          <form.Field name="lowerPrice">
            {(field) => (
              <Field label={t("create.lower")}>
                <NumberInput value={field.state.value} onChange={field.handleChange} />
              </Field>
            )}
          </form.Field>

          <form.Field name="upperPrice">
            {(field) => (
              <Field label={t("create.upper")}>
                <NumberInput value={field.state.value} onChange={field.handleChange} />
              </Field>
            )}
          </form.Field>

          <form.Field name="gridCount">
            {(field) => (
              <Field label={t("create.gridCount")}>
                <NumberInput value={field.state.value} onChange={field.handleChange} step={1} />
              </Field>
            )}
          </form.Field>

          <form.Field name="perGridSizeUsd">
            {(field) => (
              <Field label={t("create.perGrid")}>
                <NumberInput value={field.state.value} onChange={field.handleChange} />
              </Field>
            )}
          </form.Field>

          <form.Field name="leverage">
            {(field) => (
              <Field label={t("create.leverage")}>
                <NumberInput value={field.state.value} onChange={field.handleChange} step={1} />
              </Field>
            )}
          </form.Field>

          <div className="col-span-2 mt-2">
            <Button type="submit" disabled={createBot.isPending} className="w-full">
              {createBot.isPending ? t("create.creating") : t("create.submit")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  step = "any",
}: {
  value: number;
  onChange: (n: number) => void;
  step?: number | "any";
}) {
  return (
    <Input
      type="number"
      step={step}
      value={Number.isNaN(value) ? "" : value}
      onChange={(e) => onChange(e.target.valueAsNumber)}
    />
  );
}
