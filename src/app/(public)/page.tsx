import Link from "next/link";
import { Suspense, type ComponentType } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Heart,
  Lightbulb,
  Monitor,
  Star,
  Trophy,
  Users,
} from "lucide-react";
import { HomepageSlider } from "@/components/homepage/HomepageSlider";
import {
  getHomepageContent,
  getPublishedEvents,
  type EventPreview,
  type HomepageIconName,
} from "@/lib/content/public-content";

const homepageIcons: Record<
  HomepageIconName,
  ComponentType<{ className?: string; "aria-hidden"?: boolean }>
> = {
  bulb: Lightbulb,
  heart: Heart,
  monitor: Monitor,
  star: Star,
  trophy: Trophy,
  users: Users,
};

const eventDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  month: "short",
});

function formatEventBadgeDate(value: string) {
  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return "TBD";
  }

  return eventDateFormatter.format(new Date(timestamp)).toUpperCase();
}

function getUpcomingEvents(events: EventPreview[]) {
  const now = Date.now();

  return events
    .filter((event) => {
      const timestamp = new Date(event.start).getTime();
      return event.status === "Upcoming" && !Number.isNaN(timestamp) && timestamp >= now;
    })
    .sort((left, right) => {
      return new Date(left.start).getTime() - new Date(right.start).getTime();
    })
    .slice(0, 3);
}

function HomepageIcon({
  className,
  icon,
}: {
  className?: string;
  icon: HomepageIconName;
}) {
  const Icon = homepageIcons[icon];
  return <Icon aria-hidden={true} className={className} />;
}

