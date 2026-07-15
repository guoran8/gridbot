import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAiChat, useAiReport, useAiSentinel, useAiStatus } from "@/lib/queries";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/ai")({
  component: AiPage,
});

function AiPage() {
  const { t } = useI18n();
  const status = useAiStatus();
  const chat = useAiChat();
  const sentinel = useAiSentinel();
  const report = useAiReport();
  const [message, setMessage] = useState("");
  const [thread, setThread] = useState<Array<{ role: "user" | "ai"; text: string }>>([]);

  const enabled = status.data?.enabled ?? false;

  const send = () => {
    const m = message.trim();
    if (!m) return;
    setThread((prev) => [...prev, { role: "user", text: m }]);
    setMessage("");
    chat.mutate(m, {
      onSuccess: (r) => setThread((prev) => [...prev, { role: "ai", text: r.reply }]),
      onError: (err) => toast.error(err instanceof Error ? err.message : "chat failed"),
    });
  };

  if (!enabled) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          {t("ai.disabled")}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">{t("aiPage.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("aiPage.subtitle")} · {status.data?.provider}
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={sentinel.isPending}
          onClick={() => sentinel.mutate()}
        >
          {sentinel.isPending ? t("aiPage.running") : t("aiPage.sentinel")}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={report.isPending}
          onClick={() => report.mutate()}
        >
          {report.isPending ? t("aiPage.running") : t("aiPage.report")}
        </Button>
      </div>

      {sentinel.data && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <CardTitle className="text-base">{t("aiPage.sentinel")}</CardTitle>
            <Badge
              variant="outline"
              className={
                sentinel.data.ok
                  ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
                  : "bg-red-500/15 text-red-500 border-red-500/30"
              }
            >
              {sentinel.data.ok ? t("aiPage.sentinelOk") : t("aiPage.sentinelAlert")}
            </Badge>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm">{sentinel.data.summary}</CardContent>
        </Card>
      )}

      {report.data && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("aiPage.report")}</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm">{report.data.report}</CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="flex flex-col gap-3 pt-4">
          <div className="flex flex-col gap-2">
            {thread.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "user"
                    ? "text-sm font-medium"
                    : "whitespace-pre-wrap text-sm text-muted-foreground"
                }
              >
                <span className="mr-2 text-xs uppercase text-muted-foreground">{m.role}</span>
                {m.text}
              </div>
            ))}
            {chat.isPending && (
              <span className="text-xs text-muted-foreground">{t("aiPage.running")}</span>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder={t("aiPage.chatPlaceholder")}
            />
            <Button size="sm" onClick={send} disabled={chat.isPending}>
              {t("aiPage.send")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
