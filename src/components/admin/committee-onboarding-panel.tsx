"use client";

import { useState } from "react";

import { IntakeWorkspace } from "@/components/admin/onboarding/intake-workspace";

type CommitteeOnboardingTerm = {
  id: string;
  title: string;
};

export function CommitteeOnboardingPanel({
  initialTermId,
  terms,
}: {
  initialTermId: null | string;
  terms: CommitteeOnboardingTerm[];
}) {
  const fallbackTermId = terms[0]?.id || "";
  const [targetTermId, setTargetTermId] = useState(initialTermId || fallbackTermId);
  const targetTerm = terms.find((term) => term.id === targetTermId) || null;

  if (terms.length === 0) {
    return (
      <p className="portal-message portal-message--error" role="alert">
        Create an executive committee term before starting a roster draft.
      </p>
    );
  }

  return (
    <div className="grid min-w-0 gap-5">
      <label className="input-label max-w-xl">
        Target committee term
        <select
          aria-label="Target committee term"
          onChange={(event) => setTargetTermId(event.currentTarget.value)}
          value={targetTermId}
        >
          {terms.map((term) => (
            <option key={term.id} value={term.id}>
              {term.title}
            </option>
          ))}
        </select>
        <span className="text-xs font-normal text-muted-foreground">
          Drafts are permanently bound to this term. Changing the term starts a separate workspace.
        </span>
      </label>

      {targetTerm ? (
        <IntakeWorkspace
          key={targetTerm.id}
          operationType="committee_roster_import"
          targetTermId={targetTerm.id}
          targetTermLabel={targetTerm.title}
        />
      ) : null}
    </div>
  );
}
