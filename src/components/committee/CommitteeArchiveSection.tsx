"use client";

import { useState } from "react";
import { Archive, ChevronDown, ChevronUp } from "lucide-react";

import { ArchiveTermRow } from "@/components/committee/ArchiveTermRow";
import type { PublicCommitteeTerm } from "@/lib/committee/public";

export function CommitteeArchiveSection({
  terms,
}: {
  terms: PublicCommitteeTerm[];
}) {
  const [archiveOpen, setArchiveOpen] = useState(true);
  const executiveTerms = terms.filter(
    (term) => !term.slug.toLowerCase().includes("advisory")
  );

  const handleArchiveRowClick = (termSlug: string) => {
    window.dispatchEvent(
      new CustomEvent("committee:term-select", { detail: { termSlug } })
    );
    setArchiveOpen(false);
    window.setTimeout(() => {
      document
        .getElementById("current-committee")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  return (
    <section id="archive">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary/70">
            Archive
          </p>
          <h2 className="mt-2 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Executive committee history
          </h2>
          <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
            Quick navigation to all executive committee terms. Click any term to
            jump to its roster above.
          </p>
        </div>
        {executiveTerms.length > 0 ? (
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold text-foreground transition hover:border-primary/40 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            onClick={() => setArchiveOpen((open) => !open)}
            type="button"
          >
            {archiveOpen ? "Hide index" : "Show index"}
            {archiveOpen ? (
              <ChevronUp aria-hidden="true" size={15} />
            ) : (
              <ChevronDown aria-hidden="true" size={15} />
            )}
          </button>
        ) : null}
      </div>

      {executiveTerms.length > 0 && archiveOpen ? (
        <div className="mt-10 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="divide-y divide-border">
            {executiveTerms.map((term, index) => (
              <ArchiveTermRow
                index={index}
                key={term.id}
                onSelect={handleArchiveRowClick}
                term={term}
              />
            ))}
          </div>
        </div>
      ) : null}

      {executiveTerms.length > 0 && !archiveOpen ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border/60 bg-muted/20 px-6 py-5 text-sm text-muted-foreground">
          Archive index collapsed. Use the executive committee tabs above to
          continue browsing terms.
        </div>
      ) : null}

      {executiveTerms.length === 0 ? (
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
      ) : null}
    </section>
  );
}
