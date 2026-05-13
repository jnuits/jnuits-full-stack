import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
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

function socialGlyph(platform: string) {
  const normalized = platform.toLowerCase();

  if (normalized.includes("facebook")) {
    return "f";
  }

  if (normalized.includes("linkedin")) {
    return "in";
  }

  if (normalized.includes("instagram")) {
    return "ig";
  }

  return "www";
}

export default async function AboutPage() {
  const aboutContent = await getAboutContent();
  const optimizedSrc = toCloudinaryOptimizedSrc(aboutContent.imageSrc);
  const awardParts = aboutContent.stats.major_award.split(",");
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
      label: awardParts.slice(1).join(",").trim() || "Bangladesh IT Challenge 2023",
      value: awardParts[0]?.trim() || aboutContent.stats.major_award,
    },
  ];

  return (
    <div className="shell py-12">
      <section className="glass-card overflow-hidden px-6 py-6 sm:px-8 sm:py-8">
        <div className="grid gap-8 lg:grid-cols-[55%_45%] lg:items-center">
          <div data-about-animate="hero-left">
            <span className="eyebrow">STEP AHEAD WITH IT</span>
            <h1 className="section-title mt-4">
              About Jagannath University IT Society
            </h1>
            <p className="section-copy mt-5">{aboutContent.heroDescription}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/membership-form" className="primary-button min-h-11">
                Membership status
              </Link>
              <Link href="/events" className="secondary-button min-h-11">
                Explore events
              </Link>
            </div>
          </div>

          <div
            className="relative overflow-hidden rounded-[1.8rem] border border-[var(--line)]"
            data-about-animate="hero-right"
          >
            <Image
              alt="Students participating in a JnU IT Society technology program"
              className="aspect-[4/3] h-full w-full object-cover"
              height={900}
              priority
              sizes="(min-width: 1024px) 45vw, 100vw"
              src={optimizedSrc}
              unoptimized={true}
              width={1200}
            />
            <div className="absolute bottom-5 left-5 right-5 rounded-[1.35rem] border border-[var(--line)] bg-[color-mix(in_oklab,var(--brand-deep)_82%,transparent)] p-5 text-[var(--primary-foreground)] shadow-[var(--shadow-panel)] backdrop-blur-md sm:right-auto sm:max-w-[24rem]">
              <p className="text-xs font-bold uppercase tracking-[0.22em] opacity-75">
                Institutional identity
              </p>
              <p className="mt-3 text-sm leading-7 opacity-90">
                JnUITS presents its mission, values, and history with a clear
                public profile for students, alumni, and partners.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-band mt-8" aria-label="JnUITS impact statistics">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
          {statItems.map((stat, index) => {
            const counter = parseCounter(stat.value);

            return (
              <div
                key={stat.label}
                className="text-center lg:border-r lg:border-[var(--line)] lg:px-6 lg:last:border-r-0"
                data-about-animate="card"
                data-about-delay={index * 100}
              >
                <p
                  aria-label={`${stat.value} ${stat.label}`}
                  aria-live="polite"
                  className="font-[family-name:var(--font-heading)] text-4xl font-bold leading-none text-[var(--primary)] sm:text-5xl"
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

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <article
          className="glass-card h-full border-l-4 border-l-[var(--primary)] p-6 sm:p-8"
          data-about-animate="card"
        >
          <p className="section-divider">Mission</p>
          <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[2rem] leading-[0.98] tracking-[-0.04em]">
            Why JnUITS exists
          </h2>
          <p className="mt-5 text-base leading-8 text-[var(--muted-foreground)]">
            {aboutContent.missionStatement}
          </p>
        </article>

        <article
          className="glass-card h-full border-l-4 border-l-[var(--primary)] p-6 sm:p-8"
          data-about-animate="card"
          data-about-delay="100"
        >
          <p className="section-divider">Vision</p>
          <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[2rem] leading-[0.98] tracking-[-0.04em]">
            Where we&apos;re going
          </h2>
          <p className="mt-5 text-base leading-8 text-[var(--muted-foreground)]">
            {aboutContent.vision}
          </p>
        </article>
      </section>

      <section className="mt-8 section-band">
        <div className="mx-auto max-w-2xl text-center">
          <p className="section-divider mx-auto">What we do</p>
          <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,3rem)] leading-none tracking-[-0.04em]">
            Practical programs for a stronger campus tech community
          </h2>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {aboutContent.programs.map((program, index) => (
            <article
              key={program.title}
              className="glass-card value-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-panel)]"
              data-about-animate="card"
              data-about-delay={index * 100}
            >
              <div className="text-3xl" aria-hidden="true">
                {program.icon}
              </div>
              <h3 className="mt-4 font-[family-name:var(--font-heading)] text-2xl leading-tight">
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
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {aboutContent.values.map((value, index) => (
            <article
              key={value.title}
              className="value-card rounded-[1.35rem] border border-[var(--line)] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-panel)]"
              data-about-animate="card"
              data-about-delay={index * 100}
            >
              <div className="text-2xl" aria-hidden="true">
                {value.icon || "•"}
              </div>
              <h3 className="mt-4 font-[family-name:var(--font-heading)] text-2xl leading-tight">
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
            className="absolute bottom-6 left-4 top-6 w-px bg-[var(--line)]"
          />
          <div className="grid gap-6">
            {aboutContent.timeline.map((item, index) => (
              <article
                key={`${item.date}-${item.event}`}
                className="relative pl-12"
                data-about-animate="card"
                data-about-delay={index * 100}
              >
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--card)]"
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--primary)]" />
                </span>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                  {item.date}
                </p>
                <h3 className="mt-1 font-[family-name:var(--font-heading)] text-2xl leading-tight">
                  {item.event}
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
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {aboutContent.socialChannels.map((channel, index) => (
            <a
              key={channel.url}
              aria-label={`${channel.platform} ${channel.handle} opens in a new tab`}
              className="value-card inline-flex min-h-11 items-center gap-3 rounded-[1.1rem] border border-[var(--line)] px-4 py-3 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-panel)]"
              data-about-animate="card"
              data-about-delay={index * 100}
              href={channel.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              <span
                aria-hidden="true"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--primary)_12%,transparent)] text-xs font-bold uppercase text-[var(--primary)]"
              >
                {socialGlyph(channel.platform)}
              </span>
              <span>
                <span className="block text-[var(--foreground)]">{channel.platform}</span>
                <span className="block text-xs font-medium text-[var(--muted-foreground)]">
                  {channel.handle}
                </span>
              </span>
            </a>
          ))}
        </div>
      </section>

      <section className="section-band mt-8 text-center" data-about-animate="card">
        <div className="mx-auto max-w-2xl">
          <h2 className="font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,3rem)] leading-none tracking-[-0.04em]">
            Ready to step ahead with IT?
          </h2>
          <p className="section-copy mx-auto mt-4">
            Join our community of 1000+ tech enthusiasts at Jagannath
            University.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/membership-form" className="primary-button min-h-11">
              Membership form
            </Link>
            <Link href="/events" className="secondary-button min-h-11">
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

            counters.forEach((counter) => {
              counter.textContent = "0" + (counter.dataset.aboutCounterSuffix || "");
            });

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
