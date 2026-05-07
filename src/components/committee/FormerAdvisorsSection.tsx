import { GraduationCap, ShieldCheck, UsersRound } from "lucide-react";

import { FormerAdvisorCard } from "@/components/committee/FormerAdvisorCard";
import type { PublicAdvisorProfile } from "@/lib/committee/public";

const GROUPS = [
  {
    icon: GraduationCap,
    label: "Former Chief Advisor / Main Advisor",
    tone:
      "bg-purple-100 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400",
    type: "main_advisor",
  },
  {
    icon: ShieldCheck,
    label: "Former Moderator / Mentor",
    tone: "bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
    type: "moderator_mentor",
  },
  {
    icon: UsersRound,
    label: "Former Honorable Advisor",
    tone:
      "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    type: "honorable_advisor",
  },
] as const;

function cn(...classes: Array<false | null | string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function FormerAdvisorsSection({
  advisors,
}: {
  advisors: PublicAdvisorProfile[];
}) {
  const formerAdvisors = advisors.filter((advisor) => !advisor.isCurrent);

  if (formerAdvisors.length === 0) return null;

  return (
    <section id="former-advisors">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary/70">
          Former advisors
        </p>
        <h2 className="mt-2 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Advisor history
        </h2>
        <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
          Preserved separately from executive committee terms, with former
          titles and public tenure notes displayed only when suitable for the
          public record.
        </p>
      </div>

      {GROUPS.map((group) => {
        const groupAdvisors = formerAdvisors.filter(
          (advisor) => advisor.advisorType === group.type
        );
        const Icon = group.icon;

        if (groupAdvisors.length === 0) return null;

        return (
          <div key={group.type}>
            <div className="mb-6 mt-12 flex items-center gap-4">
              <div
                className={cn(
                  "flex size-8 flex-shrink-0 items-center justify-center rounded-lg",
                  group.tone
                )}
              >
                <Icon aria-hidden="true" size={16} />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-foreground/70">
                  {group.label}
                </p>
                <p className="text-xs text-muted-foreground">
                  {groupAdvisors.length} former advisor
                  {groupAdvisors.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
              {groupAdvisors.map((advisor) => (
                <FormerAdvisorCard advisor={advisor} key={advisor.id} />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
