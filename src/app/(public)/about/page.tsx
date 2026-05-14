import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  getPublicCommitteeDirectory,
  type PublicCommitteeTerm,
} from "@/lib/committee/public";
import { getAboutContent } from "@/lib/content/public-content";

function toCloudinaryOptimizedSrc(src: string) {
  return src.includes("res.cloudinary.com")
    ? src.replace("/upload/", "/upload/f_auto,q_auto,w_1200/")
    : src;
}

type TimelineSource = {
  dateSource?: string | null;
  date: string;
  event: string;
  href?: string;
};

type TimelineMilestoneItem = TimelineSource & {
  dateSource: string | null;
  isFuture: boolean;
  isMostRecent: boolean;
  timestamp: number | null;
  year: string;
};

type TimelineYearGroup = {
  isFuture: boolean;
  isMostRecent: boolean;
  items: TimelineMilestoneItem[];
  timestamp: number | null;
  year: string;
};

type AboutCustomStyle = CSSProperties & {
  "--about-value-accent"?: string;
};

type CommunityReachItem = {
  icon: "facebook" | "message" | "users" | "whatsapp";
  label: string;
  stat: string;
  title: string;
  href?: string;
};

const valueAccentVars = [
  "#2563EB",
  "#7C3AED",
  "#059669",
  "#D97706",
  "#DC2626",
];

const communityReachItems: CommunityReachItem[] = [
  {
    icon: "facebook",
    label: "Followers",
    stat: "16,000+",
    title: "Facebook Page",
  },
  {
    icon: "users",
    label: "Members",
    stat: "6,300+",
    title: "Facebook Group",
  },
  {
    href: "https://chat.whatsapp.com/ED7sJf7QSiD2YBY3Miz8MC",
    icon: "whatsapp",
    label: "Subscribers",
    stat: "726+",
    title: "WhatsApp Community",
  },
  {
    href: "https://www.messenger.com/channel/jnuits",
    icon: "message",
    label: "Members",
    stat: "441+",
    title: "Messenger Channel",
  },
];

const milestoneDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatMilestoneDate(value: string | null) {
  if (!value) {
    return "Date pending";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return milestoneDateFormatter.format(date);
}

function getMilestoneTimestamp(value: string | null) {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function getMilestoneYear(value: string | null, fallback: string) {
  const timestamp = getMilestoneTimestamp(value);

  if (timestamp !== null) {
    return new Date(timestamp).getFullYear().toString();
  }

  const match = fallback.match(/\b(20\d{2}|19\d{2})\b/);
  return match?.[1] || "TBD";
}

function getCommitteeMilestoneDate(term: PublicCommitteeTerm) {
  return term.electionDate || term.startsOn;
}

function compareCommitteeTerms(
  left: PublicCommitteeTerm,
  right: PublicCommitteeTerm
) {
  if (left.termNumber && right.termNumber) {
    return left.termNumber - right.termNumber;
  }

  const leftDate = new Date(getCommitteeMilestoneDate(left) || "").getTime();
  const rightDate = new Date(getCommitteeMilestoneDate(right) || "").getTime();

  if (Number.isNaN(leftDate) || Number.isNaN(rightDate)) {
    return left.title.localeCompare(right.title);
  }

  return leftDate - rightDate;
}

function formatCommitteeMilestoneEvent(term: PublicCommitteeTerm) {
  if (term.termNumber === 1) {
    return "Founding Committee elected";
  }

  return /elected$/i.test(term.title) ? term.title : `${term.title} elected`;
}

function buildTimelineMilestones(
  baseMilestones: TimelineSource[],
  terms: PublicCommitteeTerm[]
): TimelineMilestoneItem[] {
  const institutionalMilestones = baseMilestones.filter(
    (item) => !/executive committee/i.test(item.event)
  );
  const committeeMilestones = [...terms]
    .sort(compareCommitteeTerms)
    .map((term) => ({
      dateSource: getCommitteeMilestoneDate(term),
      date: formatMilestoneDate(getCommitteeMilestoneDate(term)),
      event: formatCommitteeMilestoneEvent(term),
      href: `/committee/${term.slug}`,
    }));
  const mappedMilestones = [...institutionalMilestones, ...committeeMilestones].map(
    (item) => {
      const dateSource = item.dateSource || item.date || null;
      const timestamp = getMilestoneTimestamp(dateSource);

      return {
        ...item,
        dateSource,
        isFuture: timestamp !== null && timestamp > Date.now(),
        isMostRecent: false,
        timestamp,
        year: getMilestoneYear(dateSource, item.date),
      };
    }
  );
  const mostRecentIndex = mappedMilestones.reduce((latestIndex, item, index) => {
    if (item.timestamp === null) {
      return latestIndex;
    }

    if (
      latestIndex === -1 ||
      item.timestamp > (mappedMilestones[latestIndex]?.timestamp || 0)
    ) {
      return index;
    }

    return latestIndex;
  }, -1);

  return mappedMilestones.map((item, index) => ({
    ...item,
    isMostRecent: index === mostRecentIndex,
  }));
}

function groupTimelineByYear(items: TimelineMilestoneItem[]) {
  const groupsByYear = new Map<string, TimelineYearGroup>();
  const groups: TimelineYearGroup[] = [];

  for (const item of items) {
    let group = groupsByYear.get(item.year);

    if (!group) {
      group = {
        isFuture: item.isFuture,
        isMostRecent: false,
        items: [],
        timestamp: item.timestamp,
        year: item.year,
      };
      groupsByYear.set(item.year, group);
      groups.push(group);
    }

    group.items.push(item);
    group.isFuture = group.items.every((entry) => entry.isFuture);

    if (
      item.timestamp !== null &&
      (group.timestamp === null || item.timestamp > group.timestamp)
    ) {
      group.timestamp = item.timestamp;
    }
  }

  const mostRecentTimestamp = groups.reduce<number | null>((latest, group) => {
    if (group.timestamp === null) {
      return latest;
    }

    return latest === null || group.timestamp > latest ? group.timestamp : latest;
  }, null);

  return groups.map((group) => ({
    ...group,
    isMostRecent:
      mostRecentTimestamp !== null && group.timestamp === mostRecentTimestamp,
  }));
}

function ProgramIcon({ title }: { title: string }) {
  const normalized = title.toLowerCase();

  if (normalized.includes("competition")) {
    return (
      <svg aria-hidden="true" className="about-program-icon" fill="none" viewBox="0 0 24 24">
        <path
          d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <path
          d="M17 6h3v1a4 4 0 0 1-4 4M7 6H4v1a4 4 0 0 0 4 4"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (normalized.includes("seminar") || normalized.includes("talk")) {
    return (
      <svg aria-hidden="true" className="about-program-icon" fill="none" viewBox="0 0 24 24">
        <path
          d="M12 14a4 4 0 0 0 4-4V6a4 4 0 0 0-8 0v4a4 4 0 0 0 4 4Z"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M6 10a6 6 0 0 0 12 0M12 20v-3M8.5 20h7"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (normalized.includes("outreach")) {
    return (
      <svg aria-hidden="true" className="about-program-icon" fill="none" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <path
          d="M3 12h18M12 3c2.2 2.4 3.4 5.4 3.4 9S14.2 18.6 12 21c-2.2-2.4-3.4-5.4-3.4-9S9.8 5.4 12 3Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="about-program-icon" fill="none" viewBox="0 0 24 24">
      <rect
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
        width="18"
        x="3"
        y="4"
      />
      <path
        d="M8 20h8M12 16v4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function CommunityReachIcon({ icon }: { icon: CommunityReachItem["icon"] }) {
  if (icon === "facebook") {
    return (
      <svg aria-hidden="true" className="about-reach-icon" viewBox="0 0 24 24">
        <path
          d="M14.3 8.9V6.7c0-.7.5-1.3 1.3-1.3h1.4V2.1c-.7-.1-1.6-.1-2.5-.1-2.9 0-4.9 1.8-4.9 5v1.9H6.7v3.7h2.9V22h3.8v-9.4h3l.5-3.7h-3Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  if (icon === "users") {
    return (
      <svg aria-hidden="true" className="about-reach-icon" fill="none" viewBox="0 0 24 24">
        <path
          d="M16 19c0-2.2-1.8-4-4-4H7c-2.2 0-4 1.8-4 4"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2"
        />
        <path
          d="M14.5 5.4a3 3 0 1 1 0 5.2M9.5 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM21 19c0-1.8-1.2-3.2-2.9-3.8"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (icon === "whatsapp") {
    return (
      <svg aria-hidden="true" className="about-reach-icon" fill="none" viewBox="0 0 24 24">
        <path
          d="M5.4 18.8 6.5 15A7.1 7.1 0 1 1 9 17.5l-3.6 1.3Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <path
          d="M9.2 8.6c.2-.5.4-.5.7-.5h.5c.2 0 .4 0 .5.4l.7 1.5c.1.3.1.5-.1.7l-.5.6c.6 1.1 1.5 1.9 2.6 2.4l.6-.7c.2-.2.4-.3.7-.2l1.5.7c.3.1.4.3.4.6v.4c0 .4-.1.7-.5.9-.5.3-1.2.4-2.1.2-2.7-.6-5.2-3-5.9-5.8-.2-.5 0-1 .4-1.2Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="about-reach-icon" fill="none" viewBox="0 0 24 24">
      <path
        d="M4 6.8A3.8 3.8 0 0 1 7.8 3h8.4A3.8 3.8 0 0 1 20 6.8v5.4a3.8 3.8 0 0 1-3.8 3.8H12l-4.6 4v-4A3.8 3.8 0 0 1 4 12.2V6.8Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M8 9.5h8M8 12.5h5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function CommunityReachCard({ item }: { item: CommunityReachItem }) {
  const content = (
    <>
      <span className="about-reach-card__icon">
        <CommunityReachIcon icon={item.icon} />
      </span>
      <span className="about-reach-card__stat">{item.stat}</span>
      <span className="about-reach-card__label">{item.label}</span>
      <span className="about-reach-card__title">{item.title}</span>
    </>
  );

  if (item.href) {
    return (
      <a
        aria-label={`${item.title} opens in a new tab`}
        className="about-reach-card about-reach-card--link"
        href={item.href}
        rel="noopener noreferrer"
        target="_blank"
      >
        {content}
      </a>
    );
  }

  return <div className="about-reach-card">{content}</div>;
}

function renderTimelineTitle(item: TimelineMilestoneItem): ReactNode {
  if (!item.href) {
    return item.event;
  }

  return (
    <Link className="about-timeline__link" href={item.href}>
      {item.event}
    </Link>
  );
}

export default async function AboutPage() {
  const [aboutContent, committeeDirectory] = await Promise.all([
    getAboutContent(),
    getPublicCommitteeDirectory(),
  ]);
  const optimizedSrc = toCloudinaryOptimizedSrc(aboutContent.imageSrc);
  const timelineItems = buildTimelineMilestones(
    aboutContent.timeline,
    committeeDirectory.terms
  );
  const timelineGroups = groupTimelineByYear(timelineItems);
  const statItems = [
    {
      label: "Members",
      note: "300+ active members per committee. Our broader community is much larger.",
      value: aboutContent.stats.active_members,
    },
    {
      label: "Events",
      value: aboutContent.stats.events_organized,
    },
    {
      label: "Years",
      value: aboutContent.stats.years_active,
    },
    {
      label: "Terms",
      value: aboutContent.stats.executive_terms,
    },
  ];

  return (
    <div className="about-page">
      <section className="about-section about-section--hero">
        <div className="shell">
          <div className="about-hero">
            <div className="about-hero__copy">
              <span className="about-hero-badge">Step ahead with IT</span>
              <h1 className="about-hero__title">
                About Jagannath University IT Society
              </h1>
              <p className="about-body about-hero__description">
                {aboutContent.heroDescription}
              </p>

              <div className="about-button-row about-hero__actions">
                <Link className="about-button about-button--primary" href="/membership-form">
                  Join now
                </Link>
                <Link className="about-button about-button--outline" href="/events">
                  Explore events
                </Link>
              </div>

              <div className="about-hero__stats-wrap">
                <div
                  aria-label="JnUITS impact statistics"
                  className="about-hero__stats"
                >
                  {statItems.map((stat) => (
                    <div
                      className="about-stat"
                      key={stat.label}
                      title={stat.note}
                    >
                      <p className="about-stat__number">{stat.value}</p>
                      <p className="about-stat__label">{stat.label}</p>
                    </div>
                  ))}
                </div>
                <p className="about-caption about-hero__stats-note">
                  300+ active members per committee. Our broader community is much larger.
                </p>
              </div>
            </div>

            <div className="about-hero__image-frame">
              <Image
                alt="Jagannath University business faculty building"
                className="about-hero__image"
                height={900}
                priority
                sizes="(min-width: 1280px) 43vw, 100vw"
                src={optimizedSrc}
                unoptimized={true}
                width={1200}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="about-section about-section--alt">
        <div className="shell about-mission-grid">
          <article className="about-feature-card about-feature-card--mission">
            <div className="about-feature-card__inner">
              <span className="about-eyebrow">Mission</span>
              <h2 className="about-section-title">Why JnUITS exists</h2>
              <p className="about-body">{aboutContent.missionStatement}</p>
            </div>
          </article>

          <article className="about-feature-card about-feature-card--vision">
            <div className="about-feature-card__inner">
              <span className="about-eyebrow">Vision</span>
              <h2 className="about-section-title">Where we&apos;re going</h2>
              <p className="about-body">{aboutContent.vision}</p>
            </div>
          </article>
        </div>
      </section>

      <section className="about-section">
        <div className="shell">
          <div className="about-section-heading">
            <span className="about-eyebrow">What we do</span>
            <h2 className="about-section-title">
              Practical programs for a stronger campus tech community
            </h2>
          </div>
          <div className="about-program-grid">
            {aboutContent.programs.map((program) => (
              <article className="about-program-card" key={program.title}>
                <div className="about-program-card__icon">
                  <ProgramIcon title={program.title} />
                </div>
                <h3 className="about-card-title">{program.title}</h3>
                <p className="about-card-text">{program.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="about-section about-section--alt">
        <div className="shell">
          <div className="about-section-heading">
            <span className="about-eyebrow">Core values</span>
            <h2 className="about-section-title">
              Principles that shape the society
            </h2>
          </div>
          <div aria-label="Core values" className="about-values">
            <div className="about-values__row about-values__row--top">
              {aboutContent.values.slice(0, 3).map((value, index) => (
                <article
                  className="about-value-card"
                  key={value.title}
                  style={{
                    "--about-value-accent":
                      valueAccentVars[index % valueAccentVars.length],
                  } as AboutCustomStyle}
                >
                  <h3 className="about-card-title">{value.title}</h3>
                  <p className="about-card-text">{value.description}</p>
                </article>
              ))}
            </div>
            <div className="about-values__row about-values__row--bottom">
              {aboutContent.values.slice(3).map((value, index) => (
                <article
                  className="about-value-card"
                  key={value.title}
                  style={{
                    "--about-value-accent":
                      valueAccentVars[(index + 3) % valueAccentVars.length],
                  } as AboutCustomStyle}
                >
                  <h3 className="about-card-title">{value.title}</h3>
                  <p className="about-card-text">{value.description}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="about-section about-section--reach">
        <div className="shell">
          <div className="about-section-heading">
            <span className="about-eyebrow">Community reach</span>
            <h2 className="about-section-title">
              Our network beyond the campus
            </h2>
          </div>
          <div className="about-reach-grid">
            {communityReachItems.map((item) => (
              <CommunityReachCard item={item} key={item.title} />
            ))}
          </div>
          <p className="about-caption about-reach-caption">
            Apart from these, our Messenger groups, WhatsApp groups, and other social media
            channels include additional members and followers.
          </p>
        </div>
      </section>

      <section className="about-section">
        <div className="shell">
          <div className="about-section-heading">
            <span className="about-eyebrow">History timeline</span>
            <h2 className="about-section-title">Key milestones</h2>
          </div>
          <div className="about-timeline">
            <div className="about-timeline__line" aria-hidden="true" />
            {timelineGroups.map((group) => (
              <article className="about-timeline__group" key={group.year}>
                <p className="about-timeline__year">{group.year}</p>
                <span
                  aria-hidden="true"
                  className={`about-timeline__dot ${
                    group.isFuture ? "about-timeline__dot--future" : ""
                  } ${group.isMostRecent ? "about-timeline__dot--current" : ""}`}
                />
                <ul className="about-timeline__events">
                  {group.items.map((item) => (
                    <li
                      className={`about-timeline__event ${
                        group.items.length > 1 ? "about-timeline__event--nested" : ""
                      }`}
                      key={`${item.date}-${item.event}`}
                    >
                      {group.items.length > 1 ? (
                        <span className="about-timeline__subdot" aria-hidden="true" />
                      ) : null}
                      <div>
                        <h3 className="about-timeline__event-title">
                          {renderTimelineTitle(item)}
                        </h3>
                        <p className="about-timeline__date">{item.date}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="about-section about-section--cta">
        <div className="shell">
          <div className="about-cta">
            <h2 className="about-section-title">Ready to step ahead with IT?</h2>
            <p className="about-body about-cta__copy">
              Join our community of {aboutContent.stats.active_members} tech enthusiasts at Jagannath
              University.
            </p>
            <p className="about-caption about-cta__trust">
              Trusted by students, alumni, and industry mentors across Jagannath University.
            </p>
            <div className="about-button-row about-cta__actions">
              <Link className="about-button about-button--primary" href="/membership-form">
                Join now
              </Link>
              <Link className="about-button about-button--outline" href="/events">
                Explore events
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
