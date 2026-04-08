"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

export function DirectProfileEditForm({
  currentValues,
  stepUpActive,
}: {
  currentValues: {
    fullName: string;
    linkedinUrl: string | null;
    phone: string | null;
    websiteUrl: string | null;
  };
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
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.06fr)_minmax(18rem,0.94fr)]">
      <div className="section-band grid gap-5">
        <div>
          <span className="eyebrow">Direct profile edit</span>
          <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(1.8rem,3vw,2.4rem)] leading-[0.96] tracking-[-0.04em]">
            Update core identity fields without entering the admin queue
          </h2>
        </div>
        <p className="section-copy">
          This path is available only after a successful step-up verification.
          It is intended for low-risk self-service changes, while moderated
          requests remain available as a fallback lane.
        </p>

        <form
          action={(formData) => startTransition(() => void handleSubmit(formData))}
          className="portal-form-grid"
        >
          <label className="input-label">
            Full name
            <input defaultValue={currentValues.fullName} name="fullName" />
          </label>
          <label className="input-label">
            Phone
            <input defaultValue={currentValues.phone || ""} name="phone" />
          </label>
          <label className="input-label">
            LinkedIn URL
            <input
              defaultValue={currentValues.linkedinUrl || ""}
              name="linkedinUrl"
              type="url"
            />
          </label>
          <label className="input-label">
            Website URL
            <input
              defaultValue={currentValues.websiteUrl || ""}
              name="websiteUrl"
              type="url"
            />
          </label>
          <div className="flex flex-wrap gap-3 sm:col-span-2">
            <button
              className="primary-button"
              disabled={!stepUpActive || pending}
              type="submit"
            >
              {pending ? "Saving..." : "Save direct changes"}
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
        <span className="eyebrow">Access state</span>
        <div className="mt-5 grid gap-3">
          <article className="route-tile">
            <h3>{stepUpActive ? "Unlocked for 15 minutes" : "Locked until verified"}</h3>
            <p>
              {stepUpActive
                ? "This browser can save direct profile edits right now."
                : "Use the step-up form to unlock direct edits before submitting this form."}
            </p>
          </article>
          <article className="route-tile">
            <h3>Fallback path</h3>
            <p>
              If you prefer review-first handling, the moderated profile request
              queue remains available below.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
