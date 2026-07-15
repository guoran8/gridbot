import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { useBotStream } from "@/lib/stream";
import { useI18n } from "@/lib/i18n";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const { t, locale, setLocale } = useI18n();
  // Open the single SSE connection for the whole app here.
  useBotStream();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex flex-col">
              <span className="font-semibold">{t("app.title")}</span>
              <span className="text-xs text-muted-foreground">{t("app.subtitle")}</span>
            </Link>
            <nav className="flex items-center gap-1">
              <NavLink to="/">{t("nav.overview")}</NavLink>
              <NavLink to="/create">{t("nav.create")}</NavLink>
              <NavLink to="/logs">{t("nav.logs")}</NavLink>
            </nav>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
          >
            {t("lang.toggle")}
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
      <Toaster position="top-right" richColors />
    </div>
  );
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground [&.active]:bg-accent [&.active]:text-foreground"
      activeOptions={{ exact: to === "/" }}
    >
      {children}
    </Link>
  );
}
