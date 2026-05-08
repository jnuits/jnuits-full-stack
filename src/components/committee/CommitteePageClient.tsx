"use client";

import { useState } from "react";

import { AdvisorBoardSection } from "@/components/committee/AdvisorBoardSection";
import { CommitteeDivider } from "@/components/committee/CommitteeDivider";
import { CommitteeHero } from "@/components/committee/CommitteeHero";
import { CommitteeTermSwitcher } from "@/components/committee/CommitteeTermSwitcher";
import { FormerAdvisorsSection } from "@/components/committee/FormerAdvisorsSection";
import type {
  PublicAdvisorProfile,
  PublicCommitteeAssignment,
  PublicCommitteeTerm,
} from "@/lib/committee/public";

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
    window.setTimeout(() => {
      document
        .getElementById("former-advisors")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
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

      <div className="mx-auto max-w-[1080px] px-4 sm:px-6 lg:px-8">
        <CommitteeDivider />
        <CommitteeTermSwitcher
          assignmentsByTerm={assignmentsByTerm}
          defaultTermSlug={currentTerm?.slug || "6th-executive-committee"}
          terms={executiveTerms}
        />

        <CommitteeDivider />
        <AdvisorBoardSection advisors={advisors} />

        {formerAdvisorsCount > 0 ? (
          <>
            <CommitteeDivider />
            <FormerAdvisorsSection
              advisors={advisors}
              onOpenChange={setFormerAdvisorsOpen}
              open={formerAdvisorsOpen}
            />
          </>
        ) : null}
      </div>
    </>
  );
}
