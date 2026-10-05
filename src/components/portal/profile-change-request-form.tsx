"use client";

import { startTransition, useState } from "react";
import { Clock3, FilePenLine, IdCard, Mail } from "lucide-react";
import type { Tables } from "@/lib/db/types";
import type { DepartmentOption } from "@/lib/departments.server";
import { formatMembershipIdForDisplay } from "@/lib/members/jnuits-id";

type ProfileChangeRequest = Tables<"profile_update_requests">;

function formatRequestStatus(status: string) {
  return status.replaceAll("_", " ");
}

export function ProfileChangeRequestForm({
  currentValues,
  departments,
  initialRequests,
}: {
  currentValues: {
    departmentCode: string | null;
    email: string | null;
    fullName: string;
    jnuitsId: string;
    studentId: string | null;
    batchNo: number | null;
    graduationYear: number | null;
  };
  departments: DepartmentOption[];
  initialRequests: ProfileChangeRequest[];
}) {
  const [requests, setRequests] = useState(initialRequests);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const displayJnuitsId = formatMembershipIdForDisplay(currentValues.jnuitsId);

  async function submitRequest(payload: Record<string, unknown>) {
    setPending(true);
    setError(null);
    setMessage(null);

    try {
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
    } catch { setError("Unable to reach the server. Please retry your request."); }
    finally { setPending(false); }
  }

  async function handleProfileSubmit(formData: FormData) {
    const identity = {
      fullName: String(formData.get("fullName") || "").trim(),
      departmentCode: String(formData.get("departmentCode") || "").trim(),
      studentId: String(formData.get("studentId") || "").trim(),
      batchNo: String(formData.get("batchNo") || "").trim(),
      graduationYear: String(formData.get("graduationYear") || "").trim(),
    };
    const changes = Object.fromEntries(Object.entries(identity)
      .filter(([key, value]) => value && value !== String(currentValues[key as keyof typeof currentValues] ?? ""))
      .map(([key, value]) => [key, key === "batchNo" || key === "graduationYear" ? Number(value) : value]));
    if (!Object.keys(changes).length) { setMessage("No identity fields changed."); return; }
    await submitRequest({ requestType: "profile_change", ...changes });
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
    <section className="profile-edit-wide-grid">
      <div className="profile-edit-card profile-edit-card--moderation">
        <div className="profile-edit-card__header">
          <div className="profile-edit-card__icon" data-tone="info">
            <FilePenLine size={18} />
          </div>
          <div>
            <p className="profile-edit-kicker">Profile moderation</p>
            <h2 className="profile-edit-title">
              Request moderated changes to core member profile fields
            </h2>
          </div>
        </div>

        <p className="profile-edit-copy">
          Changes to your name, university student ID, department, batch, graduation year, email and JnUITS ID require admin approval. Email changes also require verification of the current and new addresses.
        </p>

        <form
          action={(formData) => startTransition(() => void handleProfileSubmit(formData))}
          className="profile-edit-form-grid"
          id="profile-change-form"
        >
          <label className="input-label" htmlFor="pcr-full-name">
            Full name
            <input
              id="pcr-full-name"
              defaultValue={currentValues.fullName}
              name="fullName"
              autoComplete="name"
            />
          </label>
          <label className="input-label" htmlFor="pcr-student-id">University student ID<input id="pcr-student-id" name="studentId" defaultValue={currentValues.studentId ?? ""} maxLength={80} /></label>
          <label className="input-label" htmlFor="pcr-batch">Batch<input id="pcr-batch" name="batchNo" type="number" min={1} max={999} defaultValue={currentValues.batchNo ?? ""} /></label>
          <label className="input-label" htmlFor="pcr-graduation-year">Graduation year<input id="pcr-graduation-year" name="graduationYear" type="number" min={1950} max={2100} defaultValue={currentValues.graduationYear ?? ""} /></label>
          <label className="input-label profile-edit-span-2" htmlFor="pcr-department">
            Department
            <select
              defaultValue={currentValues.departmentCode || ""}
              id="pcr-department"
              name="departmentCode"
            >
              <option value="">Department pending</option>
              {departments.map((department) => (
                <option key={department.code} value={department.code}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>
          <div className="profile-edit-actions profile-edit-span-2">
            <button className="primary-button" disabled={pending} type="submit">
              {pending ? "Submitting..." : "Submit profile change"}
            </button>
          </div>
        </form>

        <div className="profile-edit-mini-grid">
          <form
            action={(formData) => startTransition(() => void handleEmailSubmit(formData))}
            className="profile-edit-mini-card"
          >
            <div className="profile-edit-mini-card__header">
              <Mail size={16} />
              <span>Login email</span>
            </div>
            <label className="input-label" htmlFor="pcr-new-email">
              Request login email change
              <input
                id="pcr-new-email"
                defaultValue={currentValues.email || ""}
                name="newEmail"
                type="email"
                autoComplete="email"
                required
              />
            </label>
            <p className="profile-edit-note">
              Approval sends verification links before the auth email changes.
            </p>
            <button className="secondary-button" disabled={pending} type="submit">
              Request email change
            </button>
          </form>

          <form
            action={(formData) => startTransition(() => void handleJnuitsIdSubmit(formData))}
            className="profile-edit-mini-card"
          >
            <div className="profile-edit-mini-card__header">
              <IdCard size={16} />
              <span>Membership ID</span>
            </div>
            <label className="input-label" htmlFor="pcr-new-jnuits-id">
              Request JnUITS ID change
              <input
                id="pcr-new-jnuits-id"
                defaultValue={displayJnuitsId}
                name="newJnuitsId"
                placeholder="JnUITS-2026001"
                required
              />
            </label>
            <p className="profile-edit-note">
              Approval checks that the requested ID is valid and unassigned.
            </p>
            <button className="secondary-button" disabled={pending} type="submit">
              Request ID change
            </button>
          </form>
        </div>

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
            <p className="profile-edit-kicker">Recent profile requests</p>
            <h2 className="profile-edit-side-title">Moderation history</h2>
          </div>
        </div>

        <div className="profile-edit-history-list">
          {requests.length === 0 ? (
            <div className="empty-state">
              No profile change requests yet. Your first request will appear here
              with its moderation state.
            </div>
          ) : (
            requests.map((request) => (
              <article key={request.id} className="timeline-item">
                <div className="profile-edit-history-row">
                  <strong>{request.request_type.replaceAll("_", " ")}</strong>
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
