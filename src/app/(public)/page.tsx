import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
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
import {
  AiItFestCampaign,
  hasAiItFestCampaign,
} from "@/components/homepage/AiItFestCampaign";
import { HomepageSlider } from "@/components/homepage/HomepageSlider";
import { AI_IT_FEST_2026_EVENT_SLUGS } from "@/lib/content/ai-it-fest-2026";
import {
  getHomepageUpcomingEvents,
  getPublishedEventsBySlugs,
} from "@/lib/content/events";
import {
  getHomepageContent,
  type HomepageIconName,
} from "@/lib/content/public-content";
import { asFlexibleClient } from "@/lib/supabase/flexible";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 60;

const campaignDescription =
  "Jagannath University IT Society presents JnU AI & IT Fest 2026 on 30 August: four Fest experiences and the core BrainChild Season 2.0 project expo.";
const campaignSocialImage =
  "https://res.cloudinary.com/dbwbwwteo/image/upload/v1786029922/ChatGPT_Image_Aug_6_2026_09_24_46_PM_hrzm6x.png";

export const metadata: Metadata = {
  title: {
    absolute: "JnU AI & IT Fest 2026 | Jagannath University IT Society",
  },
  description: campaignDescription,
  alternates: { canonical: "/" },
  openGraph: {
    description: campaignDescription,
    images: [
      {
        alt: "JnU AI & IT Fest 2026 official campaign artwork",
        url: campaignSocialImage,
      },
    ],
    title: "JnU AI & IT Fest 2026 | JnUITS",
    type: "website",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    description: campaignDescription,
    images: [campaignSocialImage],
    title: "JnU AI & IT Fest 2026 | JnUITS",
  },
};

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

type HomepageAdvisorQuote = {
  avatarUrl: string | null;
  fullName: string;
  id: string;
  speech: string;
  title: string | null;
};

function formatEventBadgeDate(value: string) {
  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return "TBD";
  }

  return eventDateFormatter.format(new Date(timestamp)).toUpperCase();
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

function toCloudinaryAvatarSrc(src: string | null) {
  if (!src) {
    return null;
  }

  return src.includes("res.cloudinary.com")
    ? src.replace("/upload/", "/upload/f_auto,q_auto,w_180/")
    : src;
}

function formatAdvisorName(title: string | null, fullName: string) {
  if (!title) {
    return fullName;
  }

  return fullName.toLowerCase().startsWith(title.toLowerCase())
    ? fullName
    : `${title} ${fullName}`;
}

function getAdvisorInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function truncateQuote(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  const trimmed = value.slice(0, maxLength).trimEnd();
  const boundary = trimmed.lastIndexOf(" ");
  return `${trimmed.slice(0, boundary > 80 ? boundary : trimmed.length)}...`;
}

async function getHomepageAdvisorQuote(): Promise<HomepageAdvisorQuote | null> {
  const supabase = await createClient();
  const flexible = asFlexibleClient(supabase);
  const { data, error } = await flexible
    .from("advisor_profiles" as string)
    .select("id, full_name, title, avatar_secure_url, speech")
    .eq("is_current", true)
    .eq("is_public", true)
    .eq("advisor_type", "moderator_mentor")
    .not("speech", "is", null)
    .neq("speech", "")
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data || typeof data !== "object") {
    return null;
  }

  const record = data as Record<string, unknown>;
  const speech = typeof record.speech === "string" ? record.speech.trim() : "";
  const fullName =
    typeof record.full_name === "string" && record.full_name.trim()
      ? record.full_name.trim()
      : "Advisor";

  if (!speech) {
    return null;
  }

  return {
    avatarUrl:
      typeof record.avatar_secure_url === "string"
        ? toCloudinaryAvatarSrc(record.avatar_secure_url)
        : null,
    fullName,
    id: typeof record.id === "string" ? record.id : fullName,
    speech,
    title:
      typeof record.title === "string" && record.title.trim()
        ? record.title.trim()
        : null,
  };
}

function HomepageAdvisorQuoteSection({
  advisor,
}: {
  advisor: HomepageAdvisorQuote;
}) {
  const displayName = formatAdvisorName(advisor.title, advisor.fullName);
  const desktopQuote = truncateQuote(advisor.speech, 180);
  const mobileQuote = truncateQuote(advisor.speech, 140);

  return (
    <section className="hp-section hp-advisor-quote-section">
      <div className="shell">
        <article className="hp-advisor-quote">
          <div className="hp-advisor-quote__profile">
            {advisor.avatarUrl ? (
              <Image
                alt={displayName}
                className="hp-advisor-quote__photo"
                height={64}
                src={advisor.avatarUrl}
                unoptimized={true}
                width={64}
              />
            ) : (
              <span className="hp-advisor-quote__photo hp-advisor-quote__photo--fallback">
                {getAdvisorInitials(advisor.fullName)}
              </span>
            )}
            <div>
              <h2 className="hp-advisor-quote__name">{displayName}</h2>
              <p className="hp-advisor-quote__role">Moderator &amp; Mentor, JnUITS</p>
            </div>
          </div>
          <div className="hp-advisor-quote__content">
            <blockquote>
              <span className="hp-advisor-quote__text hp-advisor-quote__text--desktop">
                {desktopQuote}
              </span>
              <span className="hp-advisor-quote__text hp-advisor-quote__text--mobile">
                {mobileQuote}
              </span>
            </blockquote>
            <Link className="hp-advisor-quote__link" href="/about#advisor-messages">
              Read full message <ArrowRight aria-hidden="true" size={14} />
            </Link>
          </div>
        </article>
      </div>
    </section>
  );
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
  const events = await getHomepageUpcomingEvents();

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
                {formatEventBadgeDate(event.startsAt)}
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
  const [homepageContent, advisorQuote, campaignEvents] = await Promise.all([
    getHomepageContent(),
    getHomepageAdvisorQuote(),
    getPublishedEventsBySlugs(AI_IT_FEST_2026_EVENT_SLUGS),
  ]);
  const SocietyHeroHeading = hasAiItFestCampaign(campaignEvents) ? "h2" : "h1";

  return (
    <div className="hp-root">
      <AiItFestCampaign events={campaignEvents} />

      <section className="hp-section hp-hero">
        <div className="shell hp-hero__inner">
          <div className="hp-hero__copy">
            <span className="slogan-pill hp-hero__badge">
              {homepageContent.hero.eyebrow}
            </span>
            <SocietyHeroHeading className="hp-h1">
              <span>Jagannath University</span>
              <br className="hp-h1-break" />
              {" "}
              <span>IT Society</span>
            </SocietyHeroHeading>
            <p className="hp-body hp-hero__body">
              {homepageContent.hero.subheading}
            </p>
            <div className="hp-button-row hp-hero-buttons">
              <Link className="hp-button hp-button--primary" href={homepageContent.hero.primaryCTA.href}>
                {homepageContent.hero.primaryCTA.label}
              </Link>
              <Link
                className="hp-button hp-btn-secondary"
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
          <article className="hp-about-card" aria-labelledby="homepage-about-heading">
            <p className="hp-eyebrow" id="homepage-about-heading">
              {homepageContent.about.eyebrow}
            </p>
            <p className="hp-body">{homepageContent.about.body}</p>
            <Link className="hp-inline-link" href={homepageContent.about.cta.href}>
              {homepageContent.about.cta.label}
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

      {advisorQuote ? <HomepageAdvisorQuoteSection advisor={advisorQuote} /> : null}

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
