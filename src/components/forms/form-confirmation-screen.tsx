"use client";

import Link from "next/link";
import { useState } from "react";

import {
  FormConfirmationRecoveryForm,
  type FormConfirmationCaptchaConfig,
} from "@/components/forms/form-confirmation-recovery-form";

type ConfirmationState =
  | { status: "ready" }
  | { status: "confirming" }
  | { status: "success" }
  | { message: string; status: "expired" | "error" };

export function FormConfirmationScreen({
  captcha,
  formSlug,
  submissionId,
  token,
  valid,
}: {
  captcha: FormConfirmationCaptchaConfig;
  formSlug: null | string;
  submissionId: string;
  token: string;
  valid: boolean;
}) {
  const [state, setState] = useState<ConfirmationState>(
    valid
      ? { status: "ready" }
      : { message: "This confirmation link is invalid or incomplete.", status: "error" }
  );

  async function confirmSubmission() {
    if (!valid) return;

    setState({ status: "confirming" });

    try {
      const response = await fetch("/api/forms/confirm", {
        body: JSON.stringify({ submissionId, token }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; success?: boolean }
        | null;

      if (payload?.success) {
        setState({ status: "success" });
        return;
      }

      if (response.status === 410) {
        setState({
          message:
            payload?.error ||
            "This confirmation link has expired. Use the recovery form below to request a new one.",
          status: "expired",
        });
        return;
      }

      throw new Error(payload?.error || "We could not confirm this submission.");
    } catch (error) {
      setState({
        message: error instanceof Error ? error.message : "We could not confirm this submission.",
        status: "error",
      });
    }
  }

  if (state.status === "success") {
    return (
      <section className="glass-card max-w-xl px-6 py-8 sm:px-8" role="status" aria-live="polite">
        <h1 className="section-title">Email confirmed</h1>
        <p className="section-copy mt-4">
          Your submission is now with the JnUITS review team. We will email you when there is an update.
        </p>
        <Link className="primary-button mt-6 inline-flex" href="/">
          Return home
        </Link>
      </section>
    );
  }

  const isBusy = state.status === "confirming";
  const isError = state.status === "error" || state.status === "expired";

  return (
    <section className="glass-card max-w-xl px-6 py-8 sm:px-8">
      <h1 className="section-title">
        {state.status === "expired" ? "Confirmation link expired" : "Confirm your email"}
      </h1>
      <p className="section-copy mt-4">
        {isError
          ? state.message
          : "Confirming sends your application to the JnUITS review team. This action is safe to repeat."}
      </p>
      {state.status === "expired" && formSlug ? (
        <FormConfirmationRecoveryForm captcha={captcha} formSlug={formSlug} />
      ) : null}
      {state.status === "ready" || state.status === "confirming" ? (
        <button
          aria-busy={isBusy}
          className="primary-button mt-6 w-full"
          disabled={isBusy}
          onClick={confirmSubmission}
          type="button"
        >
          {isBusy ? "Confirming…" : "Confirm email and submit"}
        </button>
      ) : null}
      {isError ? (
        <Link className="secondary-button mt-6 inline-flex" href="/membership-form">
          Return to membership support
        </Link>
      ) : null}
    </section>
  );
}
