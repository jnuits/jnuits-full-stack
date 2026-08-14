import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  ExternalLink,
  Image as ImageIcon,
  MapPin,
} from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { EventBadge } from "@/components/events/event-badge";
import { EventCardImage } from "@/components/events/event-card-image";
import { EventMarkdown } from "@/components/events/event-markdown";
import { EventShareActions } from "@/components/events/event-share-actions";
import { RegistrationForm } from "@/components/events/registration-form";
import {
  formatEventDateRange,
  getPublicEventsPage,
  getPublishedEventBySlug,
  resolvePublishedEventForMutation,
  stripEventMetadataTrailer,
  toEventCategoryLabel,
  toEventDeliveryModeLabel,
} from "@/lib/content/events";
import { loadPublishedFormByVersionId } from "@/lib/forms/repository";
import { getAppBaseUrl } from "@/lib/env";
import { getAuthCaptchaUiConfig } from "@/lib/security/captcha";

type PageParams = {
  identifier: string;
};

async function getEventOrNull(identifier: string) {
  return getPublishedEventBySlug(identifier);
}

async function getLinkedRegistrationForm(eventId: string) {
  try {
    const target = await resolvePublishedEventForMutation(eventId);
    if (!target?.registrationFormVersionId) {
      return null;
    }

    const form = await loadPublishedFormByVersionId(target.registrationFormVersionId);
    return form?.kind === "event_registration" ? form : null;
  } catch {
    // Preserve current public event registration when form migrations are not installed yet.
    return null;
  }
}


function hasSpecificLocation(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();

  return Boolean(normalized) && !normalized.includes("to be announced");
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

function formatEventDetailDateRange(
  startsAt: string,
  endsAt: string | null,
  timeZone = "Asia/Dhaka"
) {
  if (!endsAt) {
    return formatEventDateRange(startsAt, endsAt, timeZone);
  }

  const start = getTimeParts(startsAt, timeZone);
  const end = getTimeParts(endsAt, timeZone);
  const isAllDay =
    start.hour === 0 &&
    start.minute === 0 &&
    end.hour === 23 &&
    end.minute >= 58;

  if (!isAllDay) {
    return formatEventDateRange(startsAt, endsAt, timeZone);
  }

  const dateLabel = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone,
    year: "numeric",
  }).format(new Date(startsAt));

  return dateLabel; // UX-R4: date-only event range
}

