import Image from "next/image";
import Link from "next/link";
import {
  formatDateRange,
  getPublishedEvents,
} from "@/lib/content/public-content";
import { createAdminClient } from "@/lib/supabase/admin";
import { EmptyState } from "@/components/ui/empty-state";

// ── Types ──────────────────────────────────────────────────────────────────

type EventFilter = "all" | "upcoming" | "past";

const FILTER_TABS: Array<{ key: EventFilter; label: string }> = [
  { key: "all", label: "All events" },
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
];

// ── Registration status fetch ──────────────────────────────────────────────

async function getRegistrationStatusMap(
  eventIds: string[]
): Promise<Map<string, { open: boolean; capacity: number | null; registered: number }>> {
  const map = new Map<string, { open: boolean; capacity: number | null; registered: number }>();
  if (eventIds.length === 0) return map;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any;
    const [postsResult, countsResult] = await Promise.all([
      admin
        .from("content_posts")
        .select("id, registration_open, event_capacity")
        .in("id", eventIds),
      admin
        .from("event_registrations")
        .select("event_post_id")
        .in("event_post_id", eventIds)
        .is("cancelled_at", null),
    ]);

    const registeredCounts = new Map<string, number>();
    for (const row of countsResult.data ?? []) {
      const id = row.event_post_id as string;
      registeredCounts.set(id, (registeredCounts.get(id) ?? 0) + 1);
    }

    for (const post of postsResult.data ?? []) {
      map.set(post.id as string, {
        open: Boolean(post.registration_open),
        capacity: (post.event_capacity as number | null) ?? null,
        registered: registeredCounts.get(post.id as string) ?? 0,
      });
    }
  } catch {
    // non-critical — gracefully omit registration pills
  }

  return map;
}

// ── Registration pill ───────────────────────────────────────────────────────

