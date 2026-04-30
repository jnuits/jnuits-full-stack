"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import { CheckCircle2, LockKeyhole, Route } from "lucide-react";
import type { DepartmentOption } from "@/lib/departments.server";

export function DirectProfileEditForm({
  currentValues,
  departments,
  stepUpActive,
}: {
  currentValues: {
    departmentCode: string | null;
    facebookUrl: string | null;
    fullName: string;
    linkedinUrl: string | null;
    phone: string | null;
    websiteUrl: string | null;
  };
  departments: DepartmentOption[];
  stepUpActive: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    setMessage(null);

    const response = await fetch("/api/profile/direct", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        departmentCode: String(formData.get("departmentCode") || "").trim(),
        facebookUrl:
          String(formData.get("facebookUrl") || "").trim() || undefined,
        fullName: String(formData.get("fullName") || "").trim() || undefined,
        linkedinUrl:
          String(formData.get("linkedinUrl") || "").trim() || undefined,
        phone: String(formData.get("phone") || "").trim() || undefined,
        websiteUrl:
          String(formData.get("websiteUrl") || "").trim() || undefined,
      }),
    });

    const body = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;

    if (!response.ok) {
      setError(body?.message || "Direct profile save failed.");
      setPending(false);
      return;
    }

    setMessage(body?.message || "Direct profile changes saved.");
    setPending(false);
    router.refresh();
  }

  return (
    <section className="profile-edit-card profile-edit-card--direct">
      <div className="profile-edit-card__header">
        <div className="profile-edit-card__icon" data-tone={stepUpActive ? "success" : "locked"}>
          {stepUpActive ? <CheckCircle2 size={18} /> : <LockKeyhole size={18} />}
        </div>
        <div>
          <p className="profile-edit-kicker">Direct profile edit</p>
          <h2 className="profile-edit-title">
            Update low-risk identity fields without entering the admin queue
          </h2>
        </div>
      </div>

      <p className="profile-edit-copy">
        This path is available only after a successful step-up verification.
        Moderated requests remain available below for review-first handling.
      </p>

      <form
        action={(formData) => startTransition(() => void handleSubmit(formData))}
        className="profile-edit-form-grid"
        id="direct-profile-edit-form"
      >
        <label className="input-label" htmlFor="dpe-full-name">
          Full name
          <input
            id="dpe-full-name"
            defaultValue={currentValues.fullName}
            name="fullName"
            autoComplete="name"
            placeholder="Your full name"
          />
        </label>
        <label className="input-label" htmlFor="dpe-phone">
          Phone
          <input
            id="dpe-phone"
            defaultValue={currentValues.phone || ""}
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="+880 1xxx xxxxxx"
          />
        </label>
        <label className="input-label" htmlFor="dpe-linkedin-url">
          LinkedIn URL
          <input
            id="dpe-linkedin-url"
            defaultValue={currentValues.linkedinUrl || ""}
            name="linkedinUrl"
            type="url"
            autoComplete="url"
            placeholder="https://linkedin.com/in/..."
          />
        </label>
        <label className="input-label" htmlFor="dpe-facebook-url">
          Facebook URL
          <input
            autoComplete="url"
            defaultValue={currentValues.facebookUrl || ""}
            id="dpe-facebook-url"
            name="facebookUrl"
            placeholder="https://facebook.com/..."
            type="url"
          />
        </label>
        <label className="input-label" htmlFor="dpe-website-url">
          Website URL
          <input
            id="dpe-website-url"
            defaultValue={currentValues.websiteUrl || ""}
            name="websiteUrl"
            type="url"
            autoComplete="url"
            placeholder="https://your-site.example"
          />
        </label>
        <label className="input-label profile-edit-span-2" htmlFor="dpe-department">
          Department
          <select
            defaultValue={currentValues.departmentCode || ""}
            id="dpe-department"
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
          <button
            className="primary-button"
            disabled={!stepUpActive || pending}
            type="submit"
            aria-disabled={!stepUpActive || pending}
          >
            {pending ? "Saving..." : "Save direct changes"}
          </button>
        </div>
      </form>

      <div className="profile-edit-state-list" aria-label="Direct edit access state">
        <article className="profile-edit-state-card" data-state={stepUpActive ? "complete" : "locked"}>
          {stepUpActive ? <CheckCircle2 size={16} /> : <LockKeyhole size={16} />}
          <div>
            <h3>{stepUpActive ? "Unlocked for this session" : "Locked until verified"}</h3>
            <p>
              {stepUpActive
                ? "This browser can save direct profile edits now."
                : "Use the password verification form before submitting."}
            </p>
          </div>
        </article>
        <article className="profile-edit-state-card" data-state="idle">
          <Route size={16} />
          <div>
            <h3>Fallback path</h3>
            <p>Use the moderated request queue when a change needs review.</p>
          </div>
        </article>
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
    </section>
  );
}
