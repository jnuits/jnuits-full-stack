import Image from "next/image";
import Link from "next/link";
import {
  formatDateRange,
  getPublishedEvents,
} from "@/lib/content/public-content";

export default async function EventsPage() {
  const publicEvents = await getPublishedEvents();
  const featuredEvent = publicEvents[0];

  return (
    <div className="shell py-12">
      <section className="glass-card overflow-hidden px-6 py-6 sm:px-8 sm:py-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div>
            <span className="eyebrow">Programs and timelines</span>
            <h1 className="section-title mt-4">
              Upcoming and recent JnUITS programs in one public event stream.
            </h1>
            <p className="section-copy mt-5">
              Browse workshops, sessions, and society activities with clear
              schedule information and direct event detail pages.
            </p>
          </div>

          <article
            className="overflow-hidden rounded-[1.8rem] border border-[var(--line)]"
            style={{
              background: "color-mix(in oklab, var(--card) 94%, transparent)",
            }}
          >
            <div className="relative h-72">
              <Image
                alt={featuredEvent.title}
                className="object-cover"
                fill
                priority
                sizes="(min-width: 1024px) 40vw, 100vw"
                src={featuredEvent.imageSrc}
              />
            </div>
            <div className="p-6">
              <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-blue)]">
                <span>{featuredEvent.status}</span>
                <span>{featuredEvent.focus}</span>
              </div>
              <h2 className="mt-3 font-[family-name:var(--font-heading)] text-[2rem] leading-[0.98] tracking-[-0.04em]">
                {featuredEvent.title}
              </h2>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                {featuredEvent.summary}
              </p>
              <div className="mt-6">
                <Link className="secondary-button" href={`/events/${featuredEvent.slug}`}>
                  Open event details
                </Link>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="mt-8 section-band">
        <p className="section-divider">Program stream</p>
        <div className="mt-6 grid gap-5">
          {publicEvents.map((event) => (
            <article
              key={event.slug}
              className="grid gap-5 rounded-[1.4rem] border border-[var(--line)] p-5 lg:grid-cols-[220px_minmax(0,1fr)_180px]"
              style={{
                background: "color-mix(in oklab, var(--card) 94%, transparent)",
              }}
            >
              <div className="relative min-h-[160px] overflow-hidden rounded-[1.2rem] border border-[var(--line)]">
                <Image
                  alt={event.title}
                  className="object-cover"
                  fill
                  sizes="220px"
                  src={event.imageSrc}
                />
              </div>
              <div>
                <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                  <span>{event.status}</span>
                  <span>{event.focus}</span>
                </div>
                <h3 className="mt-3 font-[family-name:var(--font-heading)] text-[1.7rem] leading-[1.02] tracking-[-0.04em]">
                  {event.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                  {event.summary}
                </p>
                <div className="mt-4">
                  <Link className="queue-link" href={`/events/${event.slug}`}>
                    Open event details
                  </Link>
                </div>
              </div>
              <div className="grid content-start gap-2">
                <span className="detail-chip">{event.location}</span>
                <span className="detail-chip">{formatDateRange(event.start, event.end)}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
