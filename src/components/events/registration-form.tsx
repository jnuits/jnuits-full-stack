"use client";

import { useState } from "react";

interface RegistrationFormProps {
  eventId: string;
  eventTitle: string;
  formHref?: string;
  spotsRemaining: number | null; // null = unlimited
  registrationOpen: boolean;
}

type FormState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; code: string }
  | { status: "waitlisted"; code: string }
  | { status: "duplicate"; code: string }
  | { status: "full" }
  | { status: "closed" }
  | { status: "error"; message: string };

export function RegistrationForm({
  eventId,
  eventTitle,
  formHref,
  spotsRemaining,
  registrationOpen,
}: RegistrationFormProps) {
  const [state, setState] = useState<FormState>({ status: "idle" });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState({ status: "loading" });

    const formData = new FormData(e.currentTarget);
    const payload = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      phone: (formData.get("phone") as string) || undefined,
      website: (formData.get("website") as string) || "",
    };

    try {
      const res = await fetch(`/api/events/${eventId}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as {
        success?: boolean;
        code?: string;
        error?: string;
        waitlisted?: boolean;
      };

      if (res.status === 409 && data.code) {
        setState({ status: "duplicate", code: data.code });
        return;
      }

      if (res.status === 409) {
        const msg = data.error ?? "";
        if (msg.toLowerCase().includes("capacity")) {
          setState({ status: "full" });
        } else if (msg.toLowerCase().includes("closed")) {
          setState({ status: "closed" });
        } else {
          setState({ status: "error", message: msg || "Registration unavailable." });
        }
        return;
      }

      if (!res.ok || !data.success) {
        setState({
          status: "error",
          message: data.error || "Unable to complete registration. Please try again.",
        });
        return;
      }

      if (data.waitlisted) {
        setState({ status: "waitlisted", code: data.code! });
        return;
      }

      setState({ status: "success", code: data.code! });
    } catch {
      setState({ status: "error", message: "A network error occurred. Please check your connection." });
    }
  }

  // Terminal states
  if (state.status === "success") {
    return (
      <div className="glass-card p-6" role="alert" aria-live="polite">
        <span className="eyebrow text-[var(--brand-blue)]">Registration confirmed</span>
        <h3 className="section-title mt-3 text-2xl">You&apos;re registered!</h3>
        <p className="section-copy mt-2 text-sm">
          Check your email for a confirmation with your check-in code. Keep it
          handy for the event.
        </p>
        <div className="mt-4">
          <span className="input-label">Your check-in code</span>
          <code className="mt-1 block rounded-lg border border-[var(--line)] bg-[var(--bg)] p-3 text-center font-mono text-xl font-bold tracking-[0.2em] text-[var(--brand-blue)]">
            {state.code}
          </code>
        </div>
      </div>
    );
  }

  if (state.status === "waitlisted") {
    return (
      <div className="glass-card p-6" role="alert" aria-live="polite">
        <span className="eyebrow text-[var(--brand-blue)]">Waitlist confirmed</span>
        <h3 className="section-title mt-3 text-2xl">You&apos;re on the waitlist</h3>
        <p className="section-copy mt-2 text-sm">
          The event is currently full. We&apos;ll email you if a place becomes
          available. This reference code is not a check-in pass.
        </p>
        <div className="mt-4">
          <span className="input-label">Your waitlist reference</span>
          <code className="mt-1 block rounded-lg border border-[var(--line)] bg-[var(--bg)] p-3 text-center font-mono text-xl font-bold tracking-[0.2em] text-[var(--brand-blue)]">
            {state.code}
          </code>
        </div>
      </div>
    );
  }

  if (state.status === "duplicate") {
    return (
      <div className="glass-card p-6" role="alert" aria-live="polite">
        <span className="eyebrow">Already registered</span>
        <h3 className="section-title mt-3 text-2xl">You&apos;re on the list</h3>
        <p className="section-copy mt-2 text-sm">
          You&apos;re already registered for this event. Your check-in code
          was sent to your email when you first registered.
        </p>
        <div className="mt-4">
          <span className="input-label">Your existing code</span>
          <code className="mt-1 block rounded-lg border border-[var(--line)] bg-[var(--bg)] p-3 text-center font-mono text-xl font-bold tracking-[0.2em] text-[var(--brand-blue)]">
            {state.code}
          </code>
        </div>
      </div>
    );
  }

  if (state.status === "full") {
    return (
      <div className="glass-card p-6" role="alert">
        <span className="eyebrow text-[var(--muted-foreground)]">Registration closed</span>
        <h3 className="section-title mt-3 text-2xl">Event is full</h3>
        <p className="section-copy mt-2 text-sm">
          This event has reached capacity. Please check back for future events
          or contact us if you have questions.
        </p>
      </div>
    );
  }

  if (state.status === "closed" || !registrationOpen) {
    return (
      <div className="glass-card p-6" role="alert">
        <span className="eyebrow text-[var(--muted-foreground)]">Registration closed</span>
        <h3 className="section-title mt-3 text-2xl">Registration is not open</h3>
        <p className="section-copy mt-2 text-sm">
          Registration for this event is not currently open. Check back closer
          to the event date.
        </p>
      </div>
    );
  }

  const spotsLabel =
    spotsRemaining === null
      ? null
      : spotsRemaining > 10
        ? `${spotsRemaining} spots remaining`
        : spotsRemaining > 0
          ? `Only ${spotsRemaining} ${spotsRemaining === 1 ? "spot" : "spots"} left!`
          : "Fully booked";

  if (formHref) {
    return (
      <div className="glass-card p-6">
        <span className="eyebrow text-[var(--brand-blue)]">Register for this event</span>
        <h3 className="section-title mt-3 text-2xl">{eventTitle}</h3>
        {spotsLabel ? (
          <p className="mt-1 text-xs font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
            {spotsLabel}
          </p>
        ) : null}
        <p className="section-copy mt-4 text-sm">
          Complete this event&apos;s registration form to reserve your place.
        </p>
        <a className="primary-button mt-5 inline-flex w-full justify-center" href={formHref}>
          Continue to registration form
        </a>
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      <span className="eyebrow text-[var(--brand-blue)]">Register for this event</span>
      <h3 className="section-title mt-3 text-2xl">{eventTitle}</h3>
      {spotsLabel ? (
        <p className="mt-1 text-xs font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
          {spotsLabel}
        </p>
      ) : null}

      <form
        id="event-registration-form"
        className="mt-5 grid gap-4"
        noValidate
        onSubmit={handleSubmit}
      >
        <div>
          <label htmlFor="reg-name" className="input-label">
            Full name <span aria-hidden="true">*</span>
          </label>
          <input
            id="reg-name"
            name="name"
            type="text"
            required
            autoComplete="name"
            placeholder="Your full name"
            className="input-field mt-1 w-full"
            disabled={state.status === "loading"}
            aria-required="true"
          />
        </div>

        <div>
          <label htmlFor="reg-email" className="input-label">
            Email address <span aria-hidden="true">*</span>
          </label>
          <input
            id="reg-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="input-field mt-1 w-full"
            disabled={state.status === "loading"}
            aria-required="true"
          />
        </div>

        <div>
          <label htmlFor="reg-phone" className="input-label">
            Phone number <span className="text-[var(--muted-foreground)]">(optional)</span>
          </label>
          <input
            id="reg-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="+880 1XXX XXXXXX"
            className="input-field mt-1 w-full"
            disabled={state.status === "loading"}
          />
        </div>

        <div className="contact-honeypot" aria-hidden="true">
          <label htmlFor="reg-website">Website</label>
          <input
            id="reg-website"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            disabled={state.status === "loading"}
          />
        </div>

        {state.status === "error" ? (
          <p
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
            role="alert"
            aria-live="polite"
          >
            {state.message}
          </p>
        ) : null}

        <button
          type="submit"
          className="primary-button w-full"
          disabled={state.status === "loading"}
          aria-busy={state.status === "loading"}
        >
          {state.status === "loading" ? "Registering…" : "Complete registration"}
        </button>
      </form>
    </div>
  );
}
