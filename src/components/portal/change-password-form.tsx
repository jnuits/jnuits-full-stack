"use client";

import { updateCurrentPassword } from "@/app/(auth)/actions";
import { getPasswordPolicyError } from "@/lib/security/password-policy";
import { getPasswordExposureError } from "@/lib/security/pwned-passwords";
import { startTransition, useRef, useState } from "react";
import { TurnstileField } from "@/components/auth/turnstile-field";

type CaptchaConfig = { required: boolean; siteKey: string };

export function ChangePasswordForm({ captcha }: { captcha: CaptchaConfig }) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [reauthPending, setReauthPending] = useState(false);
  const [stepUpRequired, setStepUpRequired] = useState(false);
  const [stepUpPassword, setStepUpPassword] = useState("");
  const [verifyingStepUp, setVerifyingStepUp] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaAttempt, setCaptchaAttempt] = useState(0);
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
    setError(null);
    setMessage(null);

    const result = await updateCurrentPassword({
      confirmPassword: attempt.confirmPassword,
      nonce: attempt.nonce,
      password: attempt.password,
    });

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

    await submitUpdate({ confirmPassword, nonce, password });
  }

  async function verifyAndRetry() {
    if (!lastAttemptRef.current || !stepUpPassword) {
      setError("Enter your current password to continue.");
      return;
    }

    if (captcha.required && !captchaToken) {
      setError("Complete the verification challenge.");
      return;
    }

    setVerifyingStepUp(true);
    setError(null);

    try {
      const response = await fetch("/api/profile/step-up", {
        body: JSON.stringify({
          captchaToken,
          currentPassword: stepUpPassword,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        setError(payload?.message || "Current password verification failed.");
        setCaptchaToken("");
        setCaptchaAttempt((value) => value + 1);
        setVerifyingStepUp(false);
        return;
      }
    } catch {
      setError("Verification request failed. Check your connection and retry.");
      setCaptchaToken("");
      setCaptchaAttempt((value) => value + 1);
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

    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error: reauthError } = await supabase.auth.reauthenticate();

      if (reauthError) {
        setError(reauthError.message);
        setReauthPending(false);
        return;
      }
    } finally {
      setReauthPending(false);
    }

    setMessage(
      "A reauthentication code has been sent to your confirmed email address. Paste that code into the nonce field before retrying the password change."
    );
  }

  return (
    <div className="grid gap-5">
      <form
        action={(formData) => startTransition(() => void handleUpdate(formData))}
        className="portal-form-grid"
        id="change-password-form"
      >
        <label className="input-label sm:col-span-2" htmlFor="cp-new-password">
          New password
          <input
            id="cp-new-password"
            autoComplete="new-password"
            name="password"
            placeholder="Use 12 or more characters"
            type="password"
          />
        </label>
        <p className="-mt-2 text-xs leading-5 text-[var(--muted-foreground)] sm:col-span-2">
          Use a long, unique passphrase. Common passwords and passwords based on
          your email are rejected.
        </p>
        <label className="input-label sm:col-span-2" htmlFor="cp-confirm-password">
          Confirm new password
          <input
            id="cp-confirm-password"
            autoComplete="new-password"
            name="confirmPassword"
            placeholder="Re-enter the new password"
            type="password"
          />
        </label>
        <label className="input-label sm:col-span-2" htmlFor="cp-nonce">
          Reauthentication code
          <input
            id="cp-nonce"
            autoComplete="one-time-code"
            name="nonce"
            placeholder="Only required if Supabase asks for reauthentication"
          />
        </label>
        {stepUpRequired ? (
          <div className="sm:col-span-2 grid gap-2 rounded-lg border border-[var(--line)] p-3">
            <label className="input-label" htmlFor="cp-stepup-password">
              Verify current password
              <input
                autoComplete="current-password"
                id="cp-stepup-password"
                name="stepUpPassword"
                onChange={(event) => setStepUpPassword(event.target.value)}
                placeholder="Enter the password you signed in with"
                type="password"
                value={stepUpPassword}
              />
            </label>
            <p className="-mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
              Password changes require a fresh current-password verification.
            </p>
            {captcha.required ? (
              <TurnstileField
                key={captchaAttempt}
                onTokenChange={setCaptchaToken}
                siteKey={captcha.siteKey}
              />
            ) : null}
            <button
              className="secondary-button"
              disabled={
                verifyingStepUp ||
                !stepUpPassword ||
                pending ||
                (captcha.required && !captchaToken)
              }
              onClick={() => startTransition(() => void verifyAndRetry())}
              type="button"
            >
              {verifyingStepUp
                ? "Verifying..."
                : "Verify and update password"}
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
            onClick={() => startTransition(() => void requestReauthenticationCode())}
            type="button"
          >
            {reauthPending ? "Sending code..." : "Send reauthentication code"}
          </button>
        </div>
      </form>

      {message ? <p className="portal-message portal-message--success">{message}</p> : null}
      {error ? <p className="portal-message portal-message--error">{error}</p> : null}
    </div>
  );
}
