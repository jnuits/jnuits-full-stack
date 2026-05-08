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
} from "@/lib/committee/public";
import {
  formatCommitteeDate,
  formatCommitteeDateRange,
  groupByRoleCategory,
  ordinalSuffix,
  type CommitteeRoleCategory,
} from "@/lib/committee-utils";

function cn(...classes: Array<false | null | string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const categoryLabels: Record<CommitteeRoleCategory, string> = {
  leadership: "Leadership",
  secretaries: "Secretaries",
  executiveMembers: "Executive Members",
};

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

  const activeTerm =
    terms.find((term) => term.slug === activeTermSlug) || terms[0] || null;
  const assignments = activeTerm ? assignmentsByTerm[activeTerm.slug] || [] : [];

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
        <p className="text-xs font-semibold uppercase tracking-widest text-primary/70">
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
        <p className="text-xs font-semibold uppercase tracking-widest text-primary/70">
          Executive Committee
        </p>

        <div className="-mb-1 mt-5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {terms.map((term) => {
            const isActive = term.slug === activeTerm.slug;
            const termNumber = term.termNumber || terms.length;

            return (
              <button
                aria-pressed={isActive}
                className={cn(
                  "inline-flex min-h-11 flex-shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "border border-border bg-muted/60 text-muted-foreground hover:border-border/80 hover:bg-muted hover:text-foreground"
                )}
                key={term.slug}
                onClick={() => setActiveTermSlug(term.slug)}
                ref={isActive ? activeTabRef : null}
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
                    ~
                  </span>
                ) : null}
              </button>
            );
          })}
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
                  ~ Estimated dates
                </span>
              ) : null}
            </div>
          </div>

          <Link
            className="inline-flex min-h-11 flex-shrink-0 items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            href={`/committee/${activeTerm.slug}`}
          >
            Open term page
            <ArrowUpRight aria-hidden="true" size={13} />
          </Link>
        </div>
      </div>

      <div
        className="animate-[jnuits-fade-rise_260ms_var(--motion-ease)_both]"
        key={activeTerm.slug}
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
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary/70">
          Roster Pending
        </p>
        <h3 className="mx-auto max-w-2xl text-2xl font-bold text-foreground">
          The {term.title} roster will be published soon
        </h3>
        <p className="mx-auto mt-3 max-w-lg text-base leading-relaxed text-muted-foreground">
          The committee term is configured and verified
          {term.electionDate
            ? ` with election date ${formatCommitteeDate(term.electionDate)}`
            : ""}
          . The public roster will be published once member-linked executive
          assignments are imported and validated.
        </p>
        <div className="mt-8 flex justify-center">
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-card px-5 text-sm font-semibold text-foreground transition hover:border-primary/40 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            href={`/committee/${term.slug}`}
          >
            Open term shell
          </Link>
        </div>
        <p className="mt-6 text-xs text-muted-foreground/60">
          Members elected July 7, 2025 - {term.targetExecutiveSlots} executive
          seats
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
  const grouped = useMemo(() => groupByRoleCategory(assignments), [assignments]);
  const entries = Object.entries(grouped) as Array<
    [CommitteeRoleCategory, PublicCommitteeAssignment[]]
  >;

  return (
    <div className="mt-8 space-y-10">
      {entries.map(([category, members]) => {
        if (members.length === 0) return null;

        return (
          <div key={category}>
            <div className="mb-6 flex items-center gap-4">
              <div className="h-px flex-1 bg-border/60" />
              <span className="flex-shrink-0 px-2 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                {categoryLabels[category]}
              </span>
              <div className="h-px flex-1 bg-border/60" />
            </div>

            <div
              className={cn(
                "grid gap-3",
                category === "executiveMembers"
                  ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
                  : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
              )}
            >
              {members.map((assignment, index) => (
                <div
                  className="animate-[jnuits-fade-rise_300ms_var(--motion-ease)_both]"
                  key={assignment.id}
                  style={{ animationDelay: `${index * 40}ms` }}
                >
                  <ExecutiveMemberCard
                    assignment={assignment}
                    isCurrent={isCurrent}
                    termTitle={termTitle}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}
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
