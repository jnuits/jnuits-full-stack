"use client";

import Link from "next/link";
import {
  Archive,
  ArrowUpRight,
  CalendarDays,
  Users,
  Vote,
} from "lucide-react";
import {
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { ExecutiveMemberCard } from "@/components/committee/ExecutiveMemberCard";
import type {
  PublicCommitteeAssignment,
  PublicCommitteeTerm,
} from "@/lib/committee/public-contracts";
import {
  buildCommitteeRosterRows,
  formatCommitteeDate,
  formatCommitteeDateRange,
  groupCommitteeAssignmentsByPosition,
  ordinalSuffix,
} from "@/lib/committee-utils";

function cn(...classes: Array<false | null | string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function CommitteeTermSwitcher({
  assignmentsByTerm,
  defaultTermSlug,
  terms,
}: {
  assignmentsByTerm: Record<string, PublicCommitteeAssignment[]>;
  defaultTermSlug: string;
  terms: PublicCommitteeTerm[];
}) {
  const fallbackSlug = terms[0]?.slug || defaultTermSlug;
  const [activeTermSlug, setActiveTermSlug] = useState(
    defaultTermSlug || fallbackSlug
  );
  const activeTabRef = useRef<HTMLButtonElement | null>(null);
  const pillRowRef = useRef<HTMLDivElement | null>(null);
  const [canScrollTerms, setCanScrollTerms] = useState(false);

  const activeTerm =
    terms.find((term) => term.slug === activeTermSlug) || terms[0] || null;
  const assignments = activeTerm ? assignmentsByTerm[activeTerm.slug] || [] : [];

  const handleTablistKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!activeTerm) return;
    const currentIndex = terms.findIndex((term) => term.slug === activeTerm.slug);
    if (currentIndex === -1) return;

    let nextIndex = currentIndex;
    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % terms.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + terms.length) % terms.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = terms.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const nextTerm = terms[nextIndex];
    if (nextTerm) {
      setActiveTermSlug(nextTerm.slug);
    }
  };

  useEffect(() => {
    const pillRow = pillRowRef.current;

    if (!pillRow) {
      return;
    }

    const updateOverflow = () =>
      setCanScrollTerms(pillRow.scrollWidth > pillRow.clientWidth + 1);

    updateOverflow();
    window.addEventListener("resize", updateOverflow);

    return () => window.removeEventListener("resize", updateOverflow);
  }, [terms]);

  useEffect(() => {
    const handleTermSelect = (event: Event) => {
      const detail = (event as CustomEvent<{ termSlug?: string }>).detail;
      const nextSlug = detail?.termSlug;

      if (nextSlug && terms.some((term) => term.slug === nextSlug)) {
        setActiveTermSlug(nextSlug);
      }
    };

    window.addEventListener("committee:term-select", handleTermSelect);

    return () =>
      window.removeEventListener("committee:term-select", handleTermSelect);
  }, [terms]);

  useEffect(() => {
    activeTabRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [activeTermSlug]);

  if (!activeTerm) {
    return (
      <section id="current-committee">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary dark:text-primary">
          Executive Committee
        </p>
        <h2 className="mt-2 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          No public executive terms
        </h2>
        <HistoricalEmptyState title="Committee terms have not been published yet." />
      </section>
    );
  }

  return (
    <section id="current-committee" className="scroll-mt-24">
      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary dark:text-primary">
          Executive Committee
        </p>

        <div className="relative -mb-1 mt-5">
          <div
            aria-label="Committee terms"
            className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            onKeyDown={handleTablistKeyDown}
            ref={pillRowRef}
            role="tablist"
          >
            <div className="flex w-max mx-auto gap-2">
              {terms.map((term) => {
                const isActive = term.slug === activeTerm.slug;
                const termNumber = term.termNumber || terms.length;

                return (
                  <button
                    aria-controls={`term-panel-${term.slug}`}
                    aria-selected={isActive}
                    className={cn(
                      "inline-flex min-h-11 flex-shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "border border-border bg-muted/60 text-muted-foreground hover:border-border/80 hover:bg-muted hover:text-foreground"
                    )}
                    id={`term-tab-${term.slug}`}
                    key={term.slug}
                    onClick={() => setActiveTermSlug(term.slug)}
                    ref={isActive ? activeTabRef : null}
                    role="tab"
                    tabIndex={isActive ? 0 : -1}
                    type="button"
                  >
                    <span className="font-black">
                      {termNumber}
                      {ordinalSuffix(termNumber)}
                    </span>
                    {term.isCurrent ? (
                      <span
                        aria-hidden="true"
                        className={cn(
                          "size-1.5 rounded-full bg-emerald-400",
                          isActive && "animate-pulse"
                        )}
                      />
                    ) : null}
                    {term.dateConfidence !== "verified" && !term.isCurrent ? (
                      <span className="text-[9px] font-bold text-amber-500">
                        <span aria-hidden="true">~</span>
                        <span className="sr-only"> (estimated dates)</span>
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
          {canScrollTerms ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-card to-transparent"
            />
          ) : null}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {activeTerm.title}
            </h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <MetaChip icon={<CalendarDays aria-hidden="true" size={11} />}>
                {formatCommitteeDateRange(activeTerm.startsOn, activeTerm.endsOn)}
              </MetaChip>
              {activeTerm.electionDate ? (
                <MetaChip icon={<Vote aria-hidden="true" size={11} />}>
                  Election {formatCommitteeDate(activeTerm.electionDate)}
                </MetaChip>
              ) : null}
              <MetaChip icon={<Users aria-hidden="true" size={11} />}>
                {assignments.length}/{activeTerm.targetExecutiveSlots} seats
              </MetaChip>
              {activeTerm.dateConfidence !== "verified" ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/60 px-2.5 py-0.5 text-[10px] font-medium text-amber-600 dark:border-amber-700/40 dark:text-amber-400">
                  <span aria-hidden="true">~</span> estimated dates
                </span>
              ) : null}
            </div>
          </div>

          <Link
            className="inline-flex min-h-11 flex-shrink-0 items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            href={`/committee/${activeTerm.slug}`}
          >
            View term details
            <ArrowUpRight aria-hidden="true" size={13} />
          </Link>
        </div>
      </div>

      <div
        aria-labelledby={`term-tab-${activeTerm.slug}`}
        className="motion-safe:animate-[jnuits-fade-rise_260ms_var(--motion-ease)_both]"
        id={`term-panel-${activeTerm.slug}`}
        key={activeTerm.slug}
        role="tabpanel"
      >
        {assignments.length === 0 ? (
          <TermEmptyState term={activeTerm} />
        ) : (
          <TermRosterGrid
            assignments={assignments}
            isCurrent={activeTerm.isCurrent}
            termTitle={activeTerm.title}
          />
        )}
      </div>
    </section>
  );
}

function MetaChip({
  children,
  icon,
}: {
  children: ReactNode;
  icon: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
      {icon}
      {children}
    </span>
  );
}

function TermEmptyState({ term }: { term: PublicCommitteeTerm }) {
  if (term.isCurrent) {
    return (
      <div className="mt-10 rounded-3xl border border-dashed border-border/60 bg-gradient-to-b from-muted/30 to-muted/10 px-8 py-20 text-center">
        <PodiumSeal />
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary dark:text-primary">
          Roster Pending
        </p>
        <h3 className="mx-auto max-w-2xl text-2xl font-bold text-foreground">
          The {term.title} roster will be published soon
        </h3>
        <p className="mx-auto mt-3 max-w-lg text-base leading-relaxed text-muted-foreground">
          {term.electionDate
            ? `Results were announced on ${formatCommitteeDate(term.electionDate)}. The roster will appear here once it's published.`
            : "The roster will appear here once it's published."}
        </p>
        <div className="mt-8 flex justify-center">
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-card px-5 text-sm font-semibold text-foreground transition hover:border-primary/40 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            href={`/committee/${term.slug}`}
          >
            View term details
          </Link>
        </div>
        <p className="mt-6 text-xs text-muted-foreground/60">
          {formatCommitteeDateRange(term.startsOn, term.endsOn, {
            estimated: term.dateConfidence === "estimated",
          })}
          {" · "}
          {term.targetExecutiveSlots} configured executive seats
        </p>
      </div>
    );
  }

  return (
    <HistoricalEmptyState
      title={`Roster records for the ${term.title} have not been imported yet.`}
    />
  );
}

function HistoricalEmptyState({ title }: { title: string }) {
  return (
    <div className="mt-8 rounded-2xl border border-dashed border-border/50 bg-muted/20 px-8 py-12 text-center">
      <Archive
        aria-hidden="true"
        className="mx-auto mb-4 text-muted-foreground/30"
        size={32}
      />
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground/60">
        Historical rosters will be added as records are verified.
      </p>
    </div>
  );
}

function TermRosterGrid({
  assignments,
  isCurrent,
  termTitle,
}: {
  assignments: PublicCommitteeAssignment[];
  isCurrent: boolean;
  termTitle: string;
}) {
  const groups = useMemo(
    () => groupCommitteeAssignmentsByPosition(assignments),
    [assignments]
  );
  const rows = useMemo(() => buildCommitteeRosterRows(groups), [groups]);

  return (
    <div className="mt-8 space-y-8 sm:space-y-10">
      {rows.map((row) => (
        <ul
          className={cn(
            "flex flex-wrap justify-center gap-4 sm:gap-6",
            row.isFeatured ? "my-2" : ""
          )}
          key={row.key}
          role="list"
        >
          {row.assignments.map((assignment, index) => (
            <li
              className={cn(
                "flex motion-safe:animate-[jnuits-fade-rise_300ms_var(--motion-ease)_both]",
                row.isFeatured
                  ? "w-full max-w-md sm:max-w-lg justify-center mx-auto"
                  : "w-full sm:w-[calc((100%_-_1.5rem)/2)] lg:w-[calc((100%_-_3rem)/3)] max-w-sm"
              )}
              key={assignment.id}
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <ExecutiveMemberCard
                assignment={assignment}
                featured={row.isFeatured}
                isCurrent={isCurrent}
                termTitle={termTitle}
              />
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}

function PodiumSeal() {
  const angles = [0, 60, 120, 180, 240, 300];

  return (
    <svg
      aria-hidden="true"
      className="mx-auto mb-6 text-primary"
      fill="none"
      height="80"
      viewBox="0 0 80 80"
      width="80"
    >
      <circle
        cx="40"
        cy="40"
        fill="currentColor"
        fillOpacity="0.04"
        r="38"
        stroke="currentColor"
        strokeOpacity="0.15"
      />
      <circle
        cx="40"
        cy="40"
        fill="currentColor"
        fillOpacity="0.04"
        r="28"
        stroke="currentColor"
        strokeOpacity="0.2"
      />
      <circle
        cx="40"
        cy="40"
        fill="currentColor"
        fillOpacity="0.08"
        r="18"
        stroke="currentColor"
        strokeOpacity="0.3"
        strokeWidth="1.5"
      />
      {angles.map((degree) => {
        const radians = (degree * Math.PI) / 180;
        return (
          <line
            key={degree}
            stroke="currentColor"
            strokeLinecap="round"
            strokeOpacity="0.5"
            strokeWidth="2"
            x1="40"
            x2={40 + 10 * Math.cos(radians)}
            y1="40"
            y2={40 + 10 * Math.sin(radians)}
          />
        );
      })}
      <path
        d="M30 48h20M32 44h16M34 38v6M40 38v6M46 38v6M31 34l9-6 9 6M34 34h12"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity="0.55"
        strokeWidth="1.8"
      />
    </svg>
  );
}
