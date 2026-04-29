"use client";

import { startTransition, useState } from "react";
import { BriefcaseBusiness, Clock3, LockKeyhole } from "lucide-react";
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
        "Workplace update request submitted. An admin will review it before anything becomes visible."
    );
    setPending(false);
  }

  if (memberType !== "alumni") {
    return (
      <section className="profile-edit-card profile-edit-card--muted">
        <div className="profile-edit-card__header">
          <div className="profile-edit-card__icon" data-tone="locked">
            <LockKeyhole size={18} />
          </div>
          <div>
            <p className="profile-edit-kicker">Workplace moderation</p>
            <h2 className="profile-edit-title">
              Workplace self-service is reserved for alumni accounts
            </h2>
          </div>
        </div>
        <p className="profile-edit-copy">
          Current student and internal member profiles will keep using the safer
          member/profile update lanes instead of the alumni workplace workflow.
        </p>
      </section>
    );
  }

  return (
    <section className="profile-edit-wide-grid">
      <div className="profile-edit-card profile-edit-card--workplace">
        <div className="profile-edit-card__header">
          <div className="profile-edit-card__icon" data-tone="info">
            <BriefcaseBusiness size={18} />
          </div>
          <div>
            <p className="profile-edit-kicker">Workplace request</p>
            <h2 className="profile-edit-title">
              Submit moderated workplace changes without touching admin tools
            </h2>
          </div>
        </div>
        <p className="profile-edit-copy">
          Alumni edits to workplace identity remain request-based so admins
          can review claims, preserve auditability, and protect the public
          directory from accidental drift.
        </p>

        <form
          action={(formData) => startTransition(() => void handleSubmit(formData))}
          className="profile-edit-form-grid"
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
          <div className="profile-edit-actions profile-edit-span-2">
            <button className="primary-button" disabled={pending} type="submit">
              {pending ? "Submitting..." : "Submit moderated update"}
            </button>
          </div>
        </form>

        {message ? (
          <p className="portal-message portal-message--success" aria-live="polite">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="portal-message portal-message--error" aria-live="assertive">
            {error}
          </p>
        ) : null}
      </div>

      <aside className="profile-edit-card profile-edit-card--history">
        <div className="profile-edit-card__header">
          <div className="profile-edit-card__icon" data-tone="pending">
            <Clock3 size={18} />
          </div>
          <div>
            <p className="profile-edit-kicker">Recent requests</p>
            <h2 className="profile-edit-side-title">Workplace history</h2>
          </div>
        </div>
        <div className="profile-edit-history-list">
          {requests.length === 0 ? (
            <div className="empty-state">
              No workplace requests yet. Your first submission will appear here
              with its moderation status.
            </div>
          ) : (
            requests.map((request) => (
              <article key={request.id} className="timeline-item">
                <div className="profile-edit-history-row">
                  <strong>Workplace update</strong>
                  <span className="profile-edit-status" data-state="pending">
                    {formatRequestStatus(request.status)}
                  </span>
                </div>
                <p className="profile-edit-history-date">
                  Requested{" "}
                  {new Date(request.requested_at).toLocaleDateString("en-BD", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
                {request.review_note ? (
                  <p className="profile-edit-note">{request.review_note}</p>
                ) : null}
              </article>
            ))
          )}
        </div>
      </aside>
    </section>
  );
}
