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
import { EventMarkdown } from "@/components/events/event-markdown";
import { RegistrationForm } from "@/components/events/registration-form";
import {
  formatEventDateRange,
  getPublishedEventBySlug,
  toEventCategoryLabel,
} from "@/lib/content/events";
import { getAppBaseUrl } from "@/lib/env";

type PageParams = {
  identifier: string;
};

async function getEventOrNull(identifier: string) {
  return getPublishedEventBySlug(identifier);
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

  return (
    <div className="shell py-12">
      <section className="glass-card overflow-hidden px-6 py-6 sm:px-8 sm:py-8">
        <div className="event-detail-hero">
          <div>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted-foreground)] transition hover:-translate-x-0.5 hover:text-[var(--primary)]"
                href="/events"
              >
                <ArrowLeft aria-hidden="true" size={16} strokeWidth={2.25} />
                Back to events
              </Link>
              <span className="eyebrow inline-flex">
                {event.lifecycleLabel} · {toEventCategoryLabel(event.category)}
              </span>
            </div>

            <h1 className="section-title mt-6">{event.title}</h1>
            <p className="section-copy mt-5">{event.summary}</p>

            <div className="mt-6 flex flex-wrap gap-2">
              <span className="detail-chip">{event.registrationBadgeLabel || "Event details"}</span>
              <span className="detail-chip">{event.locationLabel}</span>
            </div>

            <div className="mt-6 grid gap-3 text-sm text-[var(--muted-foreground)]">
              <span className="inline-flex items-center gap-2">
                <CalendarClock aria-hidden="true" size={15} />
                {formatEventDateRange(event.startsAt, event.endsAt, event.timezone)}
              </span>
              <span className="inline-flex items-center gap-2">
                <MapPin aria-hidden="true" size={15} />
                {event.locationLabel}
              </span>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              {event.registrationMode === "external" && event.registrationUrl ? (
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
              <Image
                alt={event.cover.alt}
                className="object-cover"
                fill
                priority
                sizes="(min-width: 1024px) 40vw, 100vw"
                src={event.cover.fullUrl}
              />
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
            <span className="detail-chip">{toEventCategoryLabel(event.category)}</span>
            <span className="detail-chip">{event.deliveryMode}</span>
            {typeof event.capacity === "number" ? (
              <span className="detail-chip">
                {event.registeredCount}/{event.capacity} registered
              </span>
            ) : null}
          </div>
          <div className="mt-6 event-markdown-shell">
            <EventMarkdown
              source={
                event.bodyMarkdown?.trim() ||
                "Full event details will appear here once published by the society."
              }
            />
          </div>
        </article>

        <aside className="grid gap-6">
          <section className="section-band">
            <p className="section-divider">Quick facts</p>
            <dl className="event-facts-list">
              <div>
                <dt>Date</dt>
                <dd>{formatEventDateRange(event.startsAt, event.endsAt, event.timezone)}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>{event.locationLabel}</dd>
              </div>
              <div>
                <dt>Registration</dt>
                <dd>{event.registrationBadgeLabel || "Not required"}</dd>
              </div>
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
              eventId={event.id}
              eventTitle={event.title}
              registrationOpen={event.registrationOpen}
              spotsRemaining={event.spotsRemaining}
            />
          ) : null}
        </aside>
      </section>
    </div>
  );
}
