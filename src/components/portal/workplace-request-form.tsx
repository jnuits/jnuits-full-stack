"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Tables } from "@/lib/db/types";

/** Existing requests remain reviewable; new workplace edits use the direct form. */
export function WorkplaceRequestHistory({ initialRequests }: { initialRequests: Tables<"profile_update_requests">[] }) {
  const router = useRouter();
  const [requests, setRequests] = useState(initialRequests);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function cancel(requestId: string) {
    setPending(true); setError(null);
    try {
      const response = await fetch("/api/portal/workplace-requests", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel", requestId }) });
      const body = await response.json().catch(() => null);
      if (!response.ok) { setError(body?.message || "Unable to cancel this request."); return; }
      setRequests((rows) => rows.map((row) => row.id === requestId ? { ...row, status: "cancelled" } : row)); router.refresh();
    } catch { setError("Unable to reach the server. Please retry."); } finally { setPending(false); }
  }
  if (!requests.length) return null;
  return <section className="profile-edit-card profile-edit-card--history" aria-label="Earlier workplace requests">
    <h2 className="profile-edit-side-title">Earlier workplace requests</h2>
    <p className="profile-edit-copy">These requests were submitted under the previous approval policy. New workplace edits save directly above. An older request cannot overwrite a newer direct edit.</p>
    {requests.map((row) => <article key={row.id} className="timeline-item"><strong>{row.status.replaceAll("_", " ")}</strong><p>Requested {new Date(row.requested_at).toLocaleDateString("en-BD")}</p>{row.review_note ? <p>{row.review_note}</p> : null}{row.status === "pending" ? <button className="secondary-button" type="button" disabled={pending} onClick={() => void cancel(row.id)}>{pending ? "Cancelling..." : "Cancel pending request"}</button> : null}</article>)}
    {error ? <p className="portal-message portal-message--error" role="alert">{error}</p> : null}
  </section>;
}
