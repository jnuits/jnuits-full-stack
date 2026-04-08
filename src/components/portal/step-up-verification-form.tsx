"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

export function StepUpVerificationForm({
  initiallyActive,
}: {
  initiallyActive: boolean;
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
    <section className="section-band grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="eyebrow">Step-up verification</span>
          <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(1.8rem,3vw,2.4rem)] leading-[0.96] tracking-[-0.04em]">
            Unlock direct profile edits with your current password
          </h2>
        </div>
        <span className="status-pill">
          {active ? "Direct edit unlocked" : "Verification required"}
        </span>
      </div>

      <p className="section-copy">
        Sensitive profile edits now support a final step-up policy. Verification
        is short-lived, device-scoped, and separate from the directory
        visibility cookie.
      </p>

      <form
        action={(formData) => startTransition(() => void handleSubmit(formData))}
        className="portal-form-grid"
      >
        <label className="input-label sm:col-span-2">
          Current password
          <input
            autoComplete="current-password"
            name="currentPassword"
            placeholder="Enter your current password"
            type="password"
          />
        </label>
        <div className="flex flex-wrap gap-3 sm:col-span-2">
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
        <p className="portal-message portal-message--success">{message}</p>
      ) : null}
      {error ? (
        <p className="portal-message portal-message--error">{error}</p>
      ) : null}
    </section>
  );
}
