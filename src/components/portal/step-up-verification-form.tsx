"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";

export function StepUpVerificationForm({
  initiallyActive,
  username,
}: {
  initiallyActive: boolean;
  username?: null | string;
}) {
  const router = useRouter();
  const [active, setActive] = useState(initiallyActive);
  const [message, setMessage] = useState<string | null>(
    initiallyActive
      ? "Direct edits are already unlocked for this browser session."
      : null
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    setMessage(null);

    const response = await fetch("/api/profile/step-up", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        currentPassword: String(formData.get("currentPassword") || ""),
      }),
    });

    const body = (await response.json().catch(() => null)) as
      | { message?: string; verified?: boolean }
      | null;

    if (!response.ok || !body?.verified) {
      setActive(false);
      setError(body?.message || "Step-up verification failed.");
      setPending(false);
      return;
    }

    setActive(true);
    setMessage(body.message || "Step-up verification succeeded.");
    setPending(false);
    router.refresh();
  }

  async function clearStepUp() {
    setPending(true);
    setError(null);
    setMessage(null);

    await fetch("/api/profile/step-up", {
      method: "DELETE",
    });

    setActive(false);
    setMessage("Direct edit unlock was cleared for this browser.");
    setPending(false);
    router.refresh();
  }

  return (
    <section className="profile-edit-card profile-edit-card--hero">
      <div className="profile-edit-card__header">
        <div className="profile-edit-card__icon" data-tone={active ? "success" : "locked"}>
          {active ? <ShieldCheck size={18} /> : <LockKeyhole size={18} />}
        </div>
        <div>
          <p className="profile-edit-kicker">Step-up verification</p>
          <h2 className="profile-edit-title">
            Unlock direct profile edits with your current password
          </h2>
        </div>
        <span className="profile-edit-status" data-state={active ? "complete" : "locked"}>
          {active ? "Direct edit unlocked" : "Verification required"}
        </span>
      </div>

      <p className="profile-edit-copy">
        Sensitive profile edits now support a final step-up policy. Verification
        is short-lived, device-scoped, and separate from the directory
        visibility cookie.
      </p>

      <form
        id="step-up-verification-form"
        action={(formData) => startTransition(() => void handleSubmit(formData))}
        className="profile-edit-form-grid"
      >
        <input
          autoComplete="username"
          hidden
          name="username"
          readOnly
          type="email"
          value={username || ""}
        />
        <label className="input-label profile-edit-span-2" htmlFor="su-current-password">
          Current password
          <input
            id="su-current-password"
            autoComplete="current-password"
            name="currentPassword"
            placeholder="Enter your current password"
            required
            type="password"
          />
        </label>
        <div className="profile-edit-actions profile-edit-span-2">
          <button className="primary-button" disabled={pending} type="submit">
            {pending ? "Verifying..." : "Verify and unlock"}
          </button>
          {active ? (
            <button
              className="secondary-button"
              disabled={pending}
              onClick={() => startTransition(() => void clearStepUp())}
              type="button"
            >
              Clear unlock
            </button>
          ) : null}
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
    </section>
  );
}
