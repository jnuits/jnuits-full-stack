import { GraduationCap } from "lucide-react";

import { AdvisorFeaturedCard } from "@/components/committee/AdvisorFeaturedCard";
import type { PublicAdvisorProfile } from "@/lib/committee/public-contracts";

export function AdvisorBoardSection({
  advisors,
}: {
  advisors: PublicAdvisorProfile[];
}) {
  const currentAdvisors = advisors.filter((advisor) => advisor.isCurrent);

  return (
    <section id="advisor-board">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary/70">
          Advisor board
        </p>
        <h2 className="mt-2 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Advisor Board
        </h2>
        <p className="mt-3 text-lg leading-relaxed text-muted-foreground [text-wrap:balance]">
          Faculty members who guide the society and mentor each committee.
        </p>
      </div>

      {currentAdvisors.length > 0 ? (
        <div className="mt-10 flex flex-wrap justify-center gap-6">
          {currentAdvisors.map((advisor) => {
            const tone =
              advisor.advisorType === "main_advisor"
                ? "chief"
                : advisor.advisorType === "moderator_mentor"
                  ? "moderator"
                  : "honorable";
            return (
              <div
                className="w-full sm:w-[calc((100%_-_1.5rem)/2)] lg:w-[calc((100%_-_3rem)/3)]"
                key={advisor.id}
              >
                <AdvisorFeaturedCard advisor={advisor} tone={tone} />
              </div>
            );
          })}
        </div>
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
