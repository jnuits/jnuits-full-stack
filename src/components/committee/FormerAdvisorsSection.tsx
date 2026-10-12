"use client";

import { useMemo, useState } from "react";
import { Award, ChevronDown, GraduationCap, ShieldCheck } from "lucide-react";

import { FormerAdvisorTimelineRow } from "@/components/committee/FormerAdvisorCard";
import type { PublicAdvisorProfile } from "@/lib/committee/public-contracts";

const GROUPS = [
  {
    icon: GraduationCap,
    label: "Chief Advisor",
    text: "text-purple-600 dark:text-purple-400",
    tone: "bg-purple-100 dark:bg-purple-950/40",
    type: "main_advisor",
  },
  {
    icon: ShieldCheck,
    label: "Former Moderator / Mentor",
    text: "text-blue-600 dark:text-blue-400",
    tone: "bg-blue-100 dark:bg-blue-950/40",
    type: "moderator_mentor",
  },
  {
    icon: Award,
    label: "Former Honorable Advisor",
    text: "text-amber-600 dark:text-amber-400",
    tone: "bg-amber-100 dark:bg-amber-950/40",
    type: "honorable_advisor",
  },
] as const;

function cn(...classes: Array<false | null | string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function FormerAdvisorsSection({
  advisors,
  onOpenChange,
  open,
}: {
  advisors: PublicAdvisorProfile[];
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const setOpen = (nextOpen: boolean) => {
    setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };
  const formerAdvisors = useMemo(
    () =>
      advisors.filter(
        (advisor) =>
          !advisor.isCurrent &&
          (advisor.advisorType === "main_advisor" ||
            advisor.advisorType === "moderator_mentor" ||
            advisor.advisorType === "honorable_advisor")
      ),
    [advisors]
  );

  if (formerAdvisors.length === 0) return null;

  return (
    <section id="former-advisors">
      <div className="rounded-3xl border border-border bg-card shadow-sm">
        <h2>
          <button
            aria-controls="former-advisors-panel"
            aria-expanded={isOpen}
            className="flex w-full items-start justify-between gap-4 px-5 py-6 text-left transition hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:px-7"
            onClick={() => setOpen(!isOpen)}
            type="button"
          >
            <span className="min-w-0">
              <span className="text-xs font-semibold uppercase tracking-widest text-primary/70">
                Former advisors
              </span>
              <span className="mt-2 block text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Advisor history
              </span>
              <span className="mt-3 block max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                Faculty who previously served as Chief Advisor, Moderator / Mentor
                or Honorable Advisor.
              </span>
            </span>
            <span className="mt-1 inline-flex size-10 flex-shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground">
              <ChevronDown
                aria-hidden="true"
                className={cn("transition-transform", isOpen && "rotate-180")}
                size={17}
              />
            </span>
          </button>
        </h2>

        {isOpen ? (
          <div
            className="border-t border-border/60 px-5 pb-7 pt-2 sm:px-7"
            id="former-advisors-panel"
          >
            {GROUPS.map((group) => {
              const groupAdvisors = formerAdvisors
                .filter((advisor) => advisor.advisorType === group.type)
                .sort(compareAdvisorChronologyDesc);
              const Icon = group.icon;

              if (groupAdvisors.length === 0) return null;

              return (
                <div className="mt-8" key={group.type}>
                  <div className="mb-6 mt-2 flex items-center gap-3">
                    <div
                      className={cn(
                        "flex size-8 flex-shrink-0 items-center justify-center rounded-lg",
                        group.tone
                      )}
                    >
                      <Icon
                        aria-hidden="true"
                        className={group.text}
                        size={15}
                      />
                    </div>
                    <div>
                      <p
                        className={cn(
                          "text-[11px] font-bold uppercase tracking-widest",
                          group.text
                        )}
                      >
                        {group.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {groupAdvisors.length} former advisor
                        {groupAdvisors.length === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>

                  <div className="relative mt-8">
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute bottom-0 left-5 top-0 w-px bg-border/50"
                    />
                    <div className="divide-y divide-border/40">
                      {groupAdvisors.map((advisor) => (
                        <FormerAdvisorTimelineRow
                          advisor={advisor}
                          key={advisor.id}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function compareAdvisorChronologyDesc(
  first: PublicAdvisorProfile,
  second: PublicAdvisorProfile
) {
  const firstValue = chronologyValue(first);
  const secondValue = chronologyValue(second);

  return secondValue.localeCompare(firstValue);
}

function chronologyValue(advisor: PublicAdvisorProfile) {
  return (
    advisor.leftOn ||
    advisor.joinedOn ||
    advisor.advisorJnuitsId ||
    String(advisor.sortOrder).padStart(4, "0")
  );
}
