"use client";

import { useActionState, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AdminVerifiedForm } from "./admin-verified-form";
import { confirmRenewalAction, reviewMembershipRequestAction, type RenewalActionResult } from "@/app/admin/membership/renewal-actions";
import { bulkApproveMembershipRequestsAction } from "@/app/admin/membership/bulk-review-actions";
import { bulkRowSnapshot, initialBulkReviewResult, reviewableBulkRows, type BulkReviewInput, type BulkReviewResult } from "@/lib/membership/bulk-review-model";
import { formatDhakaDate } from "@/lib/membership/anniversary";
import { renewalQueues, type RenewalQueue, type RenewalQueueRow, type RenewalQueueData } from "@/lib/membership/renewal-queue";
export type { RenewalQueueData } from "@/lib/membership/renewal-queue";

function queueHref(queue: RenewalQueue, page = 1) { return `/admin/membership?renewalQueue=${queue}&renewalPage=${page}#membership-renewals`; }

function DecisionForm({ row, isRenewal, action, children }: { row: RenewalQueueRow; isRenewal: boolean; action: (form: FormData) => void; children: ReactNode }) {
  if (!isRenewal) return <form action={action} className="grid gap-4 mt-4">{children}</form>;
  return <AdminVerifiedForm action={action} className="grid gap-4 mt-4" intent={{ operation: "membership.renewal.confirm", payload: {
    memberId: row.memberId, expectedDueOn: row.dueOn ?? "", resolution: "paid", reference: "", note: "", confirmation: "CONFIRM",
  } }}>{children}</AdminVerifiedForm>;
}

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
      <DecisionForm row={row} isRenewal={isRenewal} action={action}>
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
      </DecisionForm>
    </dialog>
  );
}

function BulkDecisionDialog({ rows, queue, action, result, pending, stale, onClose }: {
  rows: RenewalQueueRow[]; queue: BulkReviewInput["queue"]; action: (form: FormData) => void;
  result: BulkReviewResult; pending: boolean; stale: boolean; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement as HTMLElement | null;
    if (element?.showModal) element.showModal(); else element?.setAttribute("open", "");
    return () => { if (element?.open && element.close) element.close(); if (opener?.isConnected) opener.focus(); };
  }, []);
  const consequence = queue === "appeal"
    ? "Approving reopens the renewal path but does not pay overdue fees."
    : queue === "departure" ? "Approving closes current membership with one appeal. Future alumni eligibility remains."
      : "Approving converts these profiles to Alumni and closes their current-membership path. Identity and committee history remain.";
  return <dialog ref={dialog} aria-labelledby={titleId} className="membership-renewal-dialog"
    onCancel={event => { if (pending) event.preventDefault(); else onClose(); }}
    onKeyDown={event => {
      if (event.key !== "Tab") return;
      const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled):not([type=hidden]), textarea:not(:disabled)") ?? []);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
    <h3 id={titleId}>Approve selected membership requests</h3>
    <p className="section-copy mt-3">{consequence} These decisions never lift security restrictions.</p>
    <ul className="grid gap-2 mt-3">{rows.map(row => <li className="break-words" key={row.requestId}>{row.fullName} · {row.jnuitsId}</li>)}</ul>
    <form action={action} className="grid gap-4 mt-4">
      <input type="hidden" name="queue" value={queue} />
      <input type="hidden" name="requests" value={JSON.stringify(rows.map(row => ({ requestId: row.requestId, expectedUpdatedAt: row.requestUpdatedAt })))} />
      <fieldset disabled={pending || stale || result.status !== "idle"} className="grid gap-4 min-w-0">
        <label className="input-label">Bulk review note<textarea name="note" required maxLength={500} value={note} onChange={event => setNote(event.target.value)} /></label>
        <label className="flex items-start gap-2"><input type="checkbox" name="confirmation" value="CONFIRM" required checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>I understand these decisions and their consequences for all selected members.</span></label>
        <button type="submit" className="primary-button" disabled={!confirmed || !note.trim()}>{pending ? "Approving…" : "Approve selected requests"}</button>
      </fieldset>
      {stale && result.status === "idle" ? <p role="alert">The selection changed. Close this review and select the refreshed requests again.</p> : null}
      {result.status !== "idle" ? <><p role={result.status === "error" ? "alert" : "status"}>{result.message}</p><ul className="grid gap-2">{result.results.map(item => <li key={item.requestId} className="break-words">{rows.find(row => row.requestId === item.requestId)?.jnuitsId}: {item.status.replaceAll("_", " ")}</li>)}</ul></> : null}
      <button type="button" className="ghost-button" disabled={pending} onClick={onClose}>Close bulk review</button>
    </form>
  </dialog>;
}

