import Link from "next/link";
import Image from "next/image";
import { brandProfile } from "@/lib/branding";
import {
  formatDisplayDate,
  formatDateRange,
  getPublishedEvents,
  getPublishedNotices,
} from "@/lib/content/public-content";
import { getContactContent, getHomePageContent } from "@/lib/content/site-singletons";

export default async function HomePage() {
  const [homeContent, publicNotices, publicEvents, contactContent] = await Promise.all([
    getHomePageContent(),
    getPublishedNotices(),
    getPublishedEvents(),
    getContactContent(),
  ]);
  const featuredNotice = publicNotices[0];
  const featuredEvent = publicEvents[0];
  const heroSlide = homeContent.heroSlides[0];
  const highlightedActivities = homeContent.recentActivities.slice(0, 3);
  const highlightedAchievements = homeContent.achievements.slice(0, 3);

  return (
    <div className="pb-16">
      <section className="hero-plane">
        <div className="shell hero-grid">
          <div>
            <span className="eyebrow">{homeContent.eyebrow}</span>
            <p className="hero-brand mt-6">{brandProfile.slogan}</p>
            {heroSlide?.title ? (
              <p className="mt-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-blue)]">
                {heroSlide.title}
              </p>
            ) : null}
            <h1 className="hero-title mt-4">{homeContent.title}</h1>
            <p className="section-copy mt-6">{homeContent.summary}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/events" className="primary-button">
                Explore events
              </Link>
              <Link href="/membership-form" className="secondary-button">
                Apply for membership
              </Link>
              <Link href="/certificates" className="secondary-button">
                Verify certificates
              </Link>
              <Link href="/contact" className="ghost-button">
                Contact JnUITS
              </Link>
            </div>
          </div>

          <div className="hero-stage">
            <article className="hero-stage-card">
              <div className="absolute inset-0 opacity-42">
                <Image
                  alt={heroSlide?.title || "JnUITS public program gathering"}
                  className="object-cover"
                  fill
                  priority
                  sizes="(min-width: 980px) 42vw, 100vw"
                  src={homeContent.heroImageSrc}
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-[rgba(17,31,56,0.78)] via-[rgba(17,31,56,0.24)] to-transparent" />
              <div className="hero-logo-wrap">
                <Image
                  alt="JnUITS official logo"
                  className="h-full w-full object-contain"
                  fill
                  priority
                  sizes="(min-width: 980px) 12rem, 8rem"
                  src="/logo.svg"
                />
              </div>
              <div className="hero-stage-copy">
                <p className="hero-stage-title text-white">
                  {homeContent.aboutSection.title}
                </p>
                <p className="mt-4 max-w-xl text-sm leading-7 text-white/84">
                  {heroSlide?.description || homeContent.aboutSection.description}
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="shell mt-8">
        <div className="section-band">
          <p className="section-divider">Institutional profile</p>
          <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div>
              <h2 className="font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,3rem)] leading-[0.96] tracking-[-0.04em]">
                A university technology club with programs, certificates, and community work.
              </h2>
              <ul className="detail-list mt-6">
                <li>
                  <strong>Official identity</strong>
                  {brandProfile.fullName} ({brandProfile.shortName}) is a{" "}
                  {brandProfile.type.toLowerCase()} of {brandProfile.university}.
                </li>
                <li>
                  <strong>Founded in 2015</strong>
                  {brandProfile.foundedLabel}
                </li>
                <li>
                  <strong>Institutional address</strong>
                  {brandProfile.address}
                </li>
              </ul>
            </div>

            <div className="route-grid">
              <article className="route-tile">
                <p className="section-divider">Slogan</p>
                <h3 className="mt-4">{brandProfile.slogan}</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                  The society centers practical learning and forward movement in IT.
                </p>
              </article>
              <article className="route-tile">
                <p className="section-divider">Located in</p>
                <h3 className="mt-4">{contactContent.location}</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                  {contactContent.address}
                </p>
              </article>
              <article className="route-tile">
                <p className="section-divider">Contact</p>
                <h3 className="mt-4">{contactContent.phone}</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                  {contactContent.email}
                </p>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="shell mt-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
          <article className="glass-card overflow-hidden px-6 py-6 sm:px-8">
            <p className="section-divider">Society focus</p>
            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.96fr)_minmax(280px,0.64fr)]">
              <div>
                <h2 className="font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,3rem)] leading-[0.96] tracking-[-0.04em]">
                  {homeContent.aboutSection.title}
                </h2>
                <p className="section-copy mt-4">
                  {homeContent.aboutSection.description}
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href={homeContent.aboutSection.buttonLink} className="primary-button">
                    {homeContent.aboutSection.buttonText}
                  </Link>
                  <Link href="/blogs" className="secondary-button">
                    Read editorial previews
                  </Link>
                </div>
              </div>

              <div className="grid gap-4">
                {highlightedActivities.map((activity) => (
                  <div key={activity.title} className="route-tile">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--brand-blue)]">
                      {homeContent.recentActivitiesTitle}
                    </p>
                    <h3 className="mt-3">{activity.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                      {activity.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article className="section-band">
            <p className="section-divider">Featured event</p>
            {featuredEvent ? (
              <>
                <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[2rem] leading-[0.98] tracking-[-0.04em]">
                  {featuredEvent.title}
                </h2>
                <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
                  {featuredEvent.summary}
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  <span className="detail-chip">{featuredEvent.focus}</span>
                  <span className="detail-chip">{featuredEvent.status}</span>
                  <span className="detail-chip">{featuredEvent.location}</span>
                </div>
                <p className="mt-5 text-sm leading-7 text-[var(--muted)]">
                  {formatDateRange(featuredEvent.start, featuredEvent.end)}
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href="/events" className="secondary-button">
                    View all events
                  </Link>
                  <Link href="/membership-form" className="ghost-button">
                    Join the community
                  </Link>
                </div>
              </>
            ) : (
              <>
                <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[2rem] leading-[0.98] tracking-[-0.04em]">
                  Latest notice
                </h2>
                <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
                  {featuredNotice.summary}
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  <span className="detail-chip">{featuredNotice.category}</span>
                  <span className="detail-chip">
                    {formatDisplayDate(featuredNotice.publishedAt)}
                  </span>
                  <span className="detail-chip">{featuredNotice.delivery}</span>
                </div>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href="/notices" className="secondary-button">
                    Open notices
                  </Link>
                  <Link href="/gallery" className="ghost-button">
                    View media archive
                  </Link>
                </div>
              </>
            )}
          </article>
        </div>
      </section>

      <section className="shell mt-8">
        <div className="section-band">
          <p className="section-divider">{homeContent.achievementsTitle}</p>
          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="grid gap-4 md:grid-cols-3">
              {highlightedAchievements.map((achievement) => (
                <article key={achievement.title} className="route-tile">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--brand-blue)]">
                    {achievement.icon}
                  </p>
                  <h3 className="mt-3">{achievement.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                    {achievement.description}
                  </p>
                </article>
              ))}
            </div>
            <div className="relative min-h-[260px] overflow-hidden rounded-[1.6rem] border border-[var(--line)]">
              <Image
                alt={homeContent.achievementsTitle}
                className="object-cover"
                fill
                sizes="(min-width: 1024px) 24vw, 100vw"
                src={homeContent.achievementsImageSrc}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="shell mt-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)]">
          <article className="section-band">
            <p className="section-divider">Latest notice</p>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[2rem] leading-[0.98] tracking-[-0.04em]">
              {featuredNotice.title}
            </h2>
            <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
              {featuredNotice.summary}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="detail-chip">{featuredNotice.category}</span>
              <span className="detail-chip">
                {formatDisplayDate(featuredNotice.publishedAt)}
              </span>
              <span className="detail-chip">{featuredNotice.delivery}</span>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/notices" className="secondary-button">
                Open notices
              </Link>
              <Link href="/contact" className="ghost-button">
                Get in touch
              </Link>
            </div>
          </article>

          <article className="section-band">
            <p className="section-divider">Connect with JnUITS</p>
            <div className="mt-6 route-grid">
              {contactContent.socialLinks.map((item) => (
                <article key={item.href} className="route-tile">
                  <h3>{item.label}</h3>
                  <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                    Follow the society on {item.label} for public updates and announcements.
                  </p>
                  <div className="mt-4">
                    <Link href={item.href} target="_blank" className="queue-link">
                      Visit {item.label}
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
