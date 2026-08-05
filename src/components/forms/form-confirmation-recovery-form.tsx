"use client";

import { type FormEvent, useState } from "react";

import { TurnstileField } from "@/components/auth/turnstile-field";
import {
  FORM_CONFIRMATION_RESEND_ACCEPTED_MESSAGE,
  getFormConfirmationResendEndpoint,
} from "@/lib/forms/confirmation";

/**
 * Issue #135, contrast half.
 *
 * Both failure messages here were `text-red-700` with no dark variant, which is
 * the exact literal the #89 guard was written to ban and which
 * `NOTICE_ERROR_CLASS` exists to replace. It is in scope because this form
 * renders *inside* the confirmation card being restyled: on the new `bg-card`
 * surface in dark mode, dark red on dark is a contrast failure, and #135's
 * acceptance criteria name contrast and existing design tokens directly.
 *
 * The sent-state `var(--brand-green)` is left alone. It is a token rather than a
 * bare literal, and replacing it means choosing a semantic success colour, which
 * is design-system decision 13.3a and not this PR's to make.
 */
const RECOVERY_ERROR_CLASS = "text-sm font-semibold text-destructive";

export type FormConfirmationCaptchaConfig = {
  required: boolean;
  siteKey: string;
};

type RecoveryState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "sent" }
  | { message: string; status: "error" };

export function FormConfirmationRecoveryForm({
  captcha,
  formSlug,
}: {
  captcha: FormConfirmationCaptchaConfig;
  formSlug: string;
}) {
  const [state, setState] = useState<RecoveryState>({ status: "idle" });
  const captchaUnavailable = captcha.required && !captcha.siteKey;

  async function requestConfirmation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (captchaUnavailable || !event.currentTarget.reportValidity()) return;

    setState({ status: "sending" });
    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch(getFormConfirmationResendEndpoint(formSlug), {
        body: JSON.stringify({
          captchaToken: String(formData.get("captchaToken") || ""),
          email: String(formData.get("email") || "").trim().toLowerCase(),
          website: String(formData.get("website") || ""),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; success?: boolean }
        | null;

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "We could not request another confirmation link.");
      }

      setState({ status: "sent" });
    } catch (error) {
      setState({
        message:
          error instanceof Error
            ? error.message
            : "We could not request another confirmation link.",
        status: "error",
      });
    }
  }

  if (state.status === "sent") {
    return (
      <p className="mt-6 text-sm font-semibold text-[var(--brand-green)]" role="status">
        {FORM_CONFIRMATION_RESEND_ACCEPTED_MESSAGE}
      </p>
    );
  }

  return (
    <form className="mt-6 grid gap-3" onSubmit={requestConfirmation}>
      <p className="text-sm leading-6 text-[var(--muted-foreground)]">
        Enter the same email used for the submission. Response stays identical whether a matching
        pending submission exists or not.
      </p>
      <label className="grid gap-2 text-sm font-semibold" htmlFor="confirmation-recovery-email">
        Email address
        <input
          autoComplete="email"
          className="form-input"
          id="confirmation-recovery-email"
          maxLength={320}
          name="email"
          required
          type="email"
        />
      </label>
      <div aria-hidden="true" className="contact-honeypot">
        <label htmlFor="confirmation-recovery-website">Website</label>
        <input
          autoComplete="off"
          id="confirmation-recovery-website"
          name="website"
          tabIndex={-1}
        />
      </div>
      {captcha.required ? <TurnstileField siteKey={captcha.siteKey} /> : null}
      {captchaUnavailable ? (
        <p className={RECOVERY_ERROR_CLASS} role="alert">
          Verification is temporarily unavailable. Try again later.
        </p>
      ) : null}
      {state.status === "error" ? (
        <p className={RECOVERY_ERROR_CLASS} role="alert">
          {state.message}
        </p>
      ) : null}
      <button
        aria-busy={state.status === "sending"}
        className="secondary-button w-full"
        disabled={state.status === "sending" || captchaUnavailable}
        type="submit"
      >
        {state.status === "sending" ? "Requesting…" : "Send a new confirmation link"}
      </button>
    </form>
  );
}