export function MembershipRenewalPanel({ data }: { data: RenewalQueueData }) {
  // Navigation must discard selections rather than carry them to another page.
  return <MembershipRenewalWorkspace key={`${data.queue}:${data.page}`} data={data} />;
}

function MembershipRenewalWorkspace({ data }: { data: RenewalQueueData }) {
  const [selected, setSelected] = useState<RenewalQueueRow | null>(null);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [bulkDraft, setBulkDraft] = useState<{ rows: RenewalQueueRow[]; baseline: BulkReviewResult } | null>(null);
  const [result, action, pending] = useActionState(bulkApproveMembershipRequestsAction, initialBulkReviewResult);
  const [handledResult, setHandledResult] = useState(result);
  const available = reviewableBulkRows(data);
  const snapshot = JSON.stringify(available.map(row => [row.requestId, bulkRowSnapshot(row)]));
  const [observedSnapshot, setObservedSnapshot] = useState(snapshot);
  if (observedSnapshot !== snapshot) {
    setObservedSnapshot(snapshot);
    // Permanently drop changed or disappeared rows; an old snapshot returning
    // later cannot resurrect an administrator's previous selection.
    setSelection(Object.fromEntries(available.filter(row => selection[row.requestId!] === bulkRowSnapshot(row)).map(row => [row.requestId!, bulkRowSnapshot(row)])));
  }
  if (handledResult !== result) {
    setHandledResult(result);
    const resolved = new Set(result.results.filter(row => ["approved", "already_approved"].includes(row.status)).map(row => row.requestId));
    setSelection(current => Object.fromEntries(Object.entries(current).filter(([id]) => !resolved.has(id))));
  }
  const selectedRows = available.filter(row => selection[row.requestId!] === bulkRowSnapshot(row));
  const master = useRef<HTMLInputElement>(null);
  const { refresh } = useRouter();
  useEffect(() => { if (master.current) master.current.indeterminate = selectedRows.length > 0 && selectedRows.length < available.length; }, [selectedRows.length, available.length]);
  useEffect(() => { if (result.status !== "idle") refresh(); }, [result, refresh]);
  const canBulkReview = ["alumni", "departure", "appeal"].includes(data.queue);
  return (
    <section id="membership-renewals" className="section-band">
      <span className="eyebrow">Anniversary administration</span><h2 className="text-2xl mt-3">Renewal and membership decisions</h2>
      <p className="section-copy mt-3">Office verification only — no online payment processing. Confirm one anniversary at a time; membership decisions never lift security restrictions.</p>
      <nav aria-label="Membership decision queues" className="flex flex-wrap gap-2 mt-4">{renewalQueues.map(([queue, label]) => <a className="ghost-button" key={queue} href={queueHref(queue)} aria-current={queue === data.queue ? "page" : undefined}>{label}</a>)}</nav>
      <h3 className="text-xl mt-6">{renewalQueues.find(([value]) => value === data.queue)?.[1]}</h3>
      {data.queue === "upcoming" ? <p className="section-copy">Due within the next 30 days, using the Dhaka calendar.</p> : null}
      {data.error ? <p role="alert">{data.error}</p> : <>
        <p className="section-copy mt-2">{data.total} matching records · page {data.page}</p>
        {canBulkReview ? <div className="flex flex-wrap items-center gap-4 mt-4">
          <label className="flex items-center gap-2"><input ref={master} type="checkbox" checked={available.length > 0 && selectedRows.length === available.length} disabled={pending || available.length === 0} onChange={event => setSelection(event.target.checked ? Object.fromEntries(available.map(row => [row.requestId!, bulkRowSnapshot(row)])) : {})} />Select all on this page</label>
          <span aria-live="polite">{selectedRows.length} selected</span>
          <button type="button" className="primary-button" disabled={pending || selectedRows.length === 0} onClick={() => setBulkDraft({ rows: selectedRows, baseline: result })}>Approve selected</button>
          <p className="section-copy">Up to 25 requests on this page only. Payments and waivers are reviewed individually.</p>
        </div> : null}
        {!bulkDraft && result.status !== "idle" ? <p role={result.status === "error" ? "alert" : "status"} className="mt-3">{result.message}</p> : null}
        {data.rows.length === 0 ? <p className="section-copy mt-4">No records on this queue page.</p> : <ul className="grid gap-4 mt-4">{data.rows.map((row) => {
          const canConfirm = row.joinedOn && row.dueOn && row.pathStatus === "open" && ["current", "former"].includes(row.lifecycleStatus);
          return <li className="admin-renewal-record" key={row.requestId || row.memberId}>
            {available.some(item => item.requestId === row.requestId) ? <label className="flex items-start gap-2 mb-3"><input type="checkbox" checked={selection[row.requestId!] === bulkRowSnapshot(row)} disabled={pending} onChange={event => setSelection(current => {
              const next = { ...current }; if (event.target.checked) next[row.requestId!] = bulkRowSnapshot(row); else delete next[row.requestId!]; return next;
            })} />Select {row.fullName} {row.jnuitsId}</label> : null}
            <h4 className="font-semibold break-words">{row.fullName} · {row.jnuitsId}</h4>
            <p className="section-copy">Joined {formatDhakaDate(row.joinedOn)} · Due {formatDhakaDate(row.dueOn)}{row.overdueDays > 0 ? ` · ${row.overdueDays} days overdue` : ""}</p>
            <p className="section-copy">Membership: {row.lifecycleStatus} · Path: {row.pathStatus.replaceAll("_", " ")} · Security: {row.portalAccessStatus}</p>
            {row.requestedAt ? <p className="section-copy">Requested {new Date(row.requestedAt).toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka" })}</p> : null}
            <div className="flex flex-wrap gap-2 mt-3">
              {!row.joinedOn ? <a className="ghost-button" href={`/admin/membership?memberId=${encodeURIComponent(row.memberId)}#member-operations`}>Correct joining date</a> : null}
              {row.requestId && row.requestType !== "membership_renewal" ? <button className="primary-button" type="button" disabled={pending || !row.requestUpdatedAt} onClick={() => setSelected(row)}>Review request</button> : canConfirm ? <button className="primary-button" type="button" disabled={pending} onClick={() => setSelected(row)}>Review anniversary</button> : null}
            </div>
          </li>;
        })}</ul>}
        <nav aria-label="Queue pagination" className="flex flex-wrap gap-3 mt-4">{data.page > 1 ? <a className="ghost-button" aria-label="Previous queue page" href={queueHref(data.queue, data.page - 1)}>Previous</a> : null}{data.page * data.pageSize < data.total ? <a className="ghost-button" aria-label="Next queue page" href={queueHref(data.queue, data.page + 1)}>Next</a> : null}</nav>
      </>}
      {selected ? <DecisionDialog key={selected.requestId || `${selected.memberId}:${selected.dueOn}`} row={selected} onClose={() => setSelected(null)} /> : null}
      {bulkDraft ? <BulkDecisionDialog rows={bulkDraft.rows} queue={data.queue as BulkReviewInput["queue"]} action={action} pending={pending}
        stale={bulkDraft.rows.some(row => !available.some(current => current.requestId === row.requestId && bulkRowSnapshot(current) === bulkRowSnapshot(row)))}
        result={bulkDraft.baseline === result ? initialBulkReviewResult : result} onClose={() => setBulkDraft(null)} /> : null}
    </section>
  );
}
