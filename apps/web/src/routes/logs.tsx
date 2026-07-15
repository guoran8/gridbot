import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLogs } from "@/lib/queries";
import { fmtTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/logs")({
  component: LogsPage,
});

const levelColor: Record<string, string> = {
  debug: "text-muted-foreground",
  info: "text-sky-500",
  warn: "text-amber-500",
  error: "text-red-500",
};

function LogsPage() {
  const { t } = useI18n();
  const { data: logs = [] } = useLogs();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("logs.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-1 font-mono text-xs">
          {logs.map((log, i) => (
            <div key={`${log.ts}-${i}`} className="flex gap-3">
              <span className="text-muted-foreground">{fmtTime(log.ts)}</span>
              <span className={`w-12 uppercase ${levelColor[log.level] ?? ""}`}>{log.level}</span>
              <span className="flex-1">{log.message}</span>
            </div>
          ))}
          {logs.length === 0 && <p className="text-muted-foreground">{t("table.empty")}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
