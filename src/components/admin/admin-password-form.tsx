"use client";

import { updateCurrentPassword } from "@/app/(auth)/actions";
import { getPasswordPolicyError } from "@/lib/security/password-policy";
import { getPasswordExposureError } from "@/lib/security/pwned-passwords";
import { startTransition, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function AdminPasswordForm() {
  const [message, setMessage] = useState<null | string>(null);
  const [error, setError] = useState<null | string>(null);
  const [pending, setPending] = useState(false);
  const [reauthPending, setReauthPending] = useState(false);
  const [stepUpRequired, setStepUpRequired] = useState(false);
  const [stepUpPassword, setStepUpPassword] = useState("");
  const [verifyingStepUp, setVerifyingStepUp] = useState(false);
  const lastAttemptRef = useRef<{
    confirmPassword: string;
    nonce: string;
    password: string;
  } | null>(null);

  async function submitUpdate(attempt: {
    confirmPassword: string;
    nonce: string;
    password: string;
  }) {
    const result = await updateCurrentPassword(attempt);

    if (!result.ok) {
      if ("requiresStepUp" in result && result.requiresStepUp) {
        setStepUpRequired(true);
        lastAttemptRef.current = attempt;
      }
      setError(result.message);
      setPending(false);
      return;
    }

    setStepUpRequired(false);
    setStepUpPassword("");
    lastAttemptRef.current = null;
    setMessage(result.message);
    setPending(false);
  }

  async function handleUpdate(formData: FormData) {
    const password = String(formData.get("password") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");
    const nonce = String(formData.get("nonce") || "").trim();

    setError(null);
    setMessage(null);

    const policyError = getPasswordPolicyError(password);
    if (policyError) {
      setError(policyError);
      return;
    }

    if (password !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setPending(true);
    const exposureError = await getPasswordExposureError(password);
    if (exposureError) {
      setError(exposureError);
      setPending(false);
      return;
    }

    await submitUpdate({
      confirmPassword,
      nonce,
      password,
    });
  }

  async function verifyAndRetry() {
    if (!lastAttemptRef.current || !stepUpPassword) {
      setError("Enter your current password to continue.");
      return;
    }

    setVerifyingStepUp(true);
    setError(null);

    try {
      const response = await fetch("/api/profile/step-up", {
        body: JSON.stringify({ currentPassword: stepUpPassword }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        setError(payload?.message || "Current password verification failed.");
        setVerifyingStepUp(false);
        return;
      }
    } catch {
      setError("Verification request failed. Check your connection and retry.");
      setVerifyingStepUp(false);
      return;
    }

    setVerifyingStepUp(false);
    setStepUpPassword("");
    setPending(true);
    await submitUpdate(lastAttemptRef.current);
  }

  async function requestReauthenticationCode() {
    setError(null);
    setMessage(null);
    setReauthPending(true);

    const supabase = createClient();
    const { error: reauthError } = await supabase.auth.reauthenticate();

    if (reauthError) {
      setError(reauthError.message);
      setReauthPending(false);
      return;
    }

    setMessage(
      "A reauthentication code has been sent to your confirmed admin email address."
    );
    setReauthPending(false);
  }

  return (
    <div className="grid gap-5">
      <form
        action={(formData) => startTransition(() => void handleUpdate(formData))}
        className="grid gap-4 sm:grid-cols-2"
      >
        <label className="input-label sm:col-span-2" htmlFor="admin-password">
          New password
          <input
            autoComplete="new-password"
            id="admin-password"
            name="password"
            placeholder="Use 12 or more characters"
            type="password"
          />
        </label>
        <p className="-mt-2 text-xs leading-5 text-[var(--muted-foreground)] sm:col-span-2">
          Use a long, unique passphrase. Common passwords and passwords based on
          your email are rejected.
        </p>
        <label className="input-label sm:col-span-2" htmlFor="admin-confirm-password">
          Confirm password
          <input
            autoComplete="new-password"
            id="admin-confirm-password"
            name="confirmPassword"
            placeholder="Re-enter the new password"
            type="password"
          />
        </label>
        <label className="input-label sm:col-span-2" htmlFor="admin-password-nonce">
          Reauthentication code
          <input
            autoComplete="one-time-code"
            id="admin-password-nonce"
            name="nonce"
            placeholder="Paste the code if Supabase asks for reauthentication"
          />
        </label>
        {stepUpRequired ? (
          <div className="sm:col-span-2 grid gap-2 rounded-lg border border-[var(--line)] p-3">
            <label className="input-label" htmlFor="admin-stepup-password">
              Verify current password
              <input
                autoComplete="current-password"
                id="admin-stepup-password"
                onChange={(event) => setStepUpPassword(event.target.value)}
                placeholder="Enter the password you signed in with"
                type="password"
                value={stepUpPassword}
              />
            </label>
            <p className="-mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
              Password changes require a fresh current-password verification.
            </p>
            <button
              className="secondary-button"
              disabled={
                verifyingStepUp ||
                !stepUpPassword ||
                pending
              }
              onClick={() => startTransition(() => void verifyAndRetry())}
              type="button"
            >
              {verifyingStepUp ? "Verifying..." : "Verify and update password"}
            </button>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-3 sm:col-span-2">
          <button className="primary-button" disabled={pending} type="submit">
            {pending ? "Updating..." : "Update password"}
          </button>
          <button
            className="secondary-button"
            disabled={reauthPending}
            onClick={() =>
              startTransition(() => void requestReauthenticationCode())
            }
            type="button"
          >
            {reauthPending ? "Sending code..." : "Send reauthentication code"}
          </button>
        </div>
      </form>

      {message ? (
        <p className="text-sm font-medium text-[var(--brand-green)]">{message}</p>
      ) : null}
      {error ? (
        <p className="text-sm font-medium text-[var(--brand-rust)]">{error}</p>
      ) : null}
    </div>
  );
}
