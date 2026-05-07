import { GraduationCap } from "lucide-react";

import { AdvisorCompactCard } from "@/components/committee/AdvisorCompactCard";
import { AdvisorFeaturedCard } from "@/components/committee/AdvisorFeaturedCard";
import type { PublicAdvisorProfile } from "@/lib/committee/public";

export function AdvisorBoardSection({
  advisors,
}: {
  advisors: PublicAdvisorProfile[];
}) {
  const currentAdvisors = advisors.filter((advisor) => advisor.isCurrent);
  const chiefAdvisors = currentAdvisors.filter(
    (advisor) => advisor.advisorType === "main_advisor"
  );
  const moderators = currentAdvisors.filter(
    (advisor) => advisor.advisorType === "moderator_mentor"
  );
  const honorableAdvisors = currentAdvisors.filter(
    (advisor) => advisor.advisorType === "honorable_advisor"
  );

  return (
    <section id="advisor-board">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary/70">
          Advisor board
        </p>
        <h2 className="mt-2 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Advisors and mentor support
        </h2>
        <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
          Teacher advisors are maintained separately from student and alumni
          member records. Their public service history follows advisor joining
          and leaving dates, not executive committee terms.
        </p>
      </div>

      {currentAdvisors.length > 0 ? (
        <>
          {(chiefAdvisors.length > 0 || moderators.length > 0) && (
            <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
              {chiefAdvisors.map((advisor) => (
                <AdvisorFeaturedCard
                  advisor={advisor}
                  key={advisor.id}
                  tone="chief"
                />
              ))}
              {moderators.map((advisor) => (
                <AdvisorFeaturedCard
                  advisor={advisor}
                  key={advisor.id}
                  tone="moderator"
                />
              ))}
            </div>
          )}

          {honorableAdvisors.length > 0 ? (
            <div className="mt-14">
              <p className="mb-5 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.15em] text-amber-700 dark:text-amber-300">
                <span className="h-px w-5 bg-amber-400" />
                Honorable Advisor
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {honorableAdvisors.map((advisor) => (
                  <AdvisorCompactCard advisor={advisor} key={advisor.id} />
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <div className="mt-10 rounded-3xl border border-dashed border-border/60 bg-muted/20 px-8 py-16 text-center">
          <GraduationCap
            aria-hidden="true"
            className="mx-auto mb-4 text-primary/60"
            size={42}
            strokeWidth={1.5}
          />
          <h3 className="text-xl font-bold text-foreground">
            Current advisor board is not published yet
          </h3>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
            Current Chief Advisor, Moderator/Mentor, and Honorable Advisor
            profiles will appear here after committee admins publish them.
          </p>
        </div>
      )}
    </section>
  );
}
