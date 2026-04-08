import Link from "next/link";
import { implementationPhases } from "@/lib/site";

export default function HomePage() {
  return (
    <div className="shell py-12">
      <section className="glass-card overflow-hidden px-6 py-10 sm:px-8 sm:py-12">
        <span className="eyebrow">Execution Program</span>
        <h1 className="section-title mt-4">
          JnUITS is moving from a split CMS stack to one secure full-stack app.
        </h1>
        <p className="section-copy mt-4">
          This bootstrap replaces an empty repo with the first working application
          shell, Supabase integration layer, certificate import tooling, and
          phase-by-phase execution artifacts. The public site stays approachable,
          while moderator and admin surfaces stay task-focused.
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
          <Link href="/admin" className="secondary-button">
            Open admin workspace
          </Link>
        </div>
      </section>

      <section className="mt-8 route-grid">
        {implementationPhases.map((phase) => (
          <article key={phase} className="route-tile">
            <h3>{phase.split(":")[0]}</h3>
            <p>{phase.split(":").slice(1).join(":").trim()}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
