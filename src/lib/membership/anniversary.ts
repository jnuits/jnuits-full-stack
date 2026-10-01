import { parseJoiningDate } from "./intake-fields";

/** Display only: PostgreSQL calculates anniversaries and classifies renewal state. */
export type RenewalState = "paid" | "grace" | "former" | "unknown" | "not_applicable";

export type RenewalPresentationSnapshot = {
  state: RenewalState;
  dueOn: string | null;
  graceEndsOn: string | null;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Dhaka",
});

export function formatDhakaDate(value: string | null): string {
  if (value === null) return "Not recorded";
  const parsed = parseJoiningDate(value);
  if (!parsed.ok || parsed.value !== value) {
    throw new RangeError("Expected a valid YYYY-MM-DD calendar date.");
  }
  // Date-only database values are not instants. An explicit UTC anchor avoids
  // interpreting them at the browser's midnight in a different timezone.
  return dateFormatter.format(new Date(`${value}T06:00:00.000Z`));
}

export function formatRenewalState(snapshot: RenewalPresentationSnapshot) {
  const due = formatDhakaDate(snapshot.dueOn);
  const graceEnds = formatDhakaDate(snapshot.graceEndsOn);

  switch (snapshot.state) {
    case "paid":
      return { label: "Membership current", description: `Your next renewal is due on ${due}.`, tone: "success" as const };
    case "grace":
      return {
        label: "Renewal overdue — grace period",
        description: `Your renewal was due on ${due}. You can continue using your member portal during the grace period, which ends on ${graceEnds}. Please contact an administrator to confirm your renewal.`,
        tone: "warning" as const,
      };
    case "former":
      return {
        label: "Former member",
        description: `Your renewal due on ${due} remains outstanding. An administrator must confirm each outstanding renewal before your current membership can resume. You can also apply for Alumni or request to leave JnUITS.`,
        tone: "warning" as const,
      };
    case "not_applicable":
      return { label: "Annual renewal not required", description: "Alumni membership does not require annual current-member renewal.", tone: "neutral" as const };
    case "unknown":
      return {
        label: "Joining date needs review",
        description: "An administrator needs to confirm your official joining date before a renewal deadline can be recorded.",
        tone: "neutral" as const,
      };
  }
}