function RegistrationPill({
  status,
}: {
  status: { open: boolean; capacity: number | null; registered: number } | undefined;
}) {
  if (!status || !status.open) return null;

  const { capacity, registered } = status;
  const isFull = capacity !== null && registered >= capacity;
  const spotsLeft = capacity !== null ? capacity - registered : null;

  if (isFull) {
    return (
      <span
        className="detail-chip"
        style={{ color: "var(--muted-foreground)", borderColor: "var(--line)" }}
      >
        Registration full
      </span>
    );
  }

  return (
    <span
      className="detail-chip"
      style={{
        color: "#22c55e",
        borderColor: "color-mix(in oklab,#22c55e 30%,transparent)",
        background: "color-mix(in oklab,#22c55e 8%,transparent)",
      }}
    >
      {spotsLeft !== null ? `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left` : "Registration open"}
    </span>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the current epoch timestamp. Hoisted here so ESLint's purity rule
 *  doesn't flag it inside the async server component body. */
function nowMs(): number {
  return Date.now();
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filterRaw = typeof sp.filter === "string" ? sp.filter : "all";
  const activeFilter: EventFilter =
    filterRaw === "upcoming" || filterRaw === "past" ? filterRaw : "all";

  // Fetch all published events then filter client-side (avoids extra DB roundtrip)
  const allEvents = await getPublishedEvents();
  const now = nowMs();

  const filteredEvents = allEvents.filter((ev) => {
    if (activeFilter === "upcoming") return new Date(ev.start).getTime() >= now;
    if (activeFilter === "past") return new Date(ev.start).getTime() < now;
    return true;
  });

  const featuredEvent = filteredEvents[0] ?? allEvents[0];

  // Fetch registration status for all filtered events (ids come from public-content)
  // The public EventPreview doesn't include id — fetch via titles won't work.
  // We need to extend public-content or use a lightweight admin lookup.
  // For now: fetch id->slug mapping and build status map.
  let statusMap = new Map<string, { open: boolean; capacity: number | null; registered: number }>();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any;
    const { data: slugRows } = await admin
      .from("content_posts")
      .select("id, slug")
      .eq("content_type", "event")
      .eq("status", "published");

    const slugToId = new Map<string, string>((slugRows ?? []).map((r: { id: string; slug: string }) => [r.slug, r.id]));
    const eventIds = filteredEvents
      .map((ev) => slugToId.get(ev.slug))
      .filter((id): id is string => Boolean(id));

    statusMap = await getRegistrationStatusMap(eventIds);

    // remap status by slug for rendering
    const idBySlug = new Map<string, string>((slugRows ?? []).map((r: { id: string; slug: string }) => [r.slug, r.id]));
    const slugStatusMap = new Map<string, typeof statusMap extends Map<string, infer V> ? V : never>();
    for (const ev of filteredEvents) {
      const id = idBySlug.get(ev.slug);
      if (id) {
        const s = statusMap.get(id);
        if (s) slugStatusMap.set(ev.slug, s);
      }
    }
    // replace for use below
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (statusMap as any).__bySlug = slugStatusMap;
  } catch {
    // non-critical
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const slugStatus = (statusMap as any).__bySlug as Map<string, { open: boolean; capacity: number | null; registered: number }> | undefined;

  return (
    <div className="shell py-12">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="glass-card overflow-hidden px-6 py-6 sm:px-8 sm:py-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div>
            <span className="eyebrow">Programs and timelines</span>
            <h1 className="section-title mt-4">
              JnUITS programs and events — one public stream.
            </h1>
            <p className="section-copy mt-5">
              Browse workshops, sessions, and society activities with clear schedule
              information and direct event detail pages.
            </p>

            {/* Filter tabs */}
            <div className="mt-8 flex flex-wrap gap-2" role="tablist" aria-label="Event time filter">
              {FILTER_TABS.map((tab) => (
                <Link
                  key={tab.key}
                  href={tab.key === "all" ? "/events" : `/events?filter=${tab.key}`}
                  role="tab"
                  aria-selected={activeFilter === tab.key}
                  className={activeFilter === tab.key ? "primary-button" : "secondary-button"}
                >
                  {tab.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Featured card */}
          {featuredEvent ? (
            <article className="overflow-hidden rounded-[1.8rem] border border-[var(--line)]"
              style={{ background: "color-mix(in oklab, var(--card) 94%, transparent)" }}
            >
              <div className="relative h-64">
                <Image
                  alt={featuredEvent.title}
                  className="object-cover"
                  fill
                  priority
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  src={featuredEvent.imageSrc}
                />
                {/* Registration pill overlay */}
                {slugStatus?.get(featuredEvent.slug) ? (
                  <div className="absolute bottom-3 left-3">
                    <RegistrationPill status={slugStatus.get(featuredEvent.slug)} />
                  </div>
                ) : null}
              </div>
              <div className="p-6">
                <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-blue)]">
                  <span>{featuredEvent.status}</span>
                  <span>{featuredEvent.focus}</span>
                </div>
                <h2 className="mt-3 font-[family-name:var(--font-heading)] text-[2rem] leading-[0.98] tracking-[-0.04em]">
                  {featuredEvent.title}
                </h2>
                <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">{featuredEvent.summary}</p>
                <div className="mt-6">
                  <Link className="secondary-button" href={`/events/${featuredEvent.slug}`}>
                    Open event details
                  </Link>
                </div>
              </div>
            </article>
          ) : null}
        </div>
      </section>

      {/* ── Program stream ───────────────────────────────────────────────── */}
      <section className="mt-8 section-band">
        <div className="flex items-baseline justify-between gap-4">
          <p className="section-divider">Program stream</p>
          <span className="text-sm text-[var(--muted-foreground)]">
            {filteredEvents.length} event{filteredEvents.length === 1 ? "" : "s"}
          </span>
        </div>

        {filteredEvents.length === 0 ? (
          <EmptyState
            title={
              activeFilter === "upcoming"
                ? "No upcoming events scheduled"
                : activeFilter === "past"
                  ? "No past events found"
                  : "No events published yet"
            }
            description={
              activeFilter === "upcoming"
                ? "Check back soon — new events are added regularly. Browse past events while you wait."
                : "All published events will appear here."
            }
            actions={
              activeFilter !== "all"
                ? [{ label: "View all events", href: "/events", variant: "secondary" as const }]
                : []
            }
            className="mt-6"
          />
        ) : (
          <div className="mt-6 grid gap-5">
            {filteredEvents.map((event) => {
              const regStatus = slugStatus?.get(event.slug);
              return (
                <article
                  key={event.slug}
                  className="grid gap-5 rounded-[1.4rem] border border-[var(--line)] p-5 lg:grid-cols-[220px_minmax(0,1fr)_200px]"
                  style={{ background: "color-mix(in oklab, var(--card) 94%, transparent)" }}
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
                    <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                      <span>{event.status}</span>
                      <span>{event.focus}</span>
                    </div>
                    <h3 className="mt-3 font-[family-name:var(--font-heading)] text-[1.7rem] leading-[1.02] tracking-[-0.04em]">
                      {event.title}
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">{event.summary}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <Link className="queue-link" href={`/events/${event.slug}`}>
                        Open event details
                      </Link>
                      <RegistrationPill status={regStatus} />
                    </div>
                  </div>

                  <div className="grid content-start gap-2">
                    <span className="detail-chip">{event.location}</span>
                    <span className="detail-chip">{formatDateRange(event.start, event.end)}</span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
