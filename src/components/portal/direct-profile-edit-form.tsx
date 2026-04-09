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
          <div className="flex flex-wrap gap-3 sm:col-span-2">
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
