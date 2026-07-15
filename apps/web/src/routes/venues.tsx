import { createFileRoute } from "@tanstack/react-router";
import { VenueCard } from "@/features/venues/venue-card";
import { useVenues } from "@/lib/queries";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/venues")({
  component: VenuesPage,
});

function VenuesPage() {
  const { t } = useI18n();
  const { data: venues = [] } = useVenues();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">{t("venues.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("venues.subtitle")}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {venues.map((v) => (
          <VenueCard key={v.id} venue={v} />
        ))}
      </div>
    </div>
  );
}
