"use client";

import { useState } from "react";

const STATUSES = ["", "unreviewed", "in_review", "approved", "rejected", "withdrawn"];

type Item = {
  confirmationStatus: string;
  createdAt: string;
  id: string;
  reviewStatus: string;
  submitterEmail: string | null;
  versionNumber: number | null;
};

export function FormSubmissionReviewPanel() {
  const [formId, setFormId] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    if (!formId) {
      setMessage("Choose a form definition ID from the inventory.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const search = new URLSearchParams({ pageSize: "25" });
      if (query.trim()) search.set("q", query.trim());
      if (status) search.set("status", status);
      const response = await fetch(
        `/api/admin/forms/${encodeURIComponent(formId)}/submissions?${search}`,
        { cache: "no-store" }
      );
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; items?: Item[]; totalItems?: number }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Submissions could not be loaded.");
      }
      setItems(payload?.items || []);
      setTotal(payload?.totalItems || 0);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Submissions could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      className="admin-review-card mt-6"
      aria-labelledby="submission-review-heading"
    >
      <p className="admin-section-label">Submission review</p>
      <h2 className="admin-card-row__title" id="submission-review-heading">
        Bounded reviewer queue
      </h2>
      <p className="mt-2 text-sm text-[var(--muted-foreground)]">
        Submission PII is loaded only through the protected review permission.
        Membership and alumni decisions remain in their canonical review queues.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_12rem_auto]">
        <label className="input-label">
          Form definition ID
          <input value={formId} onChange={(event) => setFormId(event.target.value)} />
        </label>
        <label className="input-label">
          Email search
          <input value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <label className="input-label">
          Review status
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            {STATUSES.map((value) => (
              <option key={value || "all"} value={value}>
                {value ? value.replaceAll("_", " ") : "All"}
              </option>
            ))}
          </select>
        </label>
        <button
          className="admin-btn admin-btn--primary self-end"
          disabled={loading}
          onClick={() => void load()}
          type="button"
        >
          {loading ? "Loading…" : "Load submissions"}
        </button>
      </div>
      {message ? (
        <p className="status-pill mt-4" role="alert">
          {message}
        </p>
      ) : null}
      {!loading && items.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="admin-responsive-table min-w-full text-left text-sm">
            <thead>
              <tr>
                <th className="p-2">Submitted</th>
                <th className="p-2">Email</th>
                <th className="p-2">Confirmation</th>
                <th className="p-2">Review</th>
                <th className="p-2">Version</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr className="border-t border-[var(--line)]" key={item.id}>
                  <td className="p-2" data-label="Submitted">
                    {new Date(item.createdAt).toLocaleString("en-BD")}
                  </td>
                  <td className="p-2" data-label="Email">
                    {item.submitterEmail || "Not supplied"}
                  </td>
                  <td className="p-2" data-label="Confirmation">
                    {item.confirmationStatus}
                  </td>
                  <td className="p-2" data-label="Review">
                    {item.reviewStatus}
                  </td>
                  <td className="p-2" data-label="Version">
                    {item.versionNumber ?? "Unknown"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !loading && formId && !message ? (
        <p className="mt-4 text-sm text-[var(--muted-foreground)]">
          No matching submissions. Total: {total}.
        </p>
      ) : null}
    </section>
  );
}
