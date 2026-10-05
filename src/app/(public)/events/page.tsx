import Link from "next/link";
import { Bell, CalendarClock, CalendarX, MapPin } from "lucide-react";
import { EventBadge } from "@/components/events/event-badge";
import { EventCardImage } from "@/components/events/event-card-image";
import { EventArchiveFilters } from "@/components/events/event-archive-filters";
import { EmptyState } from "@/components/ui/empty-state";
import {
  EVENTS_PER_PAGE,
  getPublicEventsPage,
  toEventCategoryLabel,
  type EventListItem,
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

function getTimeParts(value: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    timeZone,
  }).formatToParts(new Date(value));

  return {
    hour: Number(parts.find((part) => part.type === "hour")?.value || 0),
    minute: Number(parts.find((part) => part.type === "minute")?.value || 0),
  };
}

// UX-FIX: Verbose date format
function formatEventCardDate(event: EventListItem) {
  const timeZone = event.timezone || "Asia/Dhaka";
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone,
    year: "numeric",
  }).format(new Date(event.startsAt));

  if (!event.endsAt) {
    return { dateLabel, timeLabel: null }; // UX-R4: date-only event range
  }

  const start = getTimeParts(event.startsAt, timeZone);
  const end = getTimeParts(event.endsAt, timeZone);
  const isAllDay =
    start.hour === 0 &&
    start.minute === 0 &&
    end.hour === 23 &&
    end.minute >= 58;

  if (isAllDay) {
    return { dateLabel, timeLabel: null }; // UX-R4: date-only event range
  }

  return {
    dateLabel,
    timeLabel: new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone,
    }).formatRange(new Date(event.startsAt), new Date(event.endsAt)),
  };
}

// UX-FIX: Location to be announced noise
function hasSpecificLocation(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();

  return Boolean(normalized) && !normalized.includes("to be announced");
}

// UX-FIX: Month-grouped past events
function getEventMonthLabel(event: EventListItem) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: event.timezone || "Asia/Dhaka",
    year: "numeric",
  }).format(new Date(event.startsAt));
}

function groupEventsByMonth(events: EventListItem[]) {
  const groups = new Map<string, EventListItem[]>();

  for (const event of events) {
    const label = getEventMonthLabel(event);
    groups.set(label, [...(groups.get(label) || []), event]);
  }

  return Array.from(groups.entries()).map(([label, items]) => ({
    items,
    label,
  }));
}

// UX-FIX: Pagination context
function getPaginationContext(page: number, totalItems: number, itemCount: number) {
  if (totalItems === 0) {
    // UX-FIX-R3: hide zero pagination label
    return "";
  }

  const start = (page - 1) * EVENTS_PER_PAGE + 1;
  const end = Math.min(start + itemCount - 1, totalItems);

  return `Showing ${start}-${end} of ${totalItems} events`;
}

function EventDateMeta({ event }: { event: EventListItem }) {
  const date = formatEventCardDate(event);

  return (
    <span className="event-card-meta__row">
      <CalendarClock aria-hidden="true" size={15} />
      <span>
        {date.dateLabel}
        {date.timeLabel ? ` · ${date.timeLabel}` : ""}
      </span>
    </span>
  );
}

