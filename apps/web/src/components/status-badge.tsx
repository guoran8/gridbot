import type { BotStatus } from "@gridbot/shared";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";

const toneByStatus: Record<BotStatus, string> = {
  running: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  idle: "bg-muted text-muted-foreground",
  paused: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  stopping: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  error: "bg-red-500/15 text-red-500 border-red-500/30",
};

export function StatusBadge({ status }: { status: BotStatus }) {
  const { t } = useI18n();
  return (
    <Badge variant="outline" className={toneByStatus[status]}>
      {t(`bot.status.${status}`)}
    </Badge>
  );
}
