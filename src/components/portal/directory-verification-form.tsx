"use client";

import { startTransition, useState } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { formatMembershipIdForDisplay } from "@/lib/members/jnuits-id";

export function DirectoryVerificationForm({
  initiallyVerified,
  jnuitsId,
}: {
  initiallyVerified: boolean;
  jnuitsId: string;
}) {
  const [verified, setVerified] = useState(initiallyVerified);
  const [message, setMessage] = useState<string | null>(
    initiallyVerified
      ? "Directory verification is already active for this browser session."
      : null
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const displayJnuitsId = formatMembershipIdForDisplay(jnuitsId);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    setMessage(null);

    const payload = {
      jnuitsId,
      verificationCode: String(formData.get("verificationCode") || "").trim(),
    };

    const response = await fetch("/api/members/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const body = (await response.json().catch(() => null)) as
      | { message?: string; verified?: boolean }
      | null;

    if (!response.ok) {
      setVerified(false);
      setError(body?.message || "Directory verification failed.");
      setPending(false);
      return;
    }

    setVerified(Boolean(body?.verified));
    setMessage(
      body?.message ||
        "Directory verification succeeded. Sensitive directory fields are now visible for one hour on this device."
    );
    setPending(false);
  }

  return (
    <section className="profile-edit-card profile-edit-card--directory">
      <div className="profile-edit-card__header">
        <div className="profile-edit-card__icon" data-tone={verified ? "success" : "locked"}>
          {verified ? <ShieldCheck size={18} /> : <LockKeyhole size={18} />}
        </div>
        <div>
          <p className="profile-edit-kicker">Directory gate</p>
          <h2 className="profile-edit-title">
            Verify directory session
          </h2>
        </div>
        <span className="profile-edit-status" data-state={verified ? "complete" : "locked"}>
          {verified ? "Verified for this browser" : "Verification required"}
        </span>
      </div>

      <p className="profile-edit-copy">
        Workplace details are intentionally hidden until the claimed member
        account proves possession of its directory verification code. The cookie
        is short-lived and scoped to this signed-in account only.
      </p>

      <form
        id="directory-verification-form"
        action={(formData) => startTransition(() => void handleSubmit(formData))}
        className="profile-edit-form-grid profile-edit-form-grid--single"
      >
        <label className="input-label" htmlFor="dv-jnuits-id">
          JnUITS ID
          <input id="dv-jnuits-id" value={displayJnuitsId} readOnly name="jnuitsId" />
        </label>
        <label className="input-label" htmlFor="dv-verification-code">
          Directory verification code
          <input
            id="dv-verification-code"
            autoComplete="one-time-code"
            name="verificationCode"
            placeholder="Enter your verification code"
            required
          />
        </label>
        <div className="profile-edit-actions">
          <button className="primary-button" disabled={pending} type="submit">
            {pending ? "Verifying..." : "Verify directory access"}
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
    </section>
  );
}
