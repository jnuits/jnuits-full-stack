import Image from "next/image";
import Link from "next/link";
import { CalendarClock, Image as ImageIcon, MapPin } from "lucide-react";
import { EventArchiveFilters } from "@/components/events/event-archive-filters";
import { EmptyState } from "@/components/ui/empty-state";
import {
  formatEventDateRange,
  getPublicEventsPage,
  toEventCategoryLabel,
  type EventArchiveView,
} from "@/lib/content/events";

export const metadata = {
  title: "Events | JnUITS",
  description:
    "Browse upcoming and past Jagannath University IT Society programs, workshops, competitions, and community events.",
};

function asString(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function asPositiveInteger(value: string | string[] | undefined) {
  if (typeof value !== "string") {
    return 1;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function buildEventsHref({
  category,
  page,
  query,
  view,
}: {
  category: string;
  page: number;
  query: string;
  view: EventArchiveView;
}) {
  const params = new URLSearchParams();

  if (view !== "upcoming") {
    params.set("view", view);
  }

  if (query) {
    params.set("q", query);
  }

  if (category) {
    params.set("category", category);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const queryString = params.toString();

  return queryString ? `/events?${queryString}` : "/events";
}

function buildPageNumbers(currentPage: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  return Array.from(
    new Set([1, currentPage - 1, currentPage, currentPage + 1, totalPages])
  )
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((left, right) => left - right);
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const view = asString(params.view) === "past" ? "past" : "upcoming";
  const query = asString(params.q).trim();
  const category = asString(params.category).trim();
  const requestedPage = asPositiveInteger(params.page);
  const archive = await getPublicEventsPage({
    category,
    page: requestedPage,
    query,
    view,
  });
  const featuredEvent = archive.featuredEvent;
  const pageNumbers = buildPageNumbers(archive.page, archive.totalPages);

  return (
    <div className="event-archive-page shell py-12">
      <section className="glass-card overflow-hidden px-6 py-6 sm:px-8 sm:py-8">
        <div className="event-hero-grid">
          <div className="grid gap-5">
            <span className="eyebrow event-archive-hero__eyebrow">JnUITS Events</span>
            <h1 className="event-archive-hero__title">
              Browse upcoming programs, competitions, and public society events.
            </h1>
            <p className="section-copy max-w-[58ch]">
              Explore workshops, competitions, tours, and community programs
              from Jagannath University IT Society with structured schedules,
              clear status badges, and a growing archive of public activity.
            </p>
          </div>

          {featuredEvent ? (
            <article className="event-feature-card">
              <div className="event-feature-card__media">
                {featuredEvent.cover ? (
                  <Image
                    alt={featuredEvent.cover.alt}
                    className="object-cover"
                    fill
                    priority
                    sizes="(min-width: 1024px) 34rem, 100vw"
                    src={featuredEvent.cover.thumbnailUrl}
                  />
                ) : (
                  <div className="event-card__placeholder">
                    <ImageIcon aria-hidden="true" size={20} />
                    <span>No event cover</span>
                  </div>
                )}
              </div>
              <div className="event-feature-card__body">
                <div className="flex flex-wrap gap-2">
                  <span className="detail-chip">{featuredEvent.lifecycleLabel}</span>
                  <span className="detail-chip">
                    {toEventCategoryLabel(featuredEvent.category)}
                  </span>
                  {featuredEvent.registrationBadgeLabel ? (
                    <span className="detail-chip">
                      {featuredEvent.registrationBadgeLabel}
                    </span>
                  ) : null}
                </div>
                <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,3rem)] leading-[0.95] tracking-[-0.04em]">
                  {featuredEvent.title}
                </h2>
                <p className="mt-4 line-clamp-4 text-sm leading-7 text-[var(--muted-foreground)]">
                  {featuredEvent.summary}
                </p>
                <div className="mt-5 grid gap-2 text-sm text-[var(--muted-foreground)]">
                  <span className="inline-flex items-center gap-2">
                    <CalendarClock aria-hidden="true" size={15} />
                    {formatEventDateRange(
                      featuredEvent.startsAt,
                      featuredEvent.endsAt,
                      featuredEvent.timezone
                    )}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <MapPin aria-hidden="true" size={15} />
                    {featuredEvent.locationLabel}
                  </span>
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    className="primary-button"
                    href={`/events/${featuredEvent.slug}`}
                  >
                    Open featured event
                  </Link>
                  {featuredEvent.ctaUrl ? (
                    <Link className="secondary-button" href={featuredEvent.ctaUrl}>
                      {featuredEvent.ctaLabel || "Open related link"}
                    </Link>
                  ) : null}
                </div>
              </div>
            </article>
          ) : (
            <article className="event-feature-card">
              <div className="event-card__placeholder">
                <ImageIcon aria-hidden="true" size={20} />
                <span>No featured event yet</span>
              </div>
            </article>
          )}
        </div>
      </section>

      <EventArchiveFilters
        categories={archive.categories}
        category={category}
        query={query}
        view={archive.view}
      />

      <section className="mt-8 grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="grid gap-3">
            <p className="section-divider">Event archive</p>
            <h2 className="mt-3 font-[family-name:var(--font-heading)] text-[clamp(2rem,4vw,3.4rem)] leading-[0.94] tracking-[-0.05em]">
              {archive.view === "upcoming" ? "Upcoming schedule" : "Past events archive"}
            </h2>
          </div>
          <span className="status-pill self-end">
            {archive.totalItems} event{archive.totalItems === 1 ? "" : "s"}
          </span>
        </div>

        {archive.items.length ? (
          <div className="event-archive-grid">
            {archive.items.map((event) => (
              <article className="event-archive-card" key={event.id}>
                <Link
                  className="event-archive-card__media"
                  href={`/events/${event.slug}`}
                >
                  {event.cover ? (
                    <Image
                      alt={event.cover.alt}
                      className="object-cover"
                      fill
                      sizes="(min-width: 1280px) 24rem, (min-width: 768px) 50vw, 100vw"
                      src={event.cover.thumbnailUrl}
                    />
                  ) : (
                    <div className="event-card__placeholder">
                      <ImageIcon aria-hidden="true" size={20} />
                      <span>No cover</span>
                    </div>
                  )}
                </Link>
                <div className="event-archive-card__body">
                  <div className="flex flex-wrap gap-2">
                    <span className="detail-chip">{event.lifecycleLabel}</span>
                    <span className="detail-chip">
                      {toEventCategoryLabel(event.category)}
                    </span>
                    {event.registrationBadgeLabel ? (
                      <span className="detail-chip">
                        {event.registrationBadgeLabel}
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-4 font-[family-name:var(--font-heading)] text-[1.5rem] leading-[1.02] tracking-[-0.04em]">
                    <Link href={`/events/${event.slug}`}>{event.title}</Link>
                  </h3>
                  <p className="mt-3 line-clamp-3 text-sm leading-7 text-[var(--muted-foreground)]">
                    {event.summary}
                  </p>
                  <div className="mt-5 grid gap-2 text-sm text-[var(--muted-foreground)]">
                    <span className="inline-flex items-center gap-2">
                      <CalendarClock aria-hidden="true" size={15} />
                      {formatEventDateRange(
                        event.startsAt,
                        event.endsAt,
                        event.timezone
                      )}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <MapPin aria-hidden="true" size={15} />
                      {event.locationLabel}
                    </span>
                  </div>
                  <div className="mt-6">
                    <Link className="queue-link" href={`/events/${event.slug}`}>
                      Open event details
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            description="Adjust the filters or switch between upcoming and past events."
            title="No events matched this archive view"
          />
        )}
      </section>

      {archive.totalPages > 1 ? (
        <nav aria-label="Events archive pagination" className="mt-8 flex flex-wrap justify-center gap-2">
          <Link
            aria-disabled={archive.page <= 1}
            className={`secondary-button ${archive.page <= 1 ? "pointer-events-none opacity-50" : ""}`}
            href={buildEventsHref({
              category,
              page: Math.max(1, archive.page - 1),
              query,
              view: archive.view,
            })}
          >
            Previous
          </Link>
          {pageNumbers.map((pageNumber) => (
            <Link
              aria-current={pageNumber === archive.page ? "page" : undefined}
              className={pageNumber === archive.page ? "primary-button" : "secondary-button"}
              href={buildEventsHref({
                category,
                page: pageNumber,
                query,
                view: archive.view,
              })}
              key={pageNumber}
            >
              {pageNumber}
            </Link>
          ))}
          <Link
            aria-disabled={archive.page >= archive.totalPages}
            className={`secondary-button ${archive.page >= archive.totalPages ? "pointer-events-none opacity-50" : ""}`}
            href={buildEventsHref({
              category,
              page: Math.min(archive.totalPages, archive.page + 1),
              query,
              view: archive.view,
            })}
          >
            Next
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
