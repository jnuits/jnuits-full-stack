"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";

import {
  FormConfirmationRecoveryForm,
  type FormConfirmationCaptchaConfig,
} from "@/components/forms/form-confirmation-recovery-form";
import { focusAndReveal } from "@/lib/forms/focus-and-reveal";

/**
 * Decision 7 in #86: the contact card idiom, replacing `glass-card`. Issue #135.
 *
 * This screen is the second step of the public form journey -- a respondent
 * submits, receives an email, clicks through, and lands here -- and it kept
 * `glass-card` when #112 moved the first step to this idiom. Two consecutive
 * steps of one flow rendering in two different card treatments is where an
 * inconsistency is most visible and most reads as broken rather than as drift.
 *
 * **Scope is this flow, not the repository.** `glass-card` remains the site
 * idiom in 26 other files, from the policy pages to the admin panel; decision 7
 * replaced it on the public form surface specifically. Issue #135 recommended a
 * repository-wide sweep, and that recommendation was wrong -- it would restyle
 * most of the site under an accessibility ticket.
 *
 * These strings are duplicated from `public-form-screen.tsx` rather than shared,
 * which is deliberate and guarded. They cannot move to a common module without
 * breaking the source-text assertions in
 * `public-form-presentation-contract.test.ts`, which read that file by path: a
 * guard describing a file that no longer contains the thing it names is finding
 * 14.9. `form-confirmation-screen.test.tsx` asserts the two copies are byte
 * identical instead, so changing one fails until the other follows.
 */
const PAGE_WRAPPER_CLASS = "mx-auto w-full max-w-xl";
const CARD_CLASS = "overflow-hidden rounded-2xl border border-border bg-card shadow-sm";
const CARD_ACCENT_CLASS = "h-[3px] bg-primary";
const CARD_BODY_CLASS = "p-6 sm:p-8";

type ConfirmationState =
  | { status: "ready" }
  | { status: "confirming" }
  | { status: "success" }
  | { message: string; status: "expired" | "error" };

/**
 * @returns the heading for a state, which has to describe that state.
 *
 * The error branch previously reused "Confirm your email", which was survivable
 * while nothing was focused and is not once focus lands there: a screen reader
 * would announce an instruction to confirm immediately after confirming failed.
 * Issue #134 is the focus fix, and the focus fix requires this.
 */
function confirmationHeading(status: ConfirmationState["status"]) {
  if (status === "success") return "Email confirmed";
  if (status === "expired") return "Confirmation link expired";
  if (status === "error") return "We could not confirm your email";

  return "Confirm your email";
}

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
  /**
   * The heading, so focus can be moved to it. Issue #134, matching #125.
   *
   * A ref rather than an id lookup: this is one element the component renders
   * itself, not a control resolved at runtime from a definition.
   */
  const headingRef = useRef<HTMLHeadingElement>(null);
  /**
   * The previous status, so focus moves on a *transition* and never on mount.
   *
   * Load-bearing. An invalid or incomplete link initialises straight to the
   * error state, so an effect that fired on first render would take a visitor
   * who has only just arrived and move them somewhere they never asked to be --
   * and would do it before they had read anything. Nothing has happened yet at
   * that point; the page simply opened in a terminal state.
   */
  const previousStatusRef = useRef<ConfirmationState["status"]>(state.status);

  /**
   * Moves focus to the heading once a terminal state is committed. Issue #134.
   *
   * Every one of these states removes the button the respondent just activated.
   * A removed element cannot keep focus, so the browser hands it back to `<body>`
   * and a keyboard or screen-reader user is returned to the top of the document
   * with no statement of what happened -- the same defect #125 fixed on the
   * public form screen, on the surface a respondent reaches immediately after it.
   *
   * `confirming` is excluded because the button is still there, merely busy, and
   * moving focus off a control someone is waiting on would be worse than leaving
   * it.
   *
   * Keyed on `state.status` rather than `state`, so the recovery form rendered in
   * the expired branch cannot drag focus back up here as it manages its own
   * state. That is the mistake #125's test named explicitly.
   */
  useEffect(() => {
    const previousStatus = previousStatusRef.current;
    previousStatusRef.current = state.status;

    if (previousStatus === state.status || state.status === "confirming") {
      return;
    }

    focusAndReveal(headingRef.current);
  }, [state.status]);

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

  /**
   * `tabIndex={-1}` makes the heading a focus target without adding a tab stop,
   * so nobody arrives on a heading by tabbing.
   *
   * The focus ring is deliberately not suppressed. Programmatic focus matches
   * `:focus-visible` only when the browser judges the user to be driving by
   * keyboard, which is exactly the person who benefits from seeing where they
   * have been put.
   *
   * Stays an `h1`: this page renders no heading above the card, unlike the public
   * form screen whose `PublicFormHeader` owns the `h1` and whose success heading
   * is therefore an `h2`. Levelling the two to match would leave this document
   * with no top-level heading at all.
   */
  const heading = (
    <h1 className="section-title" ref={headingRef} tabIndex={-1}>
      {confirmationHeading(state.status)}
    </h1>
  );

  if (state.status === "success") {
    return (
      <div className={PAGE_WRAPPER_CLASS}>
        <section className={CARD_CLASS}>
          <div aria-hidden="true" className={CARD_ACCENT_CLASS} />
          <div className={CARD_BODY_CLASS}>
            {/*
             * No live region here, on purpose, and its removal is half of #134.
             *
             * This branch previously carried `role="status" aria-live="polite"`.
             * That never announced anything: the section mounts with its content
             * already inside it, and several screen readers report only mutations
             * to a region that already existed -- the #91 finding.
             *
             * Keeping it alongside the focus move would be worse than useless.
             * Focus now lands inside it, and an element focused within a live
             * region is the standard way to have the same sentence read out
             * twice. This heading is not a change within a view that stays put; it
             * is the new view.
             */}
            <div className="text-center">
              <span className="mb-4 inline-flex size-11 items-center justify-center rounded-full border border-border bg-primary/10 text-primary">
                <CheckCircle2 aria-hidden="true" size={22} />
              </span>
              {heading}
              <p className="section-copy mt-4">
                Your submission is now with the JnUITS review team. We will email you when there is
                an update.
              </p>
              <Link className="primary-button mt-6 inline-flex" href="/">
                Return home
              </Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const isBusy = state.status === "confirming";
  const isError = state.status === "error" || state.status === "expired";

  return (
    <div className={PAGE_WRAPPER_CLASS}>
      <section className={CARD_CLASS}>
        <div aria-hidden="true" className={CARD_ACCENT_CLASS} />
        <div className={CARD_BODY_CLASS}>
          {heading}
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
        </div>
      </section>
    </div>
  );
}