function EventSkeleton() {
  return (
    <section className="hp-section hp-events" aria-label="Loading upcoming events">
      <div className="shell">
        <div className="hp-section-head">
          <div className="hp-skeleton hp-skeleton--eyebrow" />
          <div className="hp-skeleton hp-skeleton--heading" />
        </div>
        <div className="hp-events-grid">
          {Array.from({ length: 3 }, (_, index) => (
            <div className="hp-event-card hp-event-card--skeleton" key={index}>
              <div className="hp-skeleton hp-skeleton--date" />
              <div className="hp-skeleton hp-skeleton--title" />
              <div className="hp-skeleton hp-skeleton--line" />
              <div className="hp-skeleton hp-skeleton--line hp-skeleton--short" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

async function UpcomingEventsSection() {
  const events = getUpcomingEvents(await getPublishedEvents());

  if (events.length === 0) {
    return null;
  }

  return (
    <section className="hp-section hp-events">
      <div className="shell">
        <div className="hp-section-head">
          <p className="hp-eyebrow">What&apos;s coming up</p>
          <h2 className="hp-h2">Upcoming events</h2>
        </div>
        <div className="hp-events-grid">
          {events.map((event) => (
            <article className="hp-event-card" key={event.slug}>
              <p className="hp-event-card__date">
                <CalendarDays aria-hidden="true" size={14} strokeWidth={2} />
                {formatEventBadgeDate(event.start)}
              </p>
              <h3 className="hp-event-card__title">{event.title}</h3>
              <p className="hp-event-card__summary">{event.summary}</p>
              <Link className="hp-event-card__link" href={`/events/${event.slug}`}>
                View details <ArrowRight aria-hidden="true" size={14} strokeWidth={2} />
              </Link>
            </article>
          ))}
        </div>
        <Link className="hp-section-link" href="/events">
          See all events <ArrowRight aria-hidden="true" size={15} strokeWidth={2} />
        </Link>
      </div>
    </section>
  );
}

export default async function HomePage() {
  const homepageContent = await getHomepageContent();

  return (
    <div className="hp-root">
      <section className="hp-section hp-hero">
        <div className="shell hp-hero__inner">
          <div className="hp-hero__copy">
            <span className="hp-hero__badge">{homepageContent.hero.eyebrow}</span>
            <h1 className="hp-h1">{homepageContent.hero.heading}</h1>
            <p className="hp-body hp-hero__body">
              {homepageContent.hero.subheading}
            </p>
            <div className="hp-button-row hp-hero-buttons">
              <Link className="hp-button hp-button--primary" href={homepageContent.hero.primaryCTA.href}>
                {homepageContent.hero.primaryCTA.label}
              </Link>
              <Link
                className="hp-button hp-button--outline"
                href={homepageContent.hero.secondaryCTA.href}
              >
                {homepageContent.hero.secondaryCTA.label}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="shell">
        <HomepageSlider images={homepageContent.sliderImages} />
      </div>

      <section className="hp-stats-section" aria-label="JnUITS impact statistics">
        <div className="shell">
          <div className="hp-hero-stats hp-stats-band">
            {homepageContent.stats.map((stat) => (
              <div
                className="hp-hero-stat hp-stats-item"
                key={`${stat.value}-${stat.label}`}
              >
                <p className="hp-hero-stat__number">{stat.value}</p>
                <p className="hp-hero-stat__label">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="hp-section hp-about">
        <div className="shell">
          <article className="hp-about-card">
            <p className="hp-eyebrow">{homepageContent.about.eyebrow}</p>
            <p className="hp-body">{homepageContent.about.body}</p>
            <Link className="hp-inline-link" href={homepageContent.about.cta.href}>
              {homepageContent.about.cta.label} <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </article>
        </div>
      </section>

      <section className="hp-section hp-programs">
        <div className="shell">
          <div className="hp-section-head">
            <p className="hp-eyebrow">What we do</p>
            <h2 className="hp-h2">Programs built for real skills</h2>
          </div>
          <div className="hp-program-grid">
            {homepageContent.programs.map((program) => (
              <article className="hp-program-card" key={program.title}>
                <span className="hp-program-card__icon">
                  <HomepageIcon className="hp-icon hp-icon--large" icon={program.icon} />
                </span>
                <h3 className="hp-program-card__title">{program.title}</h3>
                <p className="hp-program-card__desc">{program.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="hp-section hp-impact">
        <div className="shell">
          <div className="hp-impact__head">
            <p className="hp-eyebrow hp-eyebrow--inverse">Our impact</p>
            <h2 className="hp-h2 hp-impact__heading">
              A decade of technology and community
            </h2>
          </div>
          <div className="hp-impact-grid">
            {homepageContent.achievementBand.stats.map((stat) => (
              <div className="hp-impact-stat" key={`${stat.value}-${stat.label}`}>
                <p className="hp-impact-stat__number">{stat.value}</p>
                <p className="hp-impact-stat__label">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Suspense fallback={<EventSkeleton />}>
        <UpcomingEventsSection />
      </Suspense>

      <section className="hp-section hp-membership">
        <div className="shell hp-membership__grid">
          <div className="hp-membership__copy">
            <p className="hp-eyebrow">{homepageContent.membership.eyebrow}</p>
            <h2 className="hp-h2">{homepageContent.membership.heading}</h2>
            <p className="hp-body">{homepageContent.membership.body}</p>
            <ul className="hp-membership-list">
              {homepageContent.membership.bullets.map((bullet) => (
                <li key={bullet}>
                  <Check aria-hidden="true" size={18} strokeWidth={2.2} />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
          <aside className="hp-membership-card">
            <Link
              className="hp-button hp-button--primary hp-button--full"
              href={homepageContent.membership.primaryCTA.href}
            >
              {homepageContent.membership.primaryCTA.label}
            </Link>
            <Link
              className="hp-membership-card__link"
              href={homepageContent.membership.secondaryCTA.href}
            >
              {homepageContent.membership.secondaryCTA.label}{" "}
              <ArrowRight aria-hidden="true" size={14} />
            </Link>
          </aside>
        </div>
      </section>

      <section className="hp-section hp-values">
        <div className="shell">
          <div className="hp-section-head">
            <p className="hp-eyebrow">What drives us</p>
            <h2 className="hp-h2">Values at the core of everything we do</h2>
          </div>
          <div className="hp-values-grid">
            {homepageContent.values.map((value) => (
              <article className="hp-value-card" key={value.title}>
                <HomepageIcon className="hp-icon hp-icon--value" icon={value.icon} />
                <h3 className="hp-value-card__title">{value.title}</h3>
                <p className="hp-value-card__desc">{value.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="hp-section hp-university">
        <div className="shell">
          <div className="hp-university__inner">
            <p>{homepageContent.universityContext.text}</p>
            <a
              className="hp-inline-link"
              href={homepageContent.universityContext.link.href}
              rel={homepageContent.universityContext.link.external ? "noopener noreferrer" : undefined}
              target={homepageContent.universityContext.link.external ? "_blank" : undefined}
            >
              {homepageContent.universityContext.link.label}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
