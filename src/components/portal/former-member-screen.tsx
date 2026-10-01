"use client";

import { useActionState, useState } from "react";
import { requestMembershipAction, type MembershipActionResult } from "@/app/(portal)/portal/membership/actions";
import { formatDhakaDate, formatRenewalState, type RenewalState } from "@/lib/membership/anniversary";
import type { PortalMembershipRequest } from "@/lib/portal/member";

/** Client projection: no email, phone, internal security state, request payload
 * or administrator note. Case identifiers become eligibility booleans. */
export type MembershipView = {
  fullName: string; jnuitsId: string | null; lifecycleStatus: "current" | "former";
  currentMembershipPathStatus: string; joinedOn: string | null; renewalDueOn: string | null;
  graceEndsOn: string | null; renewalState: RenewalState; revision: number;
  hasDepartureCase: boolean; hasAppeal: boolean;
};
const initial: MembershipActionResult = { status: "idle", message: "" };

function ChoiceForm({ action, title, description, label, revision, disabled = false }: {
  action: "renewal" | "alumni" | "departure" | "withdraw_departure" | "appeal";
  title: string; description: string; label: string; revision: number; disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState(requestMembershipAction, initial);
  const [confirmation, setConfirmation] = useState("");
  const [note, setNote] = useState("");
  const destructive = action === "departure";
  return <section className="portal-section">
    <div className="portal-section__header"><h2 className="portal-section__title">{title}</h2></div>
    <div className="portal-section__body">
      <p className="text-sm leading-7 text-[var(--muted-foreground)]">{description}</p>
      <form action={formAction} className="mt-4 grid min-w-0 gap-4">
        <input type="hidden" name="action" value={action} />
        <input type="hidden" name="revision" value={revision} />
        {action === "appeal" ? <label className="input-label">
          Reason for appeal
          <textarea name="note" value={note} onChange={(event) => setNote(event.target.value)} required maxLength={500} rows={4} className="input-control min-w-0" />
          <span className="text-xs">Explain the mistake or your reason in 1–500 characters.</span>
        </label> : null}
        {destructive ? <label className="input-label">
          Type LEAVE JNUITS to confirm
          <input name="confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" required className="input-control" />
        </label> : null}
        <div><button type="submit" className={destructive ? "secondary-button border-[var(--destructive)] text-[var(--destructive)]" : "primary-button"}
          disabled={pending || disabled || (destructive && confirmation !== "LEAVE JNUITS") || (action === "appeal" && !note.trim())}>
          {pending ? "Sending request…" : label}
        </button></div>
        {disabled ? <p className="text-sm text-[var(--muted-foreground)]">A request is already awaiting administrator review.</p> : null}
        {state.message ? <p role={state.status === "error" ? "alert" : "status"} aria-live="polite" className="flash-panel" data-tone={state.status === "error" ? "error" : "success"}>{state.message}</p> : null}
      </form>
    </div>
  </section>;
}

export function FormerMemberScreen({ membership, requests }: { membership: MembershipView; requests: PortalMembershipRequest[] }) {
  const presentation = formatRenewalState({ state: membership.renewalState, dueOn: membership.renewalDueOn, graceEndsOn: membership.graceEndsOn });
  const former = membership.lifecycleStatus === "former";
  const path = membership.currentMembershipPathStatus;
  const hasPending = (type: string) => requests.some((request) => request.request_type === type && request.status === "pending");
  return <div className="grid min-w-0 gap-5">
    <div className="portal-page-header"><div>
      <p className="portal-page-header__breadcrumb">Membership</p>
      <h1 className="portal-page-header__title">{presentation.label}</h1>
      <p className="portal-page-header__desc">{presentation.description}</p>
    </div></div>
    <section className="portal-section">
      <div className="portal-section__header"><h2 className="portal-section__title">Your membership dates</h2></div>
      <dl className="portal-section__body grid gap-4 sm:grid-cols-3">
        {[ ["Joining date", membership.joinedOn], ["Renewal due", membership.renewalDueOn], ["Grace period ends", membership.graceEndsOn] ].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-[var(--muted-foreground)]">{label}</dt><dd className="mt-1 text-sm font-semibold">{formatDhakaDate(value)}</dd></div>)}
      </dl>
    </section>
    {path === "departure_requested" ? <p className="flash-panel" role="status">Your departure is awaiting review. Renewal is paused; you may withdraw before an administrator decides.</p> : null}
    {path === "closed_appealable" ? <p className="flash-panel">Your departure was approved. {membership.hasAppeal ? "Your one appeal has already been submitted; a second appeal is not available." : "You may submit one appeal if you chose to leave by mistake."}</p> : null}
    {path === "closed_final" ? <p className="flash-panel">Your current-membership path is permanently closed. You may still apply for Alumni now or in the future.</p> : null}
    {path === "open" && membership.renewalDueOn && ["grace", "former"].includes(membership.renewalState) ? <ChoiceForm
      action="renewal" revision={membership.revision} title="Renew current membership" label="Request renewal" disabled={hasPending("membership_renewal")}
      description="Contact a JnUITS administrator about overdue fees. Each outstanding anniversary must be confirmed or waived by an administrator; this button does not make an online payment." /> : null}
    {former ? <ChoiceForm action="alumni" revision={membership.revision} title="Stay connected as Alumni" label="Apply for Alumni" disabled={hasPending("alumni_conversion")}
      description="Ask an administrator to review your Alumni application. Your JnUITS ID and committee service history remain yours." /> : null}
    {former && path === "open" ? <ChoiceForm action="departure" revision={membership.revision} title="Leave JnUITS" label="Leave JnUITS"
      description="This sends a departure request, not a deletion. You can withdraw while it is pending. Approval closes current membership, with one appeal; if that appeal is rejected, the current-membership path is permanently closed. Future Alumni eligibility remains." /> : null}
    {path === "departure_requested" ? <ChoiceForm action="withdraw_departure" revision={membership.revision} title="Changed your mind?" label="Withdraw departure request"
      description="Withdraw before administrator review to reopen your renewal options. You remain a former member until outstanding renewals are confirmed." /> : null}
    {former && path === "closed_appealable" && membership.hasDepartureCase && !membership.hasAppeal ? <ChoiceForm action="appeal" revision={membership.revision} title="Appeal your departure" label="Submit appeal"
      description="Explain why your current-membership path should reopen. An approved appeal restores renewal eligibility, not payment or current status. If this one appeal is rejected, current membership closes permanently." /> : null}
  </div>;
}
