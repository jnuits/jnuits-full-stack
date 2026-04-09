"use client";

import { startTransition, useState } from "react";

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
    <section className="section-band grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="eyebrow">Directory gate</span>
          <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(1.8rem,3vw,2.4rem)] leading-[0.96] tracking-[-0.04em]">
            Verify your directory session before exposing sensitive workplace data
          </h2>
        </div>
        <span className="status-pill">
          {verified ? "Verified for this browser" : "Verification required"}
        </span>
      </div>

      <p className="section-copy">
        Workplace details are intentionally hidden until the claimed member
        account proves possession of its directory verification code. The cookie
        is short-lived and scoped to this signed-in account only.
      </p>

      <form
        id="directory-verification-form"
        action={(formData) => startTransition(() => void handleSubmit(formData))}
        className="portal-form-grid"
      >
        <label className="input-label sm:col-span-2" htmlFor="dv-jnuits-id">
          JnUITS ID
          <input id="dv-jnuits-id" value={jnuitsId} readOnly name="jnuitsId" />
        </label>
        <label className="input-label sm:col-span-2" htmlFor="dv-verification-code">
          Directory verification code
          <input
            id="dv-verification-code"
            autoComplete="one-time-code"
            name="verificationCode"
            placeholder="Enter your verification code"
            required
          />
        </label>
        <div className="flex flex-wrap gap-3 sm:col-span-2">
          <button className="primary-button" disabled={pending} type="submit">
            {pending ? "Verifying..." : "Verify directory access"}
          </button>
        </div>
      </form>

      {message ? <p className="portal-message portal-message--success">{message}</p> : null}
      {error ? <p className="portal-message portal-message--error">{error}</p> : null}
    </section>
  );
}
