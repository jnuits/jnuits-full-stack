import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  formatDateRange,
  getPublishedEventByIdentifier,
} from "@/lib/content/public-content";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ identifier: string }>;
}) {
  const { identifier } = await params;
  const event = await getPublishedEventByIdentifier(identifier);

  if (!event) {
    notFound();
  }

  if (identifier !== event.slug) {
    redirect(`/events/${event.slug}`);
  }

  return (
    <div className="shell py-12">
      <article className="glass-card overflow-hidden px-6 py-6 sm:px-8 sm:py-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-start">
          <div>
            <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
              <span>{event.status}</span>
              <span>{event.focus}</span>
            </div>
            <h1 className="section-title mt-4">{event.title}</h1>
            <p className="section-copy mt-5">{event.summary}</p>
            <div className="mt-6 grid gap-2 text-sm text-[var(--muted)]">
              <span className="detail-chip">{event.location}</span>
              <span className="detail-chip">{formatDateRange(event.start, event.end)}</span>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="secondary-button" href="/events">
                Back to events
              </Link>
              {event.ctaHref ? (
                <Link className="ghost-button" href={event.ctaHref} target="_blank">
                  Related link
                </Link>
              ) : null}
            </div>
          </div>

          <div className="relative min-h-[300px] overflow-hidden rounded-[1.6rem] border border-[var(--line)]">
            <Image
              alt={event.title}
              className="object-cover"
              fill
              priority
              sizes="(min-width: 1024px) 40vw, 100vw"
              src={event.imageSrc}
            />
          </div>
        </div>
      </article>

      <section className="mt-8 section-band">
        <p className="section-divider">Event details</p>
        <div className="mt-6 grid gap-4">
          {event.body ? (
            event.body
              .split(/\n{2,}/)
              .map((paragraph) => paragraph.trim())
              .filter(Boolean)
              .map((paragraph) => (
                <p key={paragraph} className="text-base leading-8 text-[var(--muted)]">
                  {paragraph}
                </p>
              ))
          ) : (
            <p className="text-base leading-8 text-[var(--muted)]">
              Further event details will appear here when published by the society.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
