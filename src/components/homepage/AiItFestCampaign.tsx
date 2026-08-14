import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  ExternalLink,
  MapPin,
  Sparkles,
  Users,
} from "lucide-react";

import {
  AI_IT_FEST_2026_CORE_EVENT_SLUG,
  AI_IT_FEST_2026_PRESENTATION,
  AI_IT_FEST_2026_STANDARD_EVENT_SLUGS,
  AI_IT_FEST_2026_UMBRELLA_SLUG,
  AI_IT_FEST_2026_URLS,
} from "@/lib/content/ai-it-fest-2026";
import type { EventListItem } from "@/lib/content/events";

import styles from "./ai-it-fest-campaign.module.css";

type AiItFestCampaignProps = {
  events: readonly EventListItem[];
};

function formatCampaignDate(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-BD", {
    day: "numeric",
    month: "short",
    timeZone,
    year: "numeric",
  }).format(new Date(value));
}

function formatCampaignDeadline(value: string, timeZone: string) {
  const date = new Date(value);
  const includesSourceSeconds = date.getUTCSeconds() !== 0;

  return new Intl.DateTimeFormat("en-BD", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    second: includesSourceSeconds ? "2-digit" : undefined,
    timeZone,
    year: "numeric",
  }).format(date);
}

function ExternalCampaignLink({
  children,
  className,
  href,
}: {
  children: React.ReactNode;
  className: string;
  href: string;
}) {
  return (
    <Link className={className} href={href} rel="noopener noreferrer" target="_blank">
      {children}
    </Link>
  );
}

function CampaignImage({
  event,
  priority = false,
  sizes,
}: {
  event: EventListItem;
  priority?: boolean;
  sizes: string;
}) {
  if (!event.cover) {
    return null;
  }

  return (
    <Image
      alt={event.cover.alt}
      className={styles.image}
      fill
      priority={priority}
      sizes={sizes}
      src={event.cover.fullUrl}
    />
  );
}

