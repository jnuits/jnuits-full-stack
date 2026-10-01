"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { confirmRenewalAction, reviewMembershipRequestAction, type RenewalActionResult } from "@/app/admin/membership/renewal-actions";
import { formatDhakaDate } from "@/lib/membership/anniversary";
import { renewalQueues, type RenewalQueue, type RenewalQueueRow, type RenewalQueueData } from "@/lib/membership/renewal-queue";
export type { RenewalQueueData } from "@/lib/membership/renewal-queue";

function queueHref(queue: RenewalQueue, page = 1) { return `/admin/membership?renewalQueue=${queue}&renewalPage=${page}#membership-renewals`; }

function DecisionDialog({ row, onClose }: { row: RenewalQueueRow; onClose: () => void }) {
  const isRenewal = !row.requestId || row.requestType === "membership_renewal";
  const [result, action, pending] = useActionState(isRenewal ? confirmRenewalAction : reviewMembershipRequestAction, { status: "idle", message: "" } as RenewalActionResult);
  const [confirmed, setConfirmed] = useState(false);
  const [note, setNote] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    if (element?.showModal) element.showModal(); else element?.setAttribute("open", "");
    return () => { if (element?.open && element.close) element.close(); };
  }, []);
  const consequence = row.requestType === "membership_departure_appeal"
    ? "Approving reopens the renewal path but does not pay overdue fees. Rejecting permanently closes current membership while preserving future alumni eligibility."
    : row.requestType === "membership_departure"
      ? "Approving closes current membership with one appeal. Rejecting keeps the renewal path open. Future alumni eligibility remains."
      : "Approving converts the profile to alumni and closes the current-membership path. Identity and committee history remain.";
  return (
    <dialog ref={dialog} aria-labelledby={titleId} onCancel={(event) => { if (pending) event.preventDefault(); else onClose(); }} className="membership-renewal-dialog">
      <h3 id={titleId}>{isRenewal ? "Confirm one anniversary" : "Review membership request"}</h3>
      <p className="section-copy mt-3">{row.fullName} · {row.jnuitsId}</p>
      <p className="section-copy mt-3">{isRenewal ? `Confirm only the anniversary due ${formatDhakaDate(row.dueOn)} after verifying the office payment or waiver. This does not lift any security freeze. Older overdue anniversaries may need separate confirmations.` : consequence}</p>
      {row.requestNote ? <p className="section-copy mt-3">Member reason: {row.requestNote}</p> : null}
      <form action={action} className="grid gap-4 mt-4">
        {isRenewal ? <>
          <input type="hidden" name="memberId" value={row.memberId} />
          <input type="hidden" name="expectedDueOn" value={row.dueOn || ""} />
          <label className="input-label">Resolution<select name="resolution"><option value="paid">Office payment verified</option><option value="waived">Fee waived by administrator</option></select></label>
          <label className="input-label">Safe office reference (optional)<input name="reference" maxLength={96} pattern="[A-Za-z0-9._/-]*" placeholder="OFFICE-42" /><span>Short reference only. No bank/card details, passwords, or financial secrets.</span></label>
        </> : <>
          <input type="hidden" name="requestId" value={row.requestId || ""} />
          <input type="hidden" name="expectedUpdatedAt" value={row.requestUpdatedAt || ""} />
          <label className="input-label">Decision<select name="decision"><option value="approved">Approve</option><option value="rejected">Reject</option></select></label>
        </>}
        <label className="input-label">Review note<textarea name="note" required maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} /></label>
        <label className="flex items-start gap-2"><input type="checkbox" name="confirmation" value="CONFIRM" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} required /><span>{isRenewal ? "I confirm only this anniversary after checking the evidence." : "I understand this decision and its consequences."}</span></label>
        <div className="flex flex-wrap gap-3"><button type="submit" className="primary-button" disabled={pending || !confirmed || !note.trim() || result.status === "success"}>{pending ? "Recording…" : isRenewal ? "Confirm anniversary" : "Record decision"}</button><button type="button" className="ghost-button" disabled={pending} onClick={onClose}>Close</button></div>
        {result.status !== "idle" ? <p role={result.status === "error" ? "alert" : "status"}>{result.message}</p> : null}
      </form>
    </dialog>
  );
}

export function MembershipRenewalPanel({ data }: { data: RenewalQueueData }) {
  const [selected, setSelected] = useState<RenewalQueueRow | null>(null);
  return (
    <section id="membership-renewals" className="section-band">
      <span className="eyebrow">Anniversary administration</span><h2 className="text-2xl mt-3">Renewal and membership decisions</h2>
      <p className="section-copy mt-3">Office verification only — no online payment processing. Confirm one anniversary at a time; membership decisions never lift security restrictions.</p>
      <nav aria-label="Membership decision queues" className="flex flex-wrap gap-2 mt-4">{renewalQueues.map(([queue, label]) => <a className="ghost-button" key={queue} href={queueHref(queue)} aria-current={queue === data.queue ? "page" : undefined}>{label}</a>)}</nav>
      <h3 className="text-xl mt-6">{renewalQueues.find(([value]) => value === data.queue)?.[1]}</h3>
      {data.queue === "upcoming" ? <p className="section-copy">Due within the next 30 days, using the Dhaka calendar.</p> : null}
      {data.error ? <p role="alert">{data.error}</p> : <>
        <p className="section-copy mt-2">{data.total} matching records · page {data.page}</p>
        {data.rows.length === 0 ? <p className="section-copy mt-4">No records on this queue page.</p> : <ul className="grid gap-4 mt-4">{data.rows.map((row) => {
          const canConfirm = row.joinedOn && row.dueOn && row.pathStatus === "open" && ["current", "former"].includes(row.lifecycleStatus);
          return <li className="admin-renewal-record" key={row.requestId || row.memberId}>
            <h4 className="font-semibold break-words">{row.fullName} · {row.jnuitsId}</h4>
            <p className="section-copy">Joined {formatDhakaDate(row.joinedOn)} · Due {formatDhakaDate(row.dueOn)}{row.overdueDays > 0 ? ` · ${row.overdueDays} days overdue` : ""}</p>
            <p className="section-copy">Membership: {row.lifecycleStatus} · Path: {row.pathStatus.replaceAll("_", " ")} · Security: {row.portalAccessStatus}</p>
            {row.requestedAt ? <p className="section-copy">Requested {new Date(row.requestedAt).toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka" })}</p> : null}
            <div className="flex flex-wrap gap-2 mt-3">
              {!row.joinedOn ? <a className="ghost-button" href={`/admin/membership?memberId=${encodeURIComponent(row.memberId)}#member-operations`}>Correct joining date</a> : null}
              {row.requestId && row.requestType !== "membership_renewal" ? <button className="primary-button" type="button" disabled={!row.requestUpdatedAt} onClick={() => setSelected(row)}>Review request</button> : canConfirm ? <button className="primary-button" type="button" onClick={() => setSelected(row)}>Review anniversary</button> : null}
            </div>
          </li>;
        })}</ul>}
        <nav aria-label="Queue pagination" className="flex flex-wrap gap-3 mt-4">{data.page > 1 ? <a className="ghost-button" aria-label="Previous queue page" href={queueHref(data.queue, data.page - 1)}>Previous</a> : null}{data.page * data.pageSize < data.total ? <a className="ghost-button" aria-label="Next queue page" href={queueHref(data.queue, data.page + 1)}>Next</a> : null}</nav>
      </>}
      {selected ? <DecisionDialog key={selected.requestId || `${selected.memberId}:${selected.dueOn}`} row={selected} onClose={() => setSelected(null)} /> : null}
    </section>
  );
}
