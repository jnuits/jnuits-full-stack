import { getPublicCommitteeSnapshot } from "@/lib/committee/public";

export default async function CommitteePage() {
  const snapshot = await getPublicCommitteeSnapshot();

  if (!snapshot) {
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
        <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
          <div>
            <span className="eyebrow">Committee directory</span>
            <h1 className="section-title mt-4">{snapshot.term.title}</h1>
            <p className="section-copy mt-5">
              {snapshot.term.summary ||
                "This public roster is now served from normalized committee term and assignment tables."}
            </p>
          </div>

          <div className="section-band">
            <p className="section-divider">Tenure window</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="route-tile">
                <h3>Starts</h3>
                <p>{snapshot.term.starts_on}</p>
              </div>
              <div className="route-tile">
                <h3>Ends</h3>
                <p>{snapshot.term.ends_on || "Open or not yet set"}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 section-band">
        <p className="section-divider">Public roster</p>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {snapshot.assignments.length === 0 ? (
            <div className="empty-state lg:col-span-2">
              This term exists, but no public assignments are attached yet.
            </div>
          ) : (
            snapshot.assignments.map((assignment) => (
              <article key={assignment.id} className="route-tile">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-[family-name:var(--font-heading)] text-[1.5rem] leading-[1.02] tracking-[-0.04em]">
                    {assignment.displayName}
                  </h2>
                  <span className="status-pill">{assignment.roleTitle}</span>
                </div>
                <p className="mt-3 text-sm font-semibold text-[var(--brand-blue)]">
                  {assignment.subtitle || assignment.organization || "Committee member"}
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
    </div>
  );
}
