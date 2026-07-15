import type { BotSnapshot } from "@gridbot/shared";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdjustRange } from "@/lib/queries";
import { useI18n } from "@/lib/i18n";

/** Inline live range-adjustment form (re-bands the grid without stopping). */
export function AdjustRange({ bot }: { bot: BotSnapshot }) {
  const { t } = useI18n();
  const adjust = useAdjustRange();
  const [lower, setLower] = useState(bot.config.lowerPrice);
  const [upper, setUpper] = useState(bot.config.upperPrice);
  const [count, setCount] = useState(bot.config.gridCount);

  const apply = () => {
    if (!(upper > lower) || !(count >= 2)) {
      toast.error(t("adjust.failed"));
      return;
    }
    adjust.mutate(
      { id: bot.id, band: { lowerPrice: lower, upperPrice: upper, gridCount: count } },
      {
        onSuccess: () => toast.success(t("adjust.applied")),
        onError: (err) =>
          toast.error(t("adjust.failed"), {
            description: err instanceof Error ? err.message : undefined,
          }),
      },
    );
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Field label={t("create.lower")}>
        <NumberInput value={lower} onChange={setLower} />
      </Field>
      <Field label={t("create.upper")}>
        <NumberInput value={upper} onChange={setUpper} />
      </Field>
      <Field label={t("create.gridCount")}>
        <NumberInput value={count} onChange={setCount} step={1} />
      </Field>
      <Button size="sm" onClick={apply} disabled={adjust.isPending}>
        {t("adjust.apply")}
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex w-28 flex-col gap-1">
      <Label className="text-xs">{label}</Label>
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
      className="h-8"
      value={Number.isNaN(value) ? "" : value}
      onChange={(e) => onChange(e.target.valueAsNumber)}
    />
  );
}
