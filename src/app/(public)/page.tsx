import Link from "next/link";
import Image from "next/image";
import { implementationPhases } from "@/lib/site";

export default function HomePage() {
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
              <div className="hero-logo-wrap">
                <Image
                  alt="JnUITS official logo"
                  className="h-full w-full object-contain"
                  fill
                  priority
                  src="/logo.svg"
                />
              </div>
              <div className="hero-stage-copy">
                <p className="hero-stage-title">Built around the official mark, not placeholder styling.</p>
                <p className="section-copy mt-4">
                  The public shell now uses a cleaner brand system with indigo,
                  brass, and crisp neutral surfaces so later phases inherit a real
                  interface foundation instead of a scaffold.
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
    </div>
  );
}
