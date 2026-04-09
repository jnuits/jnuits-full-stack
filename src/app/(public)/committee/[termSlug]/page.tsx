import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicCommitteeTermByIdentifier } from "@/lib/committee/public";

export default async function CommitteeTermPage({
  params,
}: {
  params: Promise<{ termSlug: string }>;
}) {
  const { termSlug } = await params;
  const termData = await getPublicCommitteeTermByIdentifier(termSlug);

  if (!termData) {
    notFound();
  }

  return (
    <div className="shell py-12">
      <section className="glass-card overflow-hidden px-6 py-6 sm:px-8 sm:py-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr] lg:items-start">
          <div>
            <span className="eyebrow">Committee term</span>
            <h1 className="section-title mt-4">{termData.term.title}</h1>
            <p className="section-copy mt-5">
              {termData.term.summary ||
                "Public roster for this committee term of Jagannath University IT Society."}
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-sm text-[var(--muted)]">
              <span className="detail-chip">Starts {termData.term.starts_on}</span>
              <span className="detail-chip">
                Ends {termData.term.ends_on || "Open or not yet set"}
              </span>
              <span className="detail-chip">{termData.term.status}</span>
            </div>
            <div className="mt-8">
              <Link className="secondary-button" href="/committee">
                Back to committee archive
              </Link>
            </div>
          </div>

          <article className="section-band">
            <p className="section-divider">Roster summary</p>
            <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
              {termData.assignments.length} published assignment
              {termData.assignments.length === 1 ? "" : "s"} are listed for this
              term.
            </p>
          </article>
        </div>
      </section>

      <section className="mt-8 section-band">
        <p className="section-divider">Committee members</p>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {termData.assignments.length === 0 ? (
            <div className="empty-state lg:col-span-2">
              No public assignments are currently published for this term.
            </div>
          ) : (
            termData.assignments.map((assignment) => (
              <article key={assignment.id} className="route-tile">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-[family-name:var(--font-heading)] text-[1.45rem] leading-[1.02] tracking-[-0.04em]">
                    {assignment.displayName}
                  </h2>
                  <span className="status-pill">{assignment.roleTitle}</span>
                </div>
                {assignment.subtitle ? (
                  <p className="mt-2 text-sm font-semibold text-[var(--brand-blue)]">
                    {assignment.subtitle}
                  </p>
                ) : null}
                {assignment.bio ? (
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                    {assignment.bio}
                  </p>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  {assignment.jnuitsId ? (
                    <span className="detail-chip">{assignment.jnuitsId}</span>
                  ) : null}
                  {assignment.startsOn ? (
                    <span className="detail-chip">{assignment.startsOn}</span>
                  ) : null}
                  {assignment.endsOn ? (
                    <span className="detail-chip">{assignment.endsOn}</span>
                  ) : null}
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
