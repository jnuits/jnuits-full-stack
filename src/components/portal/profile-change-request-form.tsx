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
    email: string | null;
    fullName: string;
    jnuitsId: string;
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

  async function submitRequest(payload: Record<string, unknown>) {
    setPending(true);
    setError(null);
    setMessage(null);

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

  async function handleProfileSubmit(formData: FormData) {
    await submitRequest({
      requestType: "profile_change",
      fullName: String(formData.get("fullName") || "").trim() || undefined,
      linkedinUrl: String(formData.get("linkedinUrl") || "").trim() || undefined,
      phone: String(formData.get("phone") || "").trim() || undefined,
      websiteUrl: String(formData.get("websiteUrl") || "").trim() || undefined,
    });
  }

  async function handleEmailSubmit(formData: FormData) {
    await submitRequest({
      requestType: "email_change",
      newEmail: String(formData.get("newEmail") || "").trim(),
    });
  }

  async function handleJnuitsIdSubmit(formData: FormData) {
    await submitRequest({
      requestType: "jnuits_id_change",
      newJnuitsId: String(formData.get("newJnuitsId") || "").trim(),
    });
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
          Changes to your name, phone, social links, login email, and JnUITS ID
          are reviewed by an operator before they apply to your member record.
        </p>

        <form
          action={(formData) => startTransition(() => void handleProfileSubmit(formData))}
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

        <div className="grid gap-4 md:grid-cols-2">
          <form
            action={(formData) => startTransition(() => void handleEmailSubmit(formData))}
            className="rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] p-4"
          >
            <label className="input-label" htmlFor="pcr-new-email">
              Request login email change
              <input
                id="pcr-new-email"
                defaultValue={currentValues.email || ""}
                name="newEmail"
                type="email"
                autoComplete="email"
              />
            </label>
            <p className="section-copy mt-2">
              After approval, verification links are sent before the auth email
              change is completed.
            </p>
            <button className="secondary-button mt-4" disabled={pending} type="submit">
              Request email change
            </button>
          </form>

          <form
            action={(formData) => startTransition(() => void handleJnuitsIdSubmit(formData))}
            className="rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] p-4"
          >
            <label className="input-label" htmlFor="pcr-new-jnuits-id">
              Request JnUITS ID change
              <input
                id="pcr-new-jnuits-id"
                defaultValue={currentValues.jnuitsId}
                name="newJnuitsId"
                placeholder="JNUITS-2026001"
              />
            </label>
            <p className="section-copy mt-2">
              Admin approval checks that the requested ID is valid and not
              already assigned.
            </p>
            <button className="secondary-button mt-4" disabled={pending} type="submit">
              Request ID change
            </button>
          </form>
        </div>

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
                    {request.request_type.replaceAll("_", " ")}
                  </strong>
                  <span className="status-pill">
                    {formatRequestStatus(request.status)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                  Requested{" "}
                  {new Date(request.requested_at).toLocaleDateString("en-BD", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
                {request.review_note ? (
                  <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">
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
