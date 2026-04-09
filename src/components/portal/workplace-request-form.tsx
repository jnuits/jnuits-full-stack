"use client";

import { startTransition, useState } from "react";
import type { Tables } from "@/lib/db/types";

type WorkplaceRequest = Tables<"profile_update_requests">;

function formatRequestStatus(status: string) {
  return status.replaceAll("_", " ");
}

export function WorkplaceRequestForm({
  currentValues,
  initialRequests,
  memberType,
}: {
  currentValues: {
    currentOrganization: string | null;
    designation: string | null;
    linkedinUrl: string | null;
    professionalVisibility: string;
    websiteUrl: string | null;
    workLocation: string | null;
  };
  initialRequests: WorkplaceRequest[];
  memberType: string;
}) {
  const [requests, setRequests] = useState(initialRequests);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    setMessage(null);

    const payload = {
      currentOrganization:
        String(formData.get("currentOrganization") || "").trim() || undefined,
      designation: String(formData.get("designation") || "").trim() || undefined,
      workLocation: String(formData.get("workLocation") || "").trim() || undefined,
      linkedinUrl: String(formData.get("linkedinUrl") || "").trim() || undefined,
      websiteUrl: String(formData.get("websiteUrl") || "").trim() || undefined,
      professionalVisibility:
        String(formData.get("professionalVisibility") || "").trim() || undefined,
    };

    const response = await fetch("/api/alumni/workplace-updates", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const body = (await response.json().catch(() => null)) as
      | {
          data?: WorkplaceRequest;
          message?: string;
        }
      | null;

    if (!response.ok || !body?.data) {
      setError(body?.message || "Unable to submit workplace update request.");
      setPending(false);
      return;
    }

    setRequests((current) => [body.data as WorkplaceRequest, ...current]);
    setMessage(
      body.message ||
        "Workplace update request submitted. A moderator will review it before anything becomes visible."
    );
    setPending(false);
  }

  if (memberType !== "alumni") {
    return (
      <section className="section-band grid gap-4">
        <span className="eyebrow">Workplace moderation</span>
        <h2 className="font-[family-name:var(--font-heading)] text-[clamp(1.8rem,3vw,2.4rem)] leading-[0.96] tracking-[-0.04em]">
          Workplace self-service is reserved for alumni accounts
        </h2>
        <p className="section-copy">
          Current student and internal member profiles will keep using the safer
          member/profile update lanes instead of the alumni workplace workflow.
        </p>
      </section>
    );
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
      <div className="section-band grid gap-5">
        <div>
          <span className="eyebrow">Workplace request</span>
          <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(1.8rem,3vw,2.4rem)] leading-[0.96] tracking-[-0.04em]">
            Submit moderated workplace changes without touching admin tools
          </h2>
        </div>
        <p className="section-copy">
          Alumni edits to workplace identity remain request-based so moderators
          can review claims, preserve auditability, and protect the public
          directory from accidental drift.
        </p>

        <form
          action={(formData) => startTransition(() => void handleSubmit(formData))}
          className="portal-form-grid"
          id="workplace-request-form"
        >
          <label className="input-label" htmlFor="wp-organization">
            Current organization
            <input
              id="wp-organization"
              defaultValue={currentValues.currentOrganization || ""}
              name="currentOrganization"
              placeholder="Organization or company"
              autoComplete="organization"
            />
          </label>
          <label className="input-label" htmlFor="wp-designation">
            Designation
            <input
              id="wp-designation"
              defaultValue={currentValues.designation || ""}
              name="designation"
              placeholder="Role or designation"
              autoComplete="organization-title"
            />
          </label>
          <label className="input-label" htmlFor="wp-work-location">
            Work location
            <input
              id="wp-work-location"
              defaultValue={currentValues.workLocation || ""}
              name="workLocation"
              placeholder="City, region, or country"
            />
          </label>
          <label className="input-label" htmlFor="wp-visibility">
            Visibility
            <select
              id="wp-visibility"
              defaultValue={currentValues.professionalVisibility}
              name="professionalVisibility"
            >
              <option value="public">Public</option>
              <option value="members-only">Members only</option>
              <option value="private">Private</option>
            </select>
          </label>
          <label className="input-label" htmlFor="wp-linkedin-url">
            LinkedIn URL
            <input
              id="wp-linkedin-url"
              defaultValue={currentValues.linkedinUrl || ""}
              name="linkedinUrl"
              placeholder="https://linkedin.com/in/..."
              type="url"
              autoComplete="url"
            />
          </label>
          <label className="input-label" htmlFor="wp-website-url">
            Website URL
            <input
              id="wp-website-url"
              defaultValue={currentValues.websiteUrl || ""}
              name="websiteUrl"
              placeholder="https://your-site.example"
              type="url"
              autoComplete="url"
            />
          </label>
          <div className="flex flex-wrap gap-3 sm:col-span-2">
            <button className="primary-button" disabled={pending} type="submit">
              {pending ? "Submitting..." : "Submit moderated update"}
            </button>
          </div>
        </form>

        {message ? <p className="portal-message portal-message--success">{message}</p> : null}
        {error ? <p className="portal-message portal-message--error">{error}</p> : null}
      </div>

      <div className="section-band">
        <span className="eyebrow">Recent requests</span>
        <div className="mt-5 grid gap-3">
          {requests.length === 0 ? (
            <div className="empty-state">
              No workplace requests yet. Your first submission will appear here
              with its moderation status.
            </div>
          ) : (
            requests.map((request) => (
              <article key={request.id} className="timeline-item">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="font-[family-name:var(--font-heading)] text-lg">
                    Workplace update
                  </strong>
                  <span className="status-pill">
                    {formatRequestStatus(request.status)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Requested{" "}
                  {new Date(request.requested_at).toLocaleDateString("en-BD", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
                {request.review_note ? (
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                    {request.review_note}
                  </p>
                ) : null}
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
