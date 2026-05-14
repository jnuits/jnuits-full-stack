import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
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

function parseCounter(value: string) {
  const match = value.match(/^(\d+)(.*)$/);

  if (!match) {
    return { display: value, suffix: "", target: 0 };
  }

  return {
    display: value,
    suffix: match[2] || "",
    target: Number(match[1]),
  };
}

type TimelineMilestone = {
  date: string;
  event: string;
  href?: string;
};

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
  return /elected$/i.test(term.title) ? term.title : `${term.title} elected`;
}

function buildTimelineMilestones(
  baseMilestones: TimelineMilestone[],
  terms: PublicCommitteeTerm[]
) {
  const institutionalMilestones = baseMilestones.filter(
    (item) => !/executive committee/i.test(item.event)
  );
  const committeeMilestones = [...terms]
    .sort(compareCommitteeTerms)
    .map((term) => ({
      date: formatMilestoneDate(getCommitteeMilestoneDate(term)),
      event: formatCommitteeMilestoneEvent(term),
      href: `/committee/${term.slug}`,
    }));

  return [...institutionalMilestones, ...committeeMilestones];
}

function getSocialIconName(platform: string) {
  const normalized = platform.toLowerCase();

  if (normalized.includes("group")) {
    return "group";
  }

  if (normalized.includes("youtube")) {
    return "youtube";
  }

  if (normalized.includes("twitter") || normalized === "x") {
    return "twitter";
  }

  if (normalized.includes("facebook")) {
    return "facebook";
  }

  if (normalized.includes("linkedin")) {
    return "linkedin";
  }

  if (normalized.includes("instagram")) {
    return "instagram";
  }

  return "website";
}