function EventCard({ event }: { event: EventListItem }) {
  return (
    <article className="event-archive-card">
      <Link
        className="event-archive-card__media card-image"
        href={`/events/${event.slug}`}
      >
        <EventCardImage
          alt={event.cover?.alt || event.title}
          category={event.category}
          sizes="(min-width: 1280px) 24rem, (min-width: 768px) 50vw, 100vw"
          src={event.cover?.thumbnailUrl}
        />
      </Link>
      <div className="event-archive-card__body">
        {/* UX-FIX: Badge/tag inconsistency */}
        <div className="event-badge-row">
          <EventBadge tone="status">{event.lifecycleLabel}</EventBadge>
          <EventBadge tone="category">
            {toEventCategoryLabel(event.category)}
          </EventBadge>
          {event.registrationBadgeLabel ? (
            <EventBadge tone="registration">
              {event.registrationBadgeLabel}
            </EventBadge>
          ) : null}
        </div>
        <h3>
          <Link href={`/events/${event.slug}`}>{event.title}</Link>
        </h3>
        <p className="event-archive-card__summary">
          {event.summary}
        </p>
        <div className="event-card-meta">
          <EventDateMeta event={event} />
          {hasSpecificLocation(event.locationLabel) ? (
            <span className="event-card-meta__row">
              <MapPin aria-hidden="true" size={15} />
              {event.locationLabel}
            </span>
          ) : null}
        </div>
        <div className="event-archive-card__footer">
          {/* UX-FIX: CTA button inconsistency */}
          <Link className="secondary-button event-card-action" href={`/events/${event.slug}`}>
            Open event details
          </Link>
        </div>
      </div>
    </article>
  );
}

