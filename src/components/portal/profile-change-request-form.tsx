"use client";

import { startTransition, useState } from "react";
import type { Tables } from "@/lib/db/types";

type ProfileChangeRequest = Tables<"profile_update_requests">;

function formatRequestStatus(status: string) {
  return status.replaceAll("_", " ");
}

export function ProfileChangeRequestForm({
  currentValues,
  initialRequests,
}: {
  currentValues: {
    fullName: string;
    linkedinUrl: string | null;
    phone: string | null;
    websiteUrl: string | null;
  };
  initialRequests: ProfileChangeRequest[];
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
      fullName: String(formData.get("fullName") || "").trim() || undefined,
      linkedinUrl: String(formData.get("linkedinUrl") || "").trim() || undefined,
      phone: String(formData.get("phone") || "").trim() || undefined,
      websiteUrl: String(formData.get("websiteUrl") || "").trim() || undefined,
    };

    const response = await fetch("/api/profile/change-requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const body = (await response.json().catch(() => null)) as
      | {
          data?: ProfileChangeRequest;
          message?: string;
        }
      | null;

    if (!response.ok || !body?.data) {
      setError(body?.message || "Unable to submit profile change request.");
      setPending(false);
      return;
    }

    setRequests((current) => [body.data as ProfileChangeRequest, ...current]);
    setMessage(
      body.message ||
        "Profile change request submitted. An operator will review it before any identity field is changed."
    );
    setPending(false);
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.06fr)_minmax(18rem,0.94fr)]">
      <div className="section-band grid gap-5">
        <div>
          <span className="eyebrow">Profile moderation</span>
          <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(1.8rem,3vw,2.4rem)] leading-[0.96] tracking-[-0.04em]">
            Request moderated changes to core member profile fields
          </h2>
        </div>
        <p className="section-copy">
          Changes to your name, phone, and social links are reviewed by a
          moderator before they apply to the public directory.
        </p>

        <form
          action={(formData) => startTransition(() => void handleSubmit(formData))}
          className="portal-form-grid"
          id="profile-change-form"
        >
          <label className="input-label" htmlFor="pcr-full-name">
            Full name
            <input id="pcr-full-name" defaultValue={currentValues.fullName} name="fullName" autoComplete="name" />
          </label>
          <label className="input-label" htmlFor="pcr-phone">
            Phone
            <input id="pcr-phone" defaultValue={currentValues.phone || ""} name="phone" type="tel" autoComplete="tel" />
          </label>
          <label className="input-label" htmlFor="pcr-linkedin-url">
            LinkedIn URL
            <input
              id="pcr-linkedin-url"
              defaultValue={currentValues.linkedinUrl || ""}
              name="linkedinUrl"
              type="url"
              autoComplete="url"
              placeholder="https://linkedin.com/in/..."
            />
          </label>
          <label className="input-label" htmlFor="pcr-website-url">
            Website URL
            <input
              id="pcr-website-url"
              defaultValue={currentValues.websiteUrl || ""}
              name="websiteUrl"
              type="url"
              autoComplete="url"
              placeholder="https://your-site.example"
            />
          </label>
          <div className="flex flex-wrap gap-3 sm:col-span-2">
            <button className="primary-button" disabled={pending} type="submit">
              {pending ? "Submitting..." : "Submit profile change"}
            </button>
          </div>
        </form>

        {message ? (
          <p className="portal-message portal-message--success">{message}</p>
        ) : null}
        {error ? (
          <p className="portal-message portal-message--error">{error}</p>
        ) : null}
      </div>

      <div className="section-band">
        <span className="eyebrow">Recent profile requests</span>
        <div className="mt-5 grid gap-3">
          {requests.length === 0 ? (
            <div className="empty-state">
              No profile change requests yet. Your first request will appear here
              with its moderation state.
            </div>
          ) : (
            requests.map((request) => (
              <article key={request.id} className="timeline-item">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="font-[family-name:var(--font-heading)] text-lg">
                    Profile change
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