function StandardEventCard({ event }: { event: EventListItem }) {
  const presentation =
    AI_IT_FEST_2026_PRESENTATION[
      event.slug as keyof typeof AI_IT_FEST_2026_PRESENTATION
    ];
  const headingId = `fest-card-${event.slug}`;

  return (
    <article aria-labelledby={headingId} className={styles.eventCard}>
      <div className={styles.cardMedia}>
        <CampaignImage
          event={event}
          sizes="(min-width: 1100px) 36rem, (min-width: 720px) 46vw, 100vw"
        />
        <span className={styles.cardStatus}>{event.lifecycleLabel}</span>
      </div>
      <div className={styles.cardBody}>
        <div className={styles.factRow}>
          <span>
            <Users aria-hidden="true" size={15} />
            {presentation.participation}
          </span>
          <span>{presentation.fee}</span>
        </div>
        <h3 id={headingId}>{event.title}</h3>
        <p className={styles.summary}>{event.summary}</p>
        <dl className={styles.cardFacts}>
          <div>
            <dt>
              <CalendarDays aria-hidden="true" size={15} />
              Event
            </dt>
            <dd>{formatCampaignDate(event.startsAt, event.timezone)}</dd>
          </div>
          {event.registrationClosesAt ? (
            <div>
              <dt>
                <Clock3 aria-hidden="true" size={15} />
                Registration closes
              </dt>
              <dd>
                {formatCampaignDeadline(
                  event.registrationClosesAt,
                  event.timezone
                )}
              </dd>
            </div>
          ) : null}
        </dl>
        <div className={styles.cardActions}>
          <Link className={styles.textLink} href={`/events/${event.slug}`}>
            View details <ArrowRight aria-hidden="true" size={15} />
          </Link>
          {event.registrationState === "external" && event.registrationUrl ? (
            <ExternalCampaignLink
              className={styles.compactButton}
              href={event.registrationUrl}
            >
              Register now <ExternalLink aria-hidden="true" size={14} />
            </ExternalCampaignLink>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function hasAiItFestCampaign(events: readonly EventListItem[]) {
  const slugs = new Set(events.map((event) => event.slug));
  return (
    slugs.has(AI_IT_FEST_2026_UMBRELLA_SLUG) &&
    slugs.has(AI_IT_FEST_2026_CORE_EVENT_SLUG)
  );
}

export function AiItFestCampaign({ events }: AiItFestCampaignProps) {
  if (!hasAiItFestCampaign(events)) {
    return null;
  }

  const eventsBySlug = new Map(events.map((event) => [event.slug, event]));
  const umbrella = eventsBySlug.get(AI_IT_FEST_2026_UMBRELLA_SLUG);
  const brainchild = eventsBySlug.get(AI_IT_FEST_2026_CORE_EVENT_SLUG);

  if (!umbrella || !brainchild) {
    return null;
  }

  const standardEvents = AI_IT_FEST_2026_STANDARD_EVENT_SLUGS.flatMap(
    (slug) => {
      const event = eventsBySlug.get(slug);
      return event ? [event] : [];
    }
  );
  const brainchildPresentation =
    AI_IT_FEST_2026_PRESENTATION[AI_IT_FEST_2026_CORE_EVENT_SLUG];

  return (
    <section aria-labelledby="ai-it-fest-title" className={styles.campaign}>
      <div className={`shell ${styles.inner}`}>
        <div className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.presenter}>
              <Sparkles aria-hidden="true" size={16} />
              Presented by Jagannath University IT Society
            </p>
            <h1 id="ai-it-fest-title">JnU AI &amp; IT Fest 2026</h1>
            <p className={styles.tagline}>Where Ideas Meet Intelligence</p>
            <p className={styles.lead}>{umbrella.summary}</p>
            <div className={styles.heroFacts}>
              <span>
                <CalendarDays aria-hidden="true" size={17} />
                {formatCampaignDate(umbrella.startsAt, umbrella.timezone)}
              </span>
              <span>
                <MapPin aria-hidden="true" size={17} />
                Jagannath University
              </span>
            </div>
            <div className={styles.heroActions}>
              <ExternalCampaignLink
                className={styles.primaryButton}
                href={AI_IT_FEST_2026_URLS.festOverview}
              >
                Explore the Fest <ExternalLink aria-hidden="true" size={15} />
              </ExternalCampaignLink>
              <Link className={styles.secondaryButton} href="/events">
                View JnUITS events <ArrowRight aria-hidden="true" size={15} />
              </Link>
            </div>
          </div>
          <div className={styles.heroMedia}>
            <CampaignImage
              event={umbrella}
              priority={true}
              sizes="(min-width: 1000px) 48vw, 100vw"
            />
            <span className={styles.mediaLabel}>Official Fest programme</span>
          </div>
        </div>

        <section
          aria-labelledby="fest-event-showcase-title"
          className={styles.showcase}
        >
          <div className={styles.sectionHeading}>
            <p>Four ways to take part</p>
            <h2 id="fest-event-showcase-title">Fest event showcase</h2>
          </div>
          <div className={styles.eventGrid}>
            {standardEvents.map((event) => (
              <StandardEventCard event={event} key={event.id} />
            ))}
          </div>
        </section>

        <section aria-label="BrainChild core event" className={styles.brainchild}>
          <div className={styles.brainchildMedia}>
            <CampaignImage
              event={brainchild}
              sizes="(min-width: 1000px) 46vw, 100vw"
            />
            <span className={styles.coreLabel}>Core event</span>
          </div>
          <div className={styles.brainchildCopy}>
            <p className={styles.presenter}>National App, Web &amp; AI Project Expo</p>
            <h2>BrainChild Season 2.0</h2>
            <p className={styles.lead}>{brainchild.summary}</p>
            <div className={styles.coreFacts}>
              <span>
                <Users aria-hidden="true" size={16} />
                {brainchildPresentation.participation}
              </span>
              <span>{brainchildPresentation.fee}</span>
              {brainchild.registrationClosesAt ? (
                <span>
                  <Clock3 aria-hidden="true" size={16} />
                  Deadline {formatCampaignDeadline(
                    brainchild.registrationClosesAt,
                    brainchild.timezone
                  )}
                </span>
              ) : null}
            </div>
            <div className={styles.heroActions}>
              {brainchild.registrationState === "external" &&
              brainchild.registrationUrl ? (
                <ExternalCampaignLink
                  className={styles.primaryButton}
                  href={brainchild.registrationUrl}
                >
                  Register for BrainChild
                  <ExternalLink aria-hidden="true" size={15} />
                </ExternalCampaignLink>
              ) : null}
              <ExternalCampaignLink
                className={styles.secondaryButton}
                href={AI_IT_FEST_2026_URLS.brainchildTrack}
              >
                Track registration
              </ExternalCampaignLink>
            </div>
            <nav aria-label="BrainChild resources" className={styles.resourceLinks}>
              <ExternalCampaignLink
                className={styles.textLink}
                href={brainchild.ctaUrl || AI_IT_FEST_2026_URLS.brainchildOverview}
              >
                Explore BrainChild <ExternalLink aria-hidden="true" size={14} />
              </ExternalCampaignLink>
              <ExternalCampaignLink
                className={styles.textLink}
                href={AI_IT_FEST_2026_URLS.brainchildRulebook}
              >
                Read rulebook <ExternalLink aria-hidden="true" size={14} />
              </ExternalCampaignLink>
            </nav>
          </div>
        </section>

        <div className={styles.closingLink}>
          <ExternalCampaignLink
            className={styles.textLink}
            href={AI_IT_FEST_2026_URLS.festEvents}
          >
            Explore every official Fest event
            <ArrowRight aria-hidden="true" size={15} />
          </ExternalCampaignLink>
        </div>
      </div>
    </section>
  );
}