function SocialChannelIcon({ platform }: { platform: string }) {
  const icon = getSocialIconName(platform);
  const className = "h-4 w-4";

  if (icon === "facebook") {
    return (
      <svg aria-hidden="true" className={className} viewBox="0 0 24 24">
        <path
          d="M14.3 8.9V6.7c0-.7.5-1.3 1.3-1.3h1.4V2.1c-.7-.1-1.6-.1-2.5-.1-2.9 0-4.9 1.8-4.9 5v1.9H6.7v3.7h2.9V22h3.8v-9.4h3l.5-3.7h-3Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  if (icon === "linkedin") {
    return (
      <svg aria-hidden="true" className={className} viewBox="0 0 24 24">
        <path
          d="M6.5 8.8H2.9V21h3.6V8.8ZM4.7 3C3.5 3 2.6 3.8 2.6 4.9c0 1.1.8 1.9 2 1.9h.1c1.2 0 2-.8 2-1.9C6.7 3.8 5.9 3 4.7 3Zm16.7 11c0-3.7-2-5.5-4.7-5.5-2.1 0-3.1 1.2-3.6 2V8.8H9.5V21h3.6v-6.8c0-.4 0-.7.1-1 .3-.7.9-1.5 2-1.5 1.4 0 2 1.1 2 2.8V21h3.6l.6-7Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  if (icon === "instagram") {
    return (
      <svg
        aria-hidden="true"
        className={className}
        fill="none"
        viewBox="0 0 24 24"
      >
        <rect
          height="16"
          rx="4.4"
          stroke="currentColor"
          strokeWidth="2"
          width="16"
          x="4"
          y="4"
        />
        <circle cx="12" cy="12" r="3.4" stroke="currentColor" strokeWidth="2" />
        <circle cx="16.7" cy="7.3" fill="currentColor" r="1.1" />
      </svg>
    );
  }

  if (icon === "youtube") {
    return (
      <svg aria-hidden="true" className={className} viewBox="0 0 24 24">
        <path
          d="M22 8.2a3 3 0 0 0-2.1-2.1C18 5.6 12 5.6 12 5.6s-6 0-7.9.5A3 3 0 0 0 2 8.2 31.6 31.6 0 0 0 1.5 12c0 1.3.2 2.6.5 3.8A3 3 0 0 0 4.1 18c1.9.5 7.9.5 7.9.5s6 0 7.9-.5a3 3 0 0 0 2.1-2.1c.3-1.2.5-2.5.5-3.8 0-1.4-.2-2.7-.5-3.9ZM10 15.1V8.9l5.2 3.1-5.2 3.1Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  if (icon === "twitter") {
    return (
      <svg aria-hidden="true" className={className} viewBox="0 0 24 24">
        <path
          d="M13.7 10.5 21.1 2h-1.8l-6.4 7.4L7.8 2H2l7.8 11.3L2 22h1.8l6.8-7.7 5.5 7.7H22l-8.3-11.5Zm-2.4 2.7-.8-1.1L4.2 3.3h2.7l5 7 .8 1.1 6.7 9.4h-2.7l-5.4-7.6Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  if (icon === "group") {
    return (
      <svg
        aria-hidden="true"
        className={className}
        fill="none"
        viewBox="0 0 24 24"
      >
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

  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path
        d="M3.5 12h17M12 3c2.3 2.5 3.5 5.5 3.5 9S14.3 18.5 12 21c-2.3-2.5-3.5-5.5-3.5-9S9.7 5.5 12 3Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
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
  const statItems = [
    {
      label: "Active Members",
      value: aboutContent.stats.active_members,
    },
    {
      label: "Events Organized",
      value: aboutContent.stats.events_organized,
    },
    {
      label: "Years Active",
      value: aboutContent.stats.years_active,
    },
    {
      label: "Executive Terms",
      value: aboutContent.stats.executive_terms,
    },
  ];

  return (
    <div className="shell overflow-x-hidden py-12">
      <section className="glass-card overflow-hidden px-5 py-6 sm:px-8 sm:py-8">
        <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1.16fr)_minmax(0,0.84fr)] lg:items-center">
          <div className="min-w-0" data-about-animate="hero-left">
            <span className="eyebrow">STEP AHEAD WITH IT</span>
            <h1 className="section-title mt-4 max-w-full break-words [overflow-wrap:anywhere]">
              About Jagannath University IT Society
            </h1>
            <p className="mt-5 max-w-[70ch] text-sm font-medium leading-6 text-[var(--muted-foreground)]">
              {aboutContent.heroDescription}
            </p>
            <div className="mt-8 flex flex-col flex-wrap gap-3 sm:flex-row">
              <Link href="/membership-form" className="primary-button min-h-11 w-full sm:w-auto">
                Membership status
              </Link>
              <Link href="/events" className="secondary-button min-h-11 w-full sm:w-auto">
                Explore events
              </Link>
            </div>
          </div>

          <div
            className="relative min-w-0 overflow-hidden rounded-[1.8rem] border border-[var(--line)]"
            data-about-animate="hero-right"
          >
            <Image
              alt="Jagannath University business faculty building"
              className="aspect-[4/3] h-full w-full object-cover text-transparent"
              height={900}
              priority
              sizes="(min-width: 1024px) 45vw, 100vw"
              src={optimizedSrc}
              unoptimized={true}
              width={1200}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-[linear-gradient(to_top,rgba(0,0,0,0.72)_0%,rgba(0,0,0,0.3)_60%,transparent_100%)]"
            />
            <div className="absolute bottom-4 left-4 right-4 z-10 rounded-[1.35rem] border border-[var(--line)] bg-[color-mix(in_oklab,var(--brand-deep)_76%,transparent)] p-5 text-white shadow-[var(--shadow-panel)] backdrop-blur-md sm:bottom-5 sm:left-5 sm:right-auto sm:max-w-[24rem]">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-white">
                Institutional identity
              </p>
              <p className="mt-3 break-words text-sm leading-7 text-white">
                JnUITS presents its mission, values, and history with a clear
                public profile for students, alumni, and partners.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        className="section-band mt-8 border-t border-t-[var(--color-border)]"
        aria-label="JnUITS impact statistics"
      >
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
          {statItems.map((stat) => {
            const counter = parseCounter(stat.value);

            return (
              <div
                key={stat.label}
                className="stat-item px-2 py-2 text-center lg:px-6"
              >
                <p
                  aria-label={`${stat.value} ${stat.label}`}
                  aria-live="polite"
                  className="font-[family-name:var(--font-heading)] text-[clamp(2rem,4vw,2.75rem)] font-bold leading-none text-[var(--primary)]"
                  data-about-counter=""
                  data-about-counter-display={counter.display}
                  data-about-counter-suffix={counter.suffix}
                  data-about-counter-value={counter.target}
                >
                  {stat.value}
                </p>
                <p className="mt-2 text-sm font-medium text-[var(--muted-foreground)]">
                  {stat.label}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-8 grid items-stretch gap-6 lg:grid-cols-2">
        <article
          className="glass-card h-full p-6 sm:p-8"
          data-about-animate="card"
        >
          <div className="h-full border-l-[3px] border-l-[var(--color-primary)] pl-4 sm:pl-5">
            <p className="section-divider">Mission</p>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[2rem] leading-[0.98] tracking-[-0.04em]">
              Why JnUITS exists
            </h2>
            <p className="mt-5 text-base leading-8 text-[var(--muted-foreground)]">
              {aboutContent.missionStatement}
            </p>
          </div>
        </article>

        <article
          className="glass-card h-full p-6 sm:p-8"
          data-about-animate="card"
          data-about-delay="100"
        >
          <div className="h-full border-l-[3px] border-l-[var(--color-primary)] pl-4 sm:pl-5">
            <p className="section-divider">Vision</p>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[2rem] leading-[0.98] tracking-[-0.04em]">
              Where we&apos;re going
            </h2>
            <p className="mt-5 text-base leading-8 text-[var(--muted-foreground)]">
              {aboutContent.vision}
            </p>
          </div>
        </article>
      </section>

      <section className="mt-8 section-band">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <p className="section-divider mx-auto !tracking-[0.12em]">What we do</p>
          <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,3rem)] leading-none tracking-[-0.04em]">
            Practical programs for a stronger campus tech community
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {aboutContent.programs.map((program, index) => (
            <article
              key={program.title}
              className="glass-card value-card border border-[var(--color-border)] p-6 motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out hover:border-[var(--color-primary)] motion-safe:hover:-translate-y-[3px] motion-safe:hover:shadow-[var(--shadow-md)]"
              data-about-animate="card"
              data-about-delay={index * 100}
            >
              <div
                className="flex h-12 w-12 items-center justify-center rounded-[var(--radius)] bg-[color-mix(in_oklab,var(--primary)_10%,transparent)] text-2xl"
                aria-hidden="true"
              >
                {program.icon}
              </div>
              <h3 className="mt-5 text-lg font-bold leading-tight">
                {program.title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">
                {program.desc}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-8 section-band">
        <p className="section-divider">Core values</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {aboutContent.values.map((value, index) => (
            <article
              key={value.title}
              className={`value-card rounded-[1.35rem] border border-[var(--color-border)] p-5 motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out hover:border-[var(--color-primary)] motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-[var(--shadow-md)] lg:col-span-2 ${
                aboutContent.values.length === 5 && index === 3 ? "lg:col-start-2" : ""
              }`}
              data-about-animate="card"
              data-about-delay={index * 100}
            >
              <div
                className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--primary)_12%,transparent)] text-[var(--color-primary)]"
                aria-hidden="true"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 20 20">
                  <path
                    d="m5 10.4 3.1 3.1L15 6.5"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                  />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-bold leading-tight">
                {value.title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">
                {value.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-8 section-band">
        <p className="section-divider">History timeline</p>
        <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,3rem)] leading-none tracking-[-0.04em]">
          Key milestones
        </h2>
        <div className="relative mx-auto mt-8 max-w-3xl lg:mx-0">
          <div
            aria-hidden="true"
            className="absolute bottom-2 left-[7px] top-2 w-0.5 bg-[var(--color-border)]"
          />
          <div className="grid gap-7">
            {timelineItems.map((item, index) => (
              <article
                key={`${item.date}-${item.event}`}
                className="relative pl-10"
                data-about-animate="card"
                data-about-delay={index * 100}
              >
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-1.5 z-10 h-4 w-4 rounded-full border-2 border-[var(--color-primary)] bg-[var(--card)]"
                />
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--color-primary)]">
                  {item.date}
                </p>
                <h3 className="mt-1 text-base font-semibold leading-tight">
                  {item.href ? (
                    <Link
                      className="motion-safe:transition-colors motion-safe:duration-200 hover:text-[var(--color-primary)]"
                      href={item.href}
                    >
                      {item.event}
                    </Link>
                  ) : (
                    item.event
                  )}
                </h3>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-8 section-band">
        <div className="mx-auto max-w-2xl text-center">
          <p className="section-divider mx-auto">Digital channels</p>
          <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,3rem)] leading-none tracking-[-0.04em]">
            Find JnUITS online
          </h2>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {aboutContent.socialChannels.map((channel, index) => (
            <a
              key={channel.url}
              aria-label={`${channel.platform} — opens in a new tab`}
              className="value-card flex min-h-[100px] flex-col items-center justify-center gap-2 rounded-[1.1rem] border border-[var(--color-border)] p-4 text-center motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out hover:border-[var(--color-primary)] motion-safe:hover:-translate-y-0.5"
              data-about-animate="card"
              data-about-delay={index * 100}
              href={channel.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              <span
                aria-hidden="true"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-primary)] text-[var(--color-primary-foreground)] shadow-sm"
              >
                <SocialChannelIcon platform={channel.platform} />
              </span>
              <span className="text-sm font-semibold text-[var(--foreground)]">
                {channel.platform}
              </span>
              <span className="text-xs font-medium text-[var(--muted-foreground)]">
                {channel.handle}
              </span>
            </a>
          ))}
        </div>
      </section>

      <section
        className="section-band mt-8 px-6 py-[clamp(3rem,6vw,5rem)] text-center"
        data-about-animate="card"
      >
        <div className="mx-auto max-w-2xl">
          <h2 className="font-[family-name:var(--font-heading)] text-[clamp(1.75rem,3vw,2.25rem)] leading-none tracking-[-0.04em]">
            Ready to step ahead with IT?
          </h2>
          <p className="section-copy mx-auto mt-4">
            Join our community of {aboutContent.stats.active_members} tech enthusiasts at Jagannath
            University.
          </p>
          <div className="mt-8 flex flex-col flex-wrap justify-center gap-4 sm:flex-row">
            <Link href="/members/membership-form" className="primary-button min-h-11 w-full sm:w-auto">
              Membership form
            </Link>
            <Link href="/events" className="secondary-button min-h-11 w-full sm:w-auto">
              Explore events
            </Link>
          </div>
        </div>
      </section>

      <Script id="about-page-motion" strategy="afterInteractive">
        {`
          (() => {
            const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            const animated = Array.from(document.querySelectorAll("[data-about-animate]"));
            const counters = Array.from(document.querySelectorAll("[data-about-counter]"));

            const setCountersFinal = () => {
              counters.forEach((counter) => {
                counter.textContent = counter.dataset.aboutCounterDisplay || counter.textContent;
              });
            };

            if (reducedMotion) {
              animated.forEach((element) => element.classList.add("about-in-view"));
              setCountersFinal();
              return;
            }

            document.documentElement.classList.add("about-motion-ready");

            if (!("IntersectionObserver" in window)) {
              animated.forEach((element) => element.classList.add("about-in-view"));
              setCountersFinal();
              return;
            }

            animated.forEach((element) => {
              const delay = element.getAttribute("data-about-delay");
              if (delay) {
                element.style.transitionDelay = delay + "ms";
              }
            });

            const revealObserver = new IntersectionObserver((entries, observer) => {
              entries.forEach((entry) => {
                if (entry.isIntersecting) {
                  entry.target.classList.add("about-in-view");
                  observer.unobserve(entry.target);
                }
              });
            }, { threshold: 0.18 });

            animated.forEach((element) => revealObserver.observe(element));

            const easeOutCubic = (progress) => 1 - Math.pow(1 - progress, 3);
            const animateCounter = (counter) => {
              if (counter.dataset.aboutCounterDone === "true") return;
              counter.dataset.aboutCounterDone = "true";

              const target = Number(counter.dataset.aboutCounterValue || "0");
              const suffix = counter.dataset.aboutCounterSuffix || "";
              const fallback = counter.dataset.aboutCounterDisplay || counter.textContent || "";

              if (!target) {
                counter.textContent = fallback;
                return;
              }

              counter.textContent = "0" + suffix;

              const startedAt = performance.now();
              const duration = 1200;

              const tick = (now) => {
                const progress = Math.min((now - startedAt) / duration, 1);
                const current = Math.round(target * easeOutCubic(progress));
                counter.textContent = current + suffix;

                if (progress < 1) {
                  requestAnimationFrame(tick);
                } else {
                  counter.textContent = fallback;
                }
              };

              requestAnimationFrame(tick);
            };

            const counterObserver = new IntersectionObserver((entries, observer) => {
              entries.forEach((entry) => {
                if (entry.isIntersecting) {
                  animateCounter(entry.target);
                  observer.unobserve(entry.target);
                }
              });
            }, { threshold: 0.4 });

            counters.forEach((counter) => counterObserver.observe(counter));
          })();
        `}
      </Script>
    </div>
  );
}
