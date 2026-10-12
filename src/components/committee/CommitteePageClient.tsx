"use client";

import { useState } from "react";

import { AdvisorBoardSection } from "@/components/committee/AdvisorBoardSection";
import { CommitteeHero } from "@/components/committee/CommitteeHero";
import { CommitteeTermSwitcher } from "@/components/committee/CommitteeTermSwitcher";
import { FormerAdvisorsSection } from "@/components/committee/FormerAdvisorsSection";
import type {
  PublicAdvisorProfile,
  PublicCommitteeAssignment,
  PublicCommitteeTerm,
} from "@/lib/committee/public-contracts";

export function CommitteePageClient({
  advisors,
  assignmentsByTerm,
  currentAdvisorsCount,
  currentTerm,
  executiveTerms,
  formerAdvisorsCount,
}: {
  advisors: PublicAdvisorProfile[];
  assignmentsByTerm: Record<string, PublicCommitteeAssignment[]>;
  currentAdvisorsCount: number;
  currentTerm: null | PublicCommitteeTerm;
  executiveTerms: PublicCommitteeTerm[];
  formerAdvisorsCount: number;
}) {
  const [formerAdvisorsOpen, setFormerAdvisorsOpen] = useState(false);

  const handleAdvisorHistoryClick = () => {
    setFormerAdvisorsOpen(true);
    const behavior: ScrollBehavior =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth";
    window.setTimeout(() => {
      document
        .getElementById("former-advisors")
        ?.scrollIntoView({ behavior, block: "start" });
    }, 50);
  };

  return (
    <>
      <CommitteeHero
        archivedTerms={executiveTerms.length}
        currentAdvisors={currentAdvisorsCount}
        currentTerm={currentTerm}
        onAdvisorHistoryClick={handleAdvisorHistoryClick}
      />

      <div className="shell space-y-16 sm:space-y-20 md:space-y-24 pb-16 sm:pb-24">
        <CommitteeTermSwitcher
          assignmentsByTerm={assignmentsByTerm}
          defaultTermSlug={currentTerm?.slug || executiveTerms[0]?.slug || ""}
          terms={executiveTerms}
        />

        <AdvisorBoardSection advisors={advisors} />

        {formerAdvisorsCount > 0 ? (
          <FormerAdvisorsSection
            advisors={advisors}
            onOpenChange={setFormerAdvisorsOpen}
            open={formerAdvisorsOpen}
          />
        ) : null}
      </div>
    </>
  );
}
