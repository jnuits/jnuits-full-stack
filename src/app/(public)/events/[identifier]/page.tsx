import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  formatDateRange,
  getPublishedEventByIdentifier,
} from "@/lib/content/public-content";
import { createAdminClient } from "@/lib/supabase/admin";
import { RegistrationForm } from "@/components/events/registration-form";

async function getRegistrationContext(eventId: string) {
  try {
    const admin = createAdminClient();
    const [postResult, countResult] = await Promise.all([
      admin
        .from("content_posts")
        .select("registration_open, event_capacity, registration_closes_at")
        .eq("id", eventId)
        .maybeSingle(),
      admin
        .from("event_registrations")
        .select("id", { count: "exact", head: true })
        .eq("event_post_id", eventId)
        .is("cancelled_at", null),
    ]);

    const post = postResult.data;
    if (!post) return null;

    const capacity = (post as { event_capacity?: number | null }).event_capacity ?? null;
    const registered = countResult.count ?? 0;
    const spotsRemaining = capacity !== null ? Math.max(0, capacity - registered) : null;
    const open = (post as { registration_open?: boolean }).registration_open ?? false;

    return { registrationOpen: open, spotsRemaining };
  } catch {
    return null;
  }
}

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

  const registrationCtx = await getRegistrationContext(event.id);

  return (
    <div className="shell py-12">
      <article className="glass-card overflow-hidden px-6 py-6 sm:px-8 sm:py-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-start">
          <div>
            <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
              <span>{event.status}</span>
              <span>{event.focus}</span>
            </div>
            <h1 className="section-title mt-4">{event.title}</h1>
            <p className="section-copy mt-5">{event.summary}</p>
            <div className="mt-6 grid gap-2 text-sm text-[var(--muted-foreground)]">
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

      {registrationCtx ? (
        <section className="mt-8 section-band">
          <p className="section-divider">Event registration</p>
          <div className="mt-6 max-w-lg">
            <RegistrationForm
              eventId={event.id}
              eventTitle={event.title}
              spotsRemaining={registrationCtx.spotsRemaining}
              registrationOpen={registrationCtx.registrationOpen}
            />
          </div>
        </section>
      ) : null}

      <section className="mt-8 section-band">
        <p className="section-divider">Event details</p>
        <div className="mt-6 grid gap-4">
          {event.body ? (
            event.body
              .split(/\n{2,}/)
              .map((paragraph) => paragraph.trim())
              .filter(Boolean)
              .map((paragraph) => (
                <p key={paragraph} className="text-base leading-8 text-[var(--muted-foreground)]">
                  {paragraph}
                </p>
              ))
          ) : (
            <p className="text-base leading-8 text-[var(--muted-foreground)]">
              Further event details will appear here when published by the society.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
