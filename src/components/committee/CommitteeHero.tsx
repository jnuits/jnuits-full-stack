"use client";

import { Building2 } from "lucide-react";

import type { PublicCommitteeTerm } from "@/lib/committee/public-contracts";

export function CommitteeHero({
  archivedTerms,
  currentAdvisors,
  currentTerm,
  onAdvisorHistoryClick,
}: {
  archivedTerms: number;
  currentAdvisors: number;
  currentTerm: null | PublicCommitteeTerm;
  onAdvisorHistoryClick: () => void;
}) {
  const seatsFilled = currentTerm?.assignments.length || 0;
  const targetSeats = currentTerm?.targetExecutiveSlots ?? 0;
  const seatValue = `${seatsFilled}/${targetSeats}`;

  const getScrollBehavior = (): ScrollBehavior => {
    if (typeof window === "undefined") return "smooth";
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth";
  };

  const scrollToCurrentCommittee = () => {
    document
      .getElementById("current-committee")
      ?.scrollIntoView({ behavior: getScrollBehavior(), block: "start" });
  };
  const scrollToAdvisorBoard = () => {
    document
      .getElementById("advisor-board")
      ?.scrollIntoView({ behavior: getScrollBehavior(), block: "start" });
  };

  return (
    <section className="overflow-x-hidden bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,color-mix(in_oklab,var(--primary)_7%,transparent),transparent)] py-16 md:py-24 dark:bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,color-mix(in_oklab,var(--primary)_5%,transparent),transparent)]">
      <div className="shell text-center">
        <div>
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-primary">
            <Building2 aria-hidden="true" size={12} />
            JnU IT Society Leadership
          </span>

          <h1 className="mx-auto max-w-4xl text-5xl font-extrabold leading-[1.05] tracking-[-0.03em] text-foreground sm:text-6xl md:text-7xl">
            Executive <br className="sm:hidden" />
            Committee & Advisors
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
            Public leadership archive for JnU IT Society, separating
            member-linked executive rosters from teacher advisor profiles.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-card px-5 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary/40 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              onClick={scrollToCurrentCommittee}
              type="button"
            >
              Current Committee
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-card px-5 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary/40 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              onClick={scrollToAdvisorBoard}
              type="button"
            >
              Advisor Board
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-card px-5 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary/40 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              onClick={onAdvisorHistoryClick}
              type="button"
            >
              Advisor History
            </button>
          </div>

          <div className="mx-auto mt-14 grid max-w-2xl grid-cols-3 gap-4 border-t border-border/50 pt-10">
            <HeroStat
              dimmed={seatsFilled === 0}
              label="Executive seats"
              value={seatValue}
            />
            <HeroStat label="Current advisors" value={currentAdvisors} />
            <HeroStat label="Archive terms" value={archivedTerms} last />
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroStat({
  dimmed,
  label,
  last,
  value,
}: {
  dimmed?: boolean;
  label: string;
  last?: boolean;
  value: number | string;
}) {
  return (
    <div className={last ? "text-center" : "border-r border-border/50 pr-4 text-center"}>
      <p
        className={
          dimmed
            ? "text-3xl font-black tabular-nums text-muted-foreground/50 sm:text-5xl"
            : "text-3xl font-black tabular-nums text-foreground sm:text-5xl"
        }
      >
        {value}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
