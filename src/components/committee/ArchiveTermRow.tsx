import { ArrowRight, CalendarDays } from "lucide-react";

import type { PublicCommitteeTerm } from "@/lib/committee/public";
import { formatCommitteeDate } from "@/lib/committee-utils";

function cn(...classes: Array<false | null | string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function ArchiveTermRow({
  index,
  onSelect,
  term,
}: {
  index: number;
  onSelect: (termSlug: string) => void;
  term: PublicCommitteeTerm;
}) {
  const termNumber = term.termNumber || index + 1;
  const dateIsEstimated = term.dateConfidence !== "verified";
  const seats = term.assignments.length;

  return (
    <article className="group flex items-center gap-4 px-4 py-5 transition-colors hover:bg-muted/30 sm:gap-5 sm:px-6">
      <div
        className={cn(
          "flex size-11 flex-shrink-0 items-center justify-center rounded-xl text-base font-black",
          term.isCurrent
            ? "bg-primary text-primary-foreground shadow-sm"
            : term.status === "archived"
              ? "bg-muted text-muted-foreground"
              : "bg-muted/60 text-muted-foreground"
        )}
      >
        {termNumber}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">{term.title}</h3>
          {term.isCurrent ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
              <span
                aria-hidden="true"
                className="size-1.5 animate-pulse rounded-full bg-emerald-500"
              />
              Current
            </span>
          ) : null}
          {dateIsEstimated && !term.isCurrent ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/60 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:border-amber-700/40 dark:text-amber-400">
              ~ Estimated dates
            </span>
          ) : null}
        </div>

        <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays aria-hidden="true" size={11} />
          {formatCommitteeDate(term.startsOn)} - {formatCommitteeDate(term.endsOn)}
        </p>
        {!term.isCurrent && seats > 0 ? (
          <p className="mt-0.5 hidden text-xs text-muted-foreground/60 sm:block">
            {seats} seats archived
          </p>
        ) : null}
      </div>

      <button
        className={cn(
          "inline-flex min-h-11 flex-shrink-0 items-center justify-center rounded-full px-3 text-xs font-semibold opacity-80 transition hover:opacity-100 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:px-4",
          term.isCurrent
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "border border-border bg-card text-foreground hover:border-primary/40 hover:text-primary"
        )}
        onClick={() => onSelect(term.slug)}
        type="button"
      >
        <span className="hidden sm:inline">Jump to roster</span>
        <span className="sm:hidden">Jump</span>
        <ArrowRight aria-hidden="true" className="ml-1.5" size={14} />
      </button>
    </article>
  );
}