function getTotalParticipants(event: {
  registeredCount: number;
  sourceMetadata: unknown;
}) {
  if (event.registeredCount > 0) {
    return event.registeredCount;
  }

  if (!event.sourceMetadata || typeof event.sourceMetadata !== "object") {
    return null;
  }

  const metadata = event.sourceMetadata as Record<string, unknown>;
  const possibleKeys = [
    "totalParticipants",
    "total_participants",
    "participantCount",
    "participant_count",
    "participants",
  ];

  for (const key of possibleKeys) {
    const value = metadata[key];
    const parsed = typeof value === "number" ? value : Number(value);

    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { identifier } = await params;
  const event = await getEventOrNull(identifier);

  if (!event) {
    return {
      title: "Event not found | JnUITS",
    };
  }

  const url = `${getAppBaseUrl()}/events/${event.slug}`;

  return {
    title: `${event.title} | JnUITS Events`,
    description: event.summary,
    alternates: {
      canonical: url,
    },
    openGraph: {
      description: event.summary,
      images: event.cover
        ? [
            {
              alt: event.cover.alt,
              height: event.cover.height,
              url: event.cover.fullUrl,
              width: event.cover.width,
            },
          ]
        : undefined,
      title: event.title,
      type: "article",
      url,
    },
  };
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { identifier } = await params;
  const event = await getEventOrNull(identifier);

  if (!event) {
    notFound();
  }

  if (identifier !== event.slug) {
    redirect(`/events/${event.slug}`);
  }

  const hasLocation = hasSpecificLocation(event.locationLabel);
  const eventDateLabel = formatEventDetailDateRange(
    event.startsAt,
    event.endsAt,
    event.timezone
  );
  const eventCategoryLabel = toEventCategoryLabel(event.category);
  const eventDeliveryModeLabel = toEventDeliveryModeLabel(event.deliveryMode);
  const totalParticipants = getTotalParticipants(event);
  const eventUrl = `${getAppBaseUrl()}/events/${event.slug}`;
  const linkedRegistrationForm = event.registrationMode === "internal"
    ? await getLinkedRegistrationForm(event.id)
    : null;
  const recentPastEvents = await getPublicEventsPage({ page: 1, view: "past" });
  // UX-FIX-R3: more events row
  const moreEvents = recentPastEvents.items
    .filter((item) => item.slug !== event.slug)
    .slice(0, 3);
  const eventBody =
    stripEventMetadataTrailer(
      event.bodyMarkdown?.trim() ||
        event.summary?.trim() ||
        "Full event details will appear here once published by the society."
    );

  return (
    <div className="shell py-12">
      <section className="glass-card overflow-hidden px-6 py-6 sm:px-8 sm:py-8">
        <div className="event-detail-hero">
          <div>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                className="event-back-link inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted-foreground)]"
                href="/events"
              >
                <ArrowLeft aria-hidden="true" size={16} strokeWidth={2.25} />
                Back to events
              </Link>
              {/* UX-FIX-R3: split status and category pills */}
              <div className="event-badge-row">
                <EventBadge tone="status">{event.lifecycleLabel}</EventBadge>
                <EventBadge tone="category">{eventCategoryLabel}</EventBadge>
              </div>
            </div>

            {/* UX-R6: event detail share bar */}
            <EventShareActions title={event.title} url={eventUrl} />

            <h1 className="section-title mt-6">{event.title}</h1>
            <p className="section-copy mt-5">{event.summary}</p>

            <div className="mt-6 flex flex-wrap gap-2">
              {event.registrationBadgeLabel ? (
                <span className="tag-pill tag-pill--status detail-chip">{event.registrationBadgeLabel}</span>
              ) : null}
              {hasLocation ? (
                <span className="tag-pill tag-pill--status detail-chip">{event.locationLabel}</span>
              ) : null}
            </div>

            <div className="mt-6 grid gap-3 text-sm text-[var(--muted-foreground)]">
              <span className="inline-flex items-center gap-2">
                <CalendarClock aria-hidden="true" size={15} />
                {eventDateLabel}
              </span>
              {hasLocation ? (
                <span className="inline-flex items-center gap-2">
                  <MapPin aria-hidden="true" size={15} />
                  {event.locationLabel}
                </span>
              ) : null}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              {event.registrationState === "external" && event.registrationUrl ? (
                <Link
                  className="primary-button"
                  href={event.registrationUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Register externally
                </Link>
              ) : null}
              {event.ctaUrl ? (
                <Link
                  className="secondary-button"
                  href={event.ctaUrl}
                  rel={event.ctaUrl.startsWith("/") ? undefined : "noreferrer"}
                  target={event.ctaUrl.startsWith("/") ? undefined : "_blank"}
                >
                  {event.ctaLabel || "Open related link"}
                  {!event.ctaUrl.startsWith("/") ? (
                    <ExternalLink aria-hidden="true" className="ml-1" size={15} />
                  ) : null}
                </Link>
              ) : null}
            </div>
          </div>

          <div className="event-detail-hero__media">
            {event.cover ? (
              <div className="event-detail-hero__image-wrap">
                {/* UX-R6: contained event detail image */}
                <Image
                  alt={event.cover.alt}
                  className="event-detail-hero__image"
                  fill
                  priority
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  src={event.cover.fullUrl}
                />
              </div>
            ) : (
              <div className="event-card__placeholder h-full">
                <ImageIcon aria-hidden="true" size={20} />
                <span>No event cover available</span>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mt-8 event-detail-grid">
        <article className="section-band">
          <p className="section-divider">Event details</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <EventBadge tone="category">{eventCategoryLabel}</EventBadge>
            <EventBadge tone="category">{eventDeliveryModeLabel}</EventBadge>
            {typeof event.capacity === "number" ? (
              <span className="tag-pill tag-pill--status detail-chip">
                {event.registeredCount}/{event.capacity} registered
              </span>
            ) : null}
          </div>
          <div className="mt-6 event-detail-description event-detail-prose">
            <EventMarkdown format={event.bodyFormat} source={eventBody} />
          </div>
        </article>

        <aside className="grid gap-6">
          <section className="section-band">
            <p className="section-divider">Quick facts</p>
            <dl className="event-facts-list event-facts-list--compact">
              <div>
                <dt>Delivery mode</dt>
                <dd>{eventDeliveryModeLabel}</dd>
              </div>
              {hasLocation ? (
                <div>
                  <dt>Location</dt>
                  <dd>{event.locationLabel}</dd>
                </div>
              ) : null}
              <div>
                <dt>Registration</dt>
                <dd>{event.registrationBadgeLabel || "Not required"}</dd>
              </div>
              {typeof event.capacity === "number" ? (
                <div>
                  <dt>Capacity</dt>
                  <dd>
                    {event.capacity} seats
                    {typeof event.spotsRemaining === "number"
                      ? ` · ${event.spotsRemaining} available`
                      : ""}
                  </dd>
                </div>
              ) : null}
              {totalParticipants ? (
                <div>
                  <dt>Total participants</dt>
                  <dd>{totalParticipants}</dd>
                </div>
              ) : null}
              {event.onlineUrl ? (
                <div>
                  <dt>Online link</dt>
                  <dd>
                    <Link
                      className="event-fact-link"
                      href={event.onlineUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open event link
                      <ExternalLink aria-hidden="true" size={13} />
                    </Link>
                  </dd>
                </div>
              ) : null}
              {event.venueAddress ? (
                <div>
                  <dt>Address</dt>
                  <dd>{event.venueAddress}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          {event.registrationMode === "internal" ? (
            <RegistrationForm
              captcha={getAuthCaptchaUiConfig()}
              eventId={event.id}
              eventTitle={event.title}
              formHref={linkedRegistrationForm ? `/forms/${linkedRegistrationForm.slug}` : undefined}
              registrationOpen={event.registrationState === "open"}
              spotsRemaining={event.spotsRemaining}
            />
          ) : null}
        </aside>
      </section>

      {moreEvents.length ? (
        <section className="event-more-section">
          <div className="event-more-section__header">
            <p className="section-divider">More events</p>
            <h2>Continue browsing</h2>
          </div>
          <div className="event-more-grid">
            {moreEvents.map((item) => (
              <Link
                className="event-more-card"
                href={`/events/${item.slug}`}
                key={item.id}
              >
                <span className="event-more-card__media card-image">
                  <EventCardImage
                    alt={item.cover?.alt || item.title}
                    category={item.category}
                    sizes="(min-width: 1024px) 9rem, 40vw"
                    src={item.cover?.thumbnailUrl}
                  />
                </span>
                <span className="event-more-card__body">
                  <span className="event-more-card__date">
                    {formatEventDetailDateRange(
                      item.startsAt,
                      item.endsAt,
                      item.timezone
                    )}
                  </span>
                  <strong>{item.title}</strong>
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
