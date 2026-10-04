"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Mail,
  RefreshCw,
} from "lucide-react";

type ConfirmState =
  | "ready"
  | "no_token"
  | "pending"
  | "confirmed"
  | "preferences_required"
  | "invalid_token"
  | "expired_token"
  | "newsletter_unavailable"
  | "error";

interface NewsletterConfirmClientProps {
  initialToken: string;
}

export function NewsletterConfirmClient({ initialToken }: NewsletterConfirmClientProps) {
  // Hold the token in memory only; avoid logging or persisting
  const tokenRef = useRef(initialToken.trim());
  const [status, setStatus] = useState<ConfirmState>(
    initialToken.trim() ? "ready" : "no_token"
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Clean URL to prevent token referrer leakage
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("token")) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  async function handleConfirm() {
    const currentToken = tokenRef.current;
    if (!currentToken) {
      setStatus("no_token");
      return;
    }

    setStatus("pending");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/newsletter/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: currentToken }),
      });

      const payload = (await res.json().catch(() => null)) as
        | { status?: "confirmed" | "preferences_required"; error?: string; message?: string }
        | null;

      if (res.ok && payload?.status === "confirmed") {
        setStatus("confirmed");
        return;
      }

      if (res.ok && payload?.status === "preferences_required") {
        setStatus("preferences_required");
        return;
      }

      // Check specific error codes
      const errorCode = payload?.error;
      if (errorCode === "invalid_token" || res.status === 400) {
        setStatus("invalid_token");
      } else if (errorCode === "expired_token" || res.status === 410) {
        setStatus("expired_token");
      } else if (errorCode === "newsletter_unavailable" || res.status === 503) {
        setStatus("newsletter_unavailable");
      } else {
        setStatus("error");
        setErrorMessage(
          payload?.message || "Unable to confirm subscription right now. Please try again."
        );
      }
    } catch {
      setStatus("error");
      setErrorMessage("Network error. Please check your connection and try again.");
    }
  }

  return (
    <article className="glass-card mx-auto max-w-xl p-8 sm:p-10 text-center">
      {status === "ready" && (
        <div className="space-y-6">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Mail aria-hidden="true" size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
              Confirm your subscription
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
              Click the button below to confirm that you want to receive official newsletters,
              event invitations, and community updates from JnU IT Society.
            </p>
          </div>
          <div>
            <button
              className="primary-button inline-flex items-center gap-2 px-8 py-3 text-base"
              onClick={handleConfirm}
              type="button"
            >
              Confirm subscription
              <ArrowRight aria-hidden="true" size={18} />
            </button>
          </div>
        </div>
      )}

      {status === "pending" && (
        <div aria-live="polite" className="space-y-6" role="status">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary animate-pulse">
            <RefreshCw aria-hidden="true" className="animate-spin text-primary" size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
              Confirming your subscription…
            </h1>
            <p className="mt-3 text-sm text-[var(--muted-foreground)]">
              Please wait while we verify your confirmation token.
            </p>
          </div>
          <button className="primary-button opacity-50 cursor-not-allowed" disabled type="button">
            Verifying…
          </button>
        </div>
      )}

      {status === "confirmed" && (
        <div aria-live="polite" className="space-y-6" role="status">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 aria-hidden="true" size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
              Subscription confirmed!
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
              Thank you for subscribing to JnUITS. You are now verified to receive our
              official society newsletter and program updates.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link className="primary-button" href="/notices">
              Explore notices
            </Link>
            <Link className="secondary-button" href="/">
              Return to home
            </Link>
          </div>
        </div>
      )}

      {status === "preferences_required" && (
        <div aria-live="polite" className="space-y-6" role="status">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <AlertTriangle aria-hidden="true" size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
              Preferences update required
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
              Your email is recognized, but existing provider-level delivery preferences or
              suppression settings require manual assistance to modify.
            </p>
            <p className="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">
              To adjust or reactivate your subscription, please contact the JnUITS team.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link
              className="primary-button"
              href="/contact?category=membership&subject=Newsletter%20subscription%20assistance"
            >
              Contact support
            </Link>
            <Link className="secondary-button" href="/">
              Return home
            </Link>
          </div>
        </div>
      )}

      {status === "invalid_token" && (
        <div aria-live="assertive" className="space-y-6" role="alert">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-600 dark:text-red-400">
            <AlertCircle aria-hidden="true" size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
              Invalid confirmation link
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
              This confirmation link is invalid or has already been used. Please subscribe
              again through the website footer to receive a new link.
            </p>
          </div>
          <div className="pt-2">
            <Link className="primary-button" href="/#footer-newsletter-email">
              Subscribe again
            </Link>
          </div>
        </div>
      )}

      {status === "expired_token" && (
        <div aria-live="assertive" className="space-y-6" role="alert">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <AlertCircle aria-hidden="true" size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
              Confirmation link expired
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
              For your privacy and security, subscription confirmation links expire after a
              set period. Please subscribe again to receive a fresh verification link.
            </p>
          </div>
          <div className="pt-2">
            <Link className="primary-button" href="/#footer-newsletter-email">
              Request new link
            </Link>
          </div>
        </div>
      )}

      {status === "newsletter_unavailable" && (
        <div aria-live="assertive" className="space-y-6" role="alert">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <AlertTriangle aria-hidden="true" size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
              Service temporarily unavailable
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
              Our newsletter confirmation service is temporarily unavailable. Please try
              again in a moment.
            </p>
          </div>
          <div className="pt-2">
            <button className="primary-button" onClick={handleConfirm} type="button">
              Try again
            </button>
          </div>
        </div>
      )}

      {status === "error" && (
        <div aria-live="assertive" className="space-y-6" role="alert">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-600 dark:text-red-400">
            <AlertCircle aria-hidden="true" size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
              Unable to confirm subscription
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
              {errorMessage || "An unexpected error occurred. Please try again."}
            </p>
          </div>
          <div className="pt-2">
            <button className="primary-button" onClick={handleConfirm} type="button">
              Try again
            </button>
          </div>
        </div>
      )}

      {status === "no_token" && (
        <div aria-live="assertive" className="space-y-6" role="alert">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
            <Mail aria-hidden="true" size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
              Missing confirmation link
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
              No confirmation token was found. If you received an email from JnUITS, please
              make sure the full link was opened in your browser.
            </p>
          </div>
          <div className="pt-2">
            <Link className="primary-button" href="/">
              Return to homepage
            </Link>
          </div>
        </div>
      )}
    </article>
  );
}
