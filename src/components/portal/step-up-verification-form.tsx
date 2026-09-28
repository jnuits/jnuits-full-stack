"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { TurnstileField } from "@/components/auth/turnstile-field";

type CaptchaConfig = { required: boolean; siteKey: string };

export function StepUpVerificationForm({
  captcha,
  initiallyActive,
  username,
}: {
  captcha: CaptchaConfig;
  initiallyActive: boolean;
  username?: null | string;
}) {
  const router = useRouter();
  const [active, setActive] = useState(initiallyActive);
  const [message, setMessage] = useState<string | null>(
    initiallyActive
      ? "Profile editing is unlocked for this browser for 15 minutes."
      : null
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaAttempt, setCaptchaAttempt] = useState(0);

  function resetCaptcha() {
    setCaptchaToken("");
    setCaptchaAttempt((value) => value + 1);
  }

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/profile/step-up", {
        body: JSON.stringify({
          captchaToken,
          currentPassword: String(formData.get("currentPassword") || ""),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const body = (await response.json().catch(() => null)) as
        | { message?: string; verified?: boolean }
        | null;

      if (!response.ok || !body?.verified) {
        setActive(false);
        setError(body?.message || "Current password verification failed.");
        resetCaptcha();
        return;
      }

      setActive(true);
      setMessage(body.message || "Profile editing is unlocked.");
      resetCaptcha();
      router.refresh();
    } catch {
      setError("Verification failed. Check your connection and try again.");
      resetCaptcha();
    } finally {
      setPending(false);
    }
  }

  async function clearStepUp() {
    setPending(true);
    setError(null);
    setMessage(null);

    try {
      await fetch("/api/profile/step-up", { method: "DELETE" });
      setActive(false);
      setMessage("Profile editing has been locked again.");
      router.refresh();
    } catch {
      setError("Unable to lock profile editing. Refresh and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="profile-edit-card profile-edit-card--hero">
      <div className="profile-edit-card__header">
        <div className="profile-edit-card__icon" data-tone={active ? "success" : "locked"}>
          {active ? <ShieldCheck size={18} /> : <LockKeyhole size={18} />}
        </div>
        <div>
          <p className="profile-edit-kicker">Secure profile editing</p>
          <h2 className="profile-edit-title">
            {active
              ? "Profile editing is unlocked"
              : "Enter your password to edit your profile"}
          </h2>
        </div>
        <span className="profile-edit-status" data-state={active ? "complete" : "locked"}>
          {active ? "Unlocked" : "Password required"}
        </span>
      </div>

      <p className="profile-edit-copy">
        {active
          ? "You can now view and update your profile. The unlock expires automatically after 15 minutes."
          : "For your privacy, profile details and editing options remain hidden until your current password is verified."}
      </p>

      {active ? (
        <div className="profile-edit-actions">
          <button
            className="secondary-button"
            disabled={pending}
            onClick={() => startTransition(() => void clearStepUp())}
            type="button"
          >
            {pending ? "Locking..." : "Lock profile editing"}
          </button>
        </div>
      ) : (
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
          {captcha.required ? (
            <div className="profile-edit-span-2">
              <TurnstileField
                key={captchaAttempt}
                onTokenChange={setCaptchaToken}
                siteKey={captcha.siteKey}
              />
            </div>
          ) : null}
          <div className="profile-edit-actions profile-edit-span-2">
            <button
              className="primary-button"
              disabled={pending || (captcha.required && !captchaToken)}
              type="submit"
            >
              {pending ? "Verifying..." : "Verify and unlock"}
            </button>
          </div>
        </form>
      )}

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
