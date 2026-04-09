"use client";

import { useState } from "react";
import Link from "next/link";

type MembershipStatus = "pending" | "approved" | "rejected";

const statusColors: Record<MembershipStatus, string> = {
  pending: "text-[var(--brand-gold)]",
  approved: "text-[var(--brand-green)]",
  rejected: "text-[var(--brand-rust)]",
};

const statusLabels: Record<MembershipStatus, string> = {
  pending: "Pending — your application is under review.",
  approved: "Approved — check your invitation email or contact us.",
  rejected: "Rejected — contact us if you believe this is an error.",
};

export default function MembershipFormPage() {
  const [statusEmail, setStatusEmail] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusValue, setStatusValue] = useState<MembershipStatus | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  async function handleStatusCheck(e: React.FormEvent) {
    e.preventDefault();
    if (!statusEmail.trim()) {
      setStatusMessage("Enter the email used in your previous application.");
      setStatusValue(null);
      return;
    }

    setIsCheckingStatus(true);
    setStatusMessage(null);
    setStatusValue(null);

    try {
      const response = await fetch(
        `/api/membership-form/status?email=${encodeURIComponent(statusEmail.trim())}`
      );
      const payload = (await response.json().catch(() => null)) as
        | { status?: MembershipStatus | null; message?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.message || "Unable to check application status.");
      }

      if (!payload?.status) {
        setStatusMessage("No application was found for this email address.");
        return;
      }

      setStatusValue(payload.status);
      setStatusMessage(statusLabels[payload.status]);
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Unable to check application status."
      );
    } finally {
      setIsCheckingStatus(false);
    }
  }

  return (
    <div className="shell py-12">
      <section className="glass-card grid gap-8 px-6 py-8 sm:px-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <span className="eyebrow">Membership policy</span>
          <h1 className="section-title mt-4">
            New public membership applications are currently closed
          </h1>
          <p className="section-copy mt-4">
            Membership is currently granted through an invitation-first onboarding
            process. Previous applicants can check their status below and current
            invited members can claim their profile from the registration page.
          </p>

          <div className="mt-8 route-grid">
            <article className="route-tile">
              <h3>Already invited?</h3>
              <p>Use your invitation code to claim your member profile and access the portal.</p>
              <Link href="/register" className="secondary-button mt-4 inline-flex">
                Claim profile
              </Link>
            </article>
            <article className="route-tile">
              <h3>Need assistance?</h3>
              <p>
                Contact the team for onboarding support or questions about your
                membership status.
              </p>
              <Link href="/contact" className="secondary-button mt-4 inline-flex">
                Contact JnUITS
              </Link>
            </article>
          </div>
        </div>

        <div className="grid gap-6">
          <article className="route-tile">
            <h3>Check application status</h3>
            <p className="mb-4 text-sm leading-6 text-[var(--muted-foreground)]">
              Enter the email address you used when you submitted your membership
              application to see its current review status.
            </p>
            <form
              className="grid gap-3"
              id="status-check-form"
              onSubmit={handleStatusCheck}
            >
              <label className="input-label" htmlFor="status-email">
                Application email address
                <input
                  id="status-email"
                  type="email"
                  placeholder="you@example.com"
                  value={statusEmail}
                  onChange={(e) => setStatusEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </label>
              <button
                className="secondary-button"
                disabled={isCheckingStatus}
                type="submit"
              >
                {isCheckingStatus ? "Checking…" : "Check status"}
              </button>
            </form>
            {statusMessage ? (
              <p
                className={`mt-3 text-sm font-semibold ${
                  statusValue ? statusColors[statusValue] : "text-[var(--muted-foreground)]"
                }`}
                role="status"
                aria-live="polite"
              >
                {statusMessage}
              </p>
            ) : null}
          </article>

          <article className="route-tile">
            <h3>Sign in to your member portal</h3>
            <p className="text-sm leading-6 text-[var(--muted-foreground)]">
              If you have already claimed your profile, sign in to access your portal
              dashboard, update your details, and view your membership history.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/login" className="secondary-button">
                Sign in
              </Link>
              <Link href="/register" className="ghost-button">
                Claim profile
              </Link>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
