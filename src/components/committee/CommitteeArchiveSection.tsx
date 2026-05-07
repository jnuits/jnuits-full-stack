import { Archive } from "lucide-react";

import { ArchiveTermRow } from "@/components/committee/ArchiveTermRow";
import type { PublicCommitteeTerm } from "@/lib/committee/public";

export function CommitteeArchiveSection({
  terms,
}: {
  terms: PublicCommitteeTerm[];
}) {
  const executiveTerms = terms.filter(
    (term) => !term.slug.toLowerCase().includes("advisory")
  );

  return (
    <section id="archive">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary/70">
          Archive
        </p>
        <h2 className="mt-2 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Executive committee history
        </h2>
        <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
          Historical executive terms are preserved as structured public
          records. Estimated dates are clearly marked until official records
          are verified.
        </p>
      </div>

      {executiveTerms.length > 0 ? (
        <div className="mt-10 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="divide-y divide-border">
            {executiveTerms.map((term, index) => (
              <ArchiveTermRow index={index} key={term.id} term={term} />
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-10 rounded-3xl border border-dashed border-border/60 bg-muted/20 px-8 py-16 text-center">
          <Archive
            aria-hidden="true"
            className="mx-auto mb-4 text-primary/60"
            size={42}
            strokeWidth={1.5}
          />
          <h3 className="text-xl font-bold text-foreground">
            No public committee history yet
          </h3>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
            Public executive committee terms will appear here after they are
            verified and published.
          </p>
        </div>
      )}
    </section>
  );
}
