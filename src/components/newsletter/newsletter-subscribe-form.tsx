"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { TurnstileField } from "@/components/auth/turnstile-field";

const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export function NewsletterSubscribeForm() {
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaRevision, setCaptchaRevision] = useState(0);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!email.trim()) {
      setErrorMessage("Please enter your email address.");
      setStatus("error");
      return;
    }

    if (!consent) {
      setErrorMessage("Please confirm your consent to receive JnUITS newsletter updates.");
      setStatus("error");
      return;
    }

    setStatus("submitting");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          captchaToken,
          consent: true,
          email: email.trim(),
          website: website.trim(),
        }),
      });

      const payload = (await res.json().catch(() => null)) as
        | { error?: string; message?: string; status?: string }
        | null;

      if (res.status === 202 || res.ok) {
        setStatus("success");
        setEmail("");
        setConsent(false);
        setCaptchaToken("");
        setCaptchaRevision((r) => r + 1);
        return;
      }

      // Handle specific HTTP error status codes
      if (res.status === 429) {
        setErrorMessage("Too many requests. Please wait a few moments and try again.");
      } else if (res.status === 503) {
        setErrorMessage("The newsletter service is temporarily unavailable. Please try again later.");
      } else if (res.status === 400) {
        const errorCode = payload?.error;
        if (errorCode === "invalid_input") {
          setErrorMessage("Please enter a valid email address and verify the required fields.");
        } else if (errorCode === "captcha_failed") {
          setErrorMessage("Security verification failed. Please complete the CAPTCHA and try again.");
        } else {
          setErrorMessage(
            payload?.message ||
              "Please check your email address and verify the required fields."
          );
        }
      } else {
        setErrorMessage(
          payload?.message ||
            "Unable to process subscription right now. Please try again."
        );
      }

      setStatus("error");
      setCaptchaRevision((r) => r + 1);
      setCaptchaToken("");
    } catch {
      setErrorMessage("Network error. Please check your connection and try again.");
      setStatus("error");
      setCaptchaRevision((r) => r + 1);
      setCaptchaToken("");
    }
  }

  function handleRetry() {
    setStatus("idle");
    setErrorMessage(null);
    setCaptchaRevision((r) => r + 1);
    setCaptchaToken("");
    emailInputRef.current?.focus();
  }

  if (status === "success") {
    return (
      <div
        aria-live="polite"
        className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-950/40 p-4 text-left text-xs leading-5 text-emerald-200"
        role="status"
      >
        <p className="font-semibold text-emerald-100">Check your email</p>
        <p className="mt-1 text-emerald-200/90">
          If this email is eligible, a confirmation link has been sent. Please check your
          inbox to confirm your subscription.
        </p>
        <button
          className="mt-3 text-xs font-semibold text-white underline underline-offset-2 hover:text-white/80"
          onClick={() => setStatus("idle")}
          type="button"
        >
          Subscribe another address
        </button>
      </div>
    );
  }

  return (
    <form className="site-footer-newsletter" onSubmit={handleSubmit}>
      <label className="sr-only" htmlFor="footer-newsletter-email">
        Email address
      </label>
      <input
        autoComplete="email"
        disabled={status === "submitting"}
        id="footer-newsletter-email"
        name="email"
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        ref={emailInputRef}
        required
        type="email"
        value={email}
      />

      <div className="site-footer-newsletter__trap" aria-hidden="true">
        <label htmlFor="footer-newsletter-website">Website</label>
        <input
          autoComplete="off"
          id="footer-newsletter-website"
          name="website"
          onChange={(e) => setWebsite(e.target.value)}
          tabIndex={-1}
          value={website}
        />
      </div>

      <div className="flex items-start gap-2 pt-1 text-left text-xs text-white/80">
        <input
          checked={consent}
          className="mt-0.5 size-3.5 shrink-0 rounded border-white/30 text-[var(--brand-blue)] focus:ring-[var(--brand-gold)]"
          disabled={status === "submitting"}
          id="footer-newsletter-consent"
          onChange={(e) => setConsent(e.target.checked)}
          required
          type="checkbox"
        />
        <label
          className="cursor-pointer leading-tight text-white/70"
          htmlFor="footer-newsletter-consent"
        >
          I consent to receive newsletter updates and accept the{" "}
          <Link
            className="underline underline-offset-2 hover:text-white"
            href="/privacy-policy"
          >
            Privacy Policy
          </Link>
          .
        </label>
      </div>

      {siteKey ? (
        <div className="mt-1">
          <TurnstileField
            key={captchaRevision}
            name="captchaToken"
            onTokenChange={setCaptchaToken}
            siteKey={siteKey}
          />
        </div>
      ) : null}

      {status === "error" && errorMessage ? (
        <div
          aria-live="assertive"
          className="rounded-lg border border-red-500/40 bg-red-950/50 p-2.5 text-left text-xs leading-5 text-red-200"
          role="alert"
        >
          <p>{errorMessage}</p>
          <button
            className="mt-1 text-xs font-semibold text-white underline underline-offset-2 hover:text-white/80"
            onClick={handleRetry}
            type="button"
          >
            Try again
          </button>
        </div>
      ) : null}

      <button
        className={status === "submitting" || !consent ? "opacity-60 cursor-not-allowed" : ""}
        disabled={status === "submitting" || !consent}
        type="submit"
      >
        {status === "submitting" ? "Subscribing…" : "Subscribe"}
      </button>
    </form>
  );
}
