import type { Metadata } from "next";
import { Suspense } from "react";

import { CommitteePageSkeleton } from "@/components/committee/CommitteePageSkeleton";
import { CommitteePageClient } from "@/components/committee/CommitteePageClient";
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
  const publicExecutiveTerms = directory.terms.filter(
    (term) => !term.slug.toLowerCase().includes("advisory")
  );
  const executiveTerms = [...publicExecutiveTerms].sort(
    (first, second) => (second.termNumber || 0) - (first.termNumber || 0)
  );
  const assignmentsByTerm = Object.fromEntries(
    executiveTerms.map((term) => [term.slug, term.assignments])
  );

  return (
    <CommitteePageClient
      advisors={directory.advisors}
      assignmentsByTerm={assignmentsByTerm}
      currentAdvisorsCount={currentAdvisors.length}
      currentTerm={currentTerm}
      executiveTerms={executiveTerms}
      formerAdvisorsCount={formerAdvisors.length}
    />
  );
}