function FeaturedEventCard({ event }: { event: EventListItem }) {
  return (
    <article className="event-feature-card event-feature-card--event">
      <div className="event-feature-card__media card-image">
        <EventCardImage
          alt={event.cover?.alt || event.title}
          category={event.category}
          priority
          sizes="(min-width: 1024px) 34rem, 100vw"
          src={event.cover?.thumbnailUrl}
        />
      </div>
      <div className="event-feature-card__body">
        <div className="event-badge-row">
          <EventBadge tone="status">{event.lifecycleLabel}</EventBadge>
          <EventBadge tone="category">
            {toEventCategoryLabel(event.category)}
          </EventBadge>
          {event.registrationBadgeLabel ? (
            <EventBadge tone="registration">
              {event.registrationBadgeLabel}
            </EventBadge>
          ) : null}
        </div>
        <h2 className="event-feature-card__title">{event.title}</h2>
        <p className="event-feature-card__summary">{event.summary}</p>
        <div className="event-card-meta">
          <EventDateMeta event={event} />
          {hasSpecificLocation(event.locationLabel) ? (
            <span className="event-card-meta__row">
              <MapPin aria-hidden="true" size={15} />
              {event.locationLabel}
            </span>
          ) : null}
        </div>
        <div className="event-feature-card__actions">
          <Link
            className="secondary-button event-card-action"
            href={`/events/${event.slug}`}
          >
            Open featured event
          </Link>
          {event.ctaUrl ? (
            <Link className="secondary-button event-card-action" href={event.ctaUrl}>
              {event.ctaLabel || "Open related link"}
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

// UX-R5: reusable notification card
function UpcomingNotificationCard({ className = "" }: { className?: string }) {
  return (
    <aside className={`event-feature-card event-upcoming-card ${className}`}>
      <div className="event-upcoming-card__copy">
        {/* UX-R6: inline notification heading */}
        <div className="event-upcoming-card__heading">
          <span className="event-upcoming-card__icon">
            <Bell aria-hidden="true" size={24} />
          </span>
          <h2>Get notified when new events are announced.</h2>
        </div>
        <p>
          Upcoming programs are announced here first for workshops,
          competitions, and member activities.
        </p>
      </div>
      <a className="primary-button event-upcoming-card__notify" href="#footer-newsletter-email">
        Notify me →
      </a>
    </aside>
  );
}

function HeroFeaturedZone({
  event,
  view,
}: {
  event: EventListItem | null;
  view: EventArchiveView;
}) {
  if (event) {
    return (
      <div className="event-hero-featured-zone" data-mode={view}>
        <FeaturedEventCard event={event} />
      </div>
    );
  }

  if (view === "upcoming") {
    return (
      <div className="event-hero-featured-zone" data-mode="notify">
        <UpcomingNotificationCard className="event-upcoming-card--desktop" />
      </div>
    );
  }

  return null;
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
  // UX-FIX-R3: upcoming empty side card
  const showUpcomingNoticeCard = archive.view === "upcoming" && !featuredEvent;
  const hasHeroSidecar = archive.view === "upcoming" || Boolean(featuredEvent);
  const pageNumbers = buildPageNumbers(archive.page, archive.totalPages);
  const monthGroups = archive.view === "past" ? groupEventsByMonth(archive.items) : [];
  const paginationContext = getPaginationContext(
    archive.page,
    archive.totalItems,
    archive.items.length
  );

  return (
    <div className="event-archive-page shell py-12">
      <section className="event-archive-hero glass-card overflow-hidden px-6 py-6 sm:px-8 sm:py-8">
        {/* UX-FIX: Hero dead zone */}
        <div className="event-hero-grid" data-featured={hasHeroSidecar ? "true" : "false"}>
          <div className="event-archive-hero__copy">
            <span className="eyebrow event-archive-hero__eyebrow">JnUITS Events</span>
            <h1 className="event-archive-hero__title">
              Browse upcoming programs, competitions, and public society events.
            </h1>
            <p className="section-copy max-w-[58ch]">
              Explore workshops, competitions, tours, and community programs
              from Jagannath University IT Society with structured schedules,
              clear status badges, and a growing archive of public activity.
            </p>
            {archive.totalItems > 0 ? (
              <div className="event-hero-mini-stat">
                <strong>{archive.totalItems}</strong>
                <span>events in archive</span>{/* UX-R6: archive count copy */}
              </div>
            ) : (
              <p className="event-hero-empty-note">
                New events are added regularly — check back soon.
              </p>
            )}
          </div>

          <HeroFeaturedZone event={featuredEvent} view={archive.view} />
        </div>
      </section>

      <EventArchiveFilters
        categories={archive.categories}
        categoryCounts={archive.categoryCounts}
        category={category}
        query={query}
        view={archive.view}
      />

      <section className="event-archive-section">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="grid gap-3">
            <span className="sr-only">Event archive</span>{/* UX-R5: hide visible event archive label */}
            <h2 className="event-archive-section__title">
              {archive.view === "upcoming" ? "Upcoming schedule" : "Past events archive"}
            </h2>
          </div>
          {archive.totalItems > 0 ? ( // UX-R4: hide zero count label
            <span className="status-pill self-end">
              {archive.totalItems} event{archive.totalItems === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>

        {archive.items.length ? (
          archive.view === "past" ? (
            <div className="event-month-groups">
              {monthGroups.map((group) => (
                <section className="event-month-group" key={group.label}>
                  {/* UX-FIX: Month-grouped past events */}
                  <div className="event-month-heading">
                    {group.label} · {group.items.length} event
                    {group.items.length === 1 ? "" : "s"}
                  </div>
                  <div className="event-archive-grid">
                    {group.items.map((event) => (
                      <EventCard event={event} key={event.id} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="event-archive-grid">
              {archive.items.map((event) => (
                <EventCard event={event} key={event.id} />
              ))}
            </div>
          )
        ) : (
          /* UX-FIX: Empty state (Upcoming tab) */
          <EmptyState
            actions={
              archive.view === "upcoming"
                ? [{ href: "/events?view=past", label: "View past events", variant: "primary" }]
                : [{ href: "/events?view=past", label: "Clear filters", variant: "secondary" }]
            }
            className="event-empty-state"
            description={
              archive.view === "upcoming"
                ? undefined
                : "Adjust the filters or clear your search to return to the full archive."
            }
            icon={<CalendarX aria-hidden="true" />}
            title={
              archive.view === "upcoming"
                ? "No upcoming events right now — check back soon or browse past events."
                : "No past events matched your filters"
            }
          />
        )}
      </section>

      {showUpcomingNoticeCard ? (
        <UpcomingNotificationCard className="event-upcoming-card--mobile" />
      ) : null}{/* UX-R5: mobile notification order */}

      {paginationContext ? (
        <p className="event-pagination-context">{paginationContext}</p>
      ) : null}
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
