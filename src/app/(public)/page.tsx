import Link from "next/link";
import Image from "next/image";
import {
  formatDisplayDate,
  formatDateRange,
  getPublishedBlogs,
  getPublishedEvents,
  getPublishedNotices,
} from "@/lib/content/public-content";
import { implementationPhases } from "@/lib/site";

export default async function HomePage() {
  const [publicBlogs, publicEvents, publicNotices] = await Promise.all([
    getPublishedBlogs(),
    getPublishedEvents(),
    getPublishedNotices(),
  ]);
  const featuredEvent = publicEvents[0];
  const featuredBlog = publicBlogs[0];
  const featuredNotice = publicNotices[0];

  return (
    <div className="pb-16">
      <section className="hero-plane">
        <div className="shell hero-grid">
          <div>
            <span className="eyebrow">Unified public site, portal, and operator stack</span>
            <p className="hero-brand mt-6">JnUITS digital rebuild</p>
            <h1 className="hero-title mt-4">
              One institutional home for the website, certificates, member identity,
              and internal operations.
            </h1>
            <p className="section-copy mt-6">
              The project is no longer an empty shell, but it is still in active
              delivery. Secure foundations, certificates, and membership transition
              flows are already in place; content depth and richer operational tools
              are what come next.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/certificates" className="primary-button">
                Verify certificates
              </Link>
              <Link href="/membership-form" className="secondary-button">
                Apply for membership
              </Link>
              <Link href="/portal" className="secondary-button">
                Open member portal
              </Link>
              <Link href="/admin" className="ghost-button">
                Operator workspace
              </Link>
            </div>
          </div>

          <div className="hero-stage">
            <article className="hero-stage-card">
              <div className="absolute inset-0 opacity-42">
                <Image
                  alt="JnUITS public program gathering"
                  className="object-cover"
                  fill
                  priority
                  sizes="(min-width: 980px) 42vw, 100vw"
                  src="/images/home-group.jpg"
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
                  Real public content is now shaping the route system, not just the shell.
                </p>
                <p className="mt-4 max-w-xl text-sm leading-7 text-white/84">
                  Legacy imagery and route-level content structure are now back in
                  play so the site can feel institutional while the database-backed
                  import path is still being built.
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="shell mt-8">
        <div className="section-band">
          <p className="section-divider">Current delivery readout</p>
          <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div>
              <h2 className="font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,3rem)] leading-[0.96] tracking-[-0.04em]">
                What is already live, and what is still in flight.
              </h2>
              <ul className="detail-list mt-6">
                <li>
                  <strong>Secure core completed</strong>
                  Supabase SSR auth, route protection, RBAC, certificate schema, and the
                  first migration baseline are already running.
                </li>
                <li>
                  <strong>User-facing transition started</strong>
                  Membership application intake, claim flows, password recovery, and
                  certificate verification are available now.
                </li>
                <li>
                  <strong>Design system established</strong>
                  The interface is moving from placeholder cards to a branded visual
                  language with a proper light/dark theme that the later content and
                  admin phases can reuse.
                </li>
              </ul>
            </div>

            <div className="phase-stack">
              {implementationPhases.map((phase) => (
                <article key={phase.id} className="phase-row">
                  <div className="phase-row__meta">
                    <h3 className="font-[family-name:var(--font-heading)] text-xl font-semibold">
                      {phase.id}
                    </h3>
                    <span className="phase-row__status">{phase.status}</span>
                  </div>
                  <p className="text-sm leading-7 text-[var(--muted)]">{phase.summary}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="shell mt-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
          <article className="glass-card overflow-hidden px-6 py-6 sm:px-8">
            <p className="section-divider">Phase 04 content lane</p>
            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.96fr)_minmax(280px,0.64fr)]">
              <div>
                <h2 className="font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,3rem)] leading-[0.96] tracking-[-0.04em]">
                  Public content is no longer a set of migration placeholders.
                </h2>
                <p className="section-copy mt-4">
                  About, blogs, events, gallery, notices, and developer credits
                  are now being rebuilt as structured public surfaces. The next
                  step is swapping this preview layer into Supabase-backed
                  collections and moderated media delivery.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href="/about" className="primary-button">
                    View the about route
                  </Link>
                  <Link href="/blogs" className="secondary-button">
                    Read editorial previews
                  </Link>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="route-tile">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--brand-blue)]">
                    Featured event
                  </p>
                  <h3 className="mt-3">{featuredEvent.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                    {featuredEvent.summary}
                  </p>
                  <p className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                    {formatDateRange(featuredEvent.start, featuredEvent.end)}
                  </p>
                </div>
                <div className="route-tile">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--brand-blue)]">
                    Featured article
                  </p>
                  <h3 className="mt-3">{featuredBlog.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                    {featuredBlog.summary}
                  </p>
                  <p className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                    {formatDisplayDate(featuredBlog.publishedAt)}
                  </p>
                </div>
              </div>
            </div>
          </article>

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
              <Link href="/gallery" className="ghost-button">
                View media archive
              </Link>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
