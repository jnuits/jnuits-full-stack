import type { Metadata } from "next";
import { Suspense } from "react";

import { AdvisorBoardSection } from "@/components/committee/AdvisorBoardSection";
import { CommitteeArchiveSection } from "@/components/committee/CommitteeArchiveSection";
import { CommitteeDivider } from "@/components/committee/CommitteeDivider";
import { CommitteeHero } from "@/components/committee/CommitteeHero";
import { CommitteePageSkeleton } from "@/components/committee/CommitteePageSkeleton";
import { CurrentCommitteeSection } from "@/components/committee/CurrentCommitteeSection";
import { FormerAdvisorsSection } from "@/components/committee/FormerAdvisorsSection";
import { IdentityBoundaryNotice } from "@/components/committee/IdentityBoundaryNotice";
import { getPublicCommitteeDirectory } from "@/lib/committee/public";

export const metadata: Metadata = {
  title: "Executive Committee & Advisors - JnU IT Society",
  description:
    "Public leadership roster for JnU IT Society, including member-linked executive committees and separate teacher advisor profiles.",
  openGraph: {
    title: "Executive Committee & Advisors - JnU IT Society",
    description:
      "Browse the public executive committee archive and advisor board for JnU IT Society.",
    type: "website",
  },
};

export default function CommitteePage() {
  return (
    <main className="overflow-x-hidden bg-background text-foreground">
      <Suspense fallback={<CommitteePageSkeleton />}>
        <CommitteeContent />
      </Suspense>
    </main>
  );
}

async function CommitteeContent() {
  const directory = await getPublicCommitteeDirectory();
  const currentTerm = directory.currentTerm;
  const currentAdvisors = directory.advisors.filter((advisor) => advisor.isCurrent);
  const formerAdvisors = directory.advisors.filter((advisor) => !advisor.isCurrent);
  const archiveTerms = directory.terms.filter(
    (term) => !term.slug.toLowerCase().includes("advisory")
  );

  return (
    <>
      <CommitteeHero
        archivedTerms={archiveTerms.length}
        currentAdvisors={currentAdvisors.length}
        currentTerm={currentTerm}
      />

      <div className="mx-auto max-w-[1080px] px-4 sm:px-6 lg:px-8">
        <CommitteeDivider />
        <CurrentCommitteeSection term={currentTerm} />

        <CommitteeDivider />
        <AdvisorBoardSection advisors={directory.advisors} />

        {formerAdvisors.length > 0 ? (
          <>
            <CommitteeDivider />
            <FormerAdvisorsSection advisors={directory.advisors} />
          </>
        ) : null}

        <CommitteeDivider />
        <CommitteeArchiveSection terms={directory.terms} />
        <IdentityBoundaryNotice />
      </div>
    </>
  );
}
