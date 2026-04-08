import { getPublicCommitteeDirectory } from "@/lib/committee/public";

export default async function CommitteePage() {
  const directory = await getPublicCommitteeDirectory();

  if (!directory.length) {
    return (
      <div className="shell py-12">
        <div className="glass-card px-6 py-8 sm:px-8 sm:py-10">
          <span className="eyebrow">Committee history</span>
          <h1 className="section-title mt-4">
            Committee terms now have a normalized data model, but no public term
            has been published yet.
          </h1>
          <p className="section-copy mt-4">
            The public committee route now reads from real term and assignment
            tables. Once an operator marks a term public, the roster will appear
            here without depending on hardcoded route copy.
          </p>
          <ul className="clean-list mt-8">
            <li>Terms and assignments are now tracked separately.</li>
            <li>Public visibility is explicit instead of implied.</li>
            <li>Tenure history can now grow without redesigning the route.</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="shell py-12">
      <section className="glass-card overflow-hidden px-6 py-6 sm:px-8 sm:py-8">
        <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
          <div>
            <span className="eyebrow">Committee directory</span>
            <h1 className="section-title mt-4">
              Advisory and executive rosters now live on the new platform
            </h1>
            <p className="section-copy mt-5">
              This route now reads directly from normalized committee terms and
              assignments imported from the previous site, so old committee data
              can survive future redesigns and rollover operations.
            </p>
          </div>

          <div className="section-band">
            <p className="section-divider">Imported terms</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {directory.map(({ assignments, term }) => (
                <div key={term.id} className="route-tile">
                  <h2>{term.title}</h2>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {term.starts_on}
                    {term.ends_on ? ` to ${term.ends_on}` : " onward"}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                    {assignments.length} public assignment
                    {assignments.length === 1 ? "" : "s"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-8">
        {directory.map(({ assignments, term }) => (
          <section key={term.id} className="section-band">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <span className="eyebrow">{term.status}</span>
                <h2 className="section-title mt-4">{term.title}</h2>
                <p className="section-copy mt-4">
                  {term.summary ||
                    "This roster is now served from the new committee model."}
                </p>
              </div>
              <div className="grid gap-2 text-sm text-[var(--muted)]">
                <span className="detail-chip">Starts {term.starts_on}</span>
                <span className="detail-chip">
                  Ends {term.ends_on || "Open or not yet set"}
                </span>
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {assignments.length === 0 ? (
                <div className="empty-state lg:col-span-2">
                  This term exists, but no public assignments are attached yet.
                </div>
              ) : (
                assignments.map((assignment) => (
                  <article key={assignment.id} className="route-tile">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-[family-name:var(--font-heading)] text-[1.5rem] leading-[1.02] tracking-[-0.04em]">
                        {assignment.displayName}
                      </h3>
                      <span className="status-pill">{assignment.roleTitle}</span>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-[var(--brand-blue)]">
                      {assignment.subtitle ||
                        assignment.organization ||
                        "Committee member"}
                    </p>
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
        ))}
      </div>
    </div>
  );
}
