"use client";

import { startTransition, useRef, useState } from "react";
import { TurnstileField } from "@/components/auth/turnstile-field";
import { getPasswordPolicyError } from "@/lib/security/password-policy";

type CaptchaConfig = { required: boolean; siteKey: string };

export function ChangePasswordForm({
  captcha,
  username,
}: {
  captcha: CaptchaConfig;
  username?: null | string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaAttempt, setCaptchaAttempt] = useState(0);

  function resetCaptcha() {
    setCaptchaToken("");
    setCaptchaAttempt((value) => value + 1);
  }

  async function handleUpdate(formData: FormData) {
    const currentPassword = String(formData.get("currentPassword") || "");
    const password = String(formData.get("password") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");

    setError(null);
    setMessage(null);

    if (!currentPassword) {
      setError("Enter your current password.");
      return;
    }

    const policyError = getPasswordPolicyError(password, { email: username });
    if (policyError) {
      setError(policyError);
      return;
    }

    if (password !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    if (password === currentPassword) {
      setError("Choose a new password that differs from your current password.");
      return;
    }

    if (captcha.required && !captchaToken) {
      setError("Complete the verification challenge.");
      return;
    }

    setPending(true);

    try {
      const response = await fetch("/api/profile/change-password", {
        body: JSON.stringify({
          captchaToken,
          confirmPassword,
          currentPassword,
          password,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const body = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        setError(body?.message || "Unable to update your password. Try again.");
        resetCaptcha();
        return;
      }

      formRef.current?.reset();
      resetCaptcha();
      setMessage(body?.message || "Password updated successfully.");
    } catch {
      setError("Password update failed. Check your connection and try again.");
      resetCaptcha();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-5">
      <form
        ref={formRef}
        action={(formData) => startTransition(() => void handleUpdate(formData))}
        className="portal-form-grid"
        id="change-password-form"
      >
        <input
          autoComplete="username"
          hidden
          name="username"
          readOnly
          type="email"
          value={username || ""}
        />
        <label className="input-label sm:col-span-2" htmlFor="cp-current-password">
          Current password
          <input
            id="cp-current-password"
            autoComplete="current-password"
            name="currentPassword"
            placeholder="Enter your current password"
            required
            type="password"
          />
        </label>
        <label className="input-label sm:col-span-2" htmlFor="cp-new-password">
          New password
          <input
            id="cp-new-password"
            autoComplete="new-password"
            name="password"
            placeholder="Use 12 or more characters"
            required
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
            required
            type="password"
          />
        </label>
        {captcha.required ? (
          <div className="sm:col-span-2">
            <TurnstileField
              key={captchaAttempt}
              onTokenChange={setCaptchaToken}
              siteKey={captcha.siteKey}
            />
          </div>
        ) : null}
        <div className="flex flex-wrap gap-3 sm:col-span-2">
          <button
            className="primary-button"
            disabled={pending || (captcha.required && !captchaToken)}
            type="submit"
          >
            {pending ? "Updating password..." : "Update password"}
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
    </div>
  );
}
