"use client";

import { useState } from "react";
import Link from "next/link";

type MembershipStatus = "pending" | "approved" | "rejected";

const statusClassNames: Record<MembershipStatus, string> = {
  pending: "text-[var(--brand-gold)]",
  approved: "text-[var(--brand-green)]",
  rejected: "text-[var(--brand-rust)]",
};

export default function MembershipFormPage() {
  const [statusEmail, setStatusEmail] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusValue, setStatusValue] = useState<MembershipStatus | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  async function handleStatusCheck() {
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
        | { found?: boolean; status?: MembershipStatus | null; message?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.message || "Unable to check application status.");
      }

      if (!payload?.found || !payload.status) {
        setStatusMessage("No legacy application was found for this email.");
        return;
      }

      setStatusValue(payload.status);
      setStatusMessage(`Latest recorded status: ${payload.status}`);
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
            The public intake form is now disabled while invitation-first onboarding
            and claim-based membership flows run through the portal. Previous
            applicants can still check status by email.
          </p>

          <div className="mt-8 route-grid">
            <article className="route-tile">
              <h3>Already invited?</h3>
              <p>Use your invitation code to claim your profile and continue safely.</p>
              <Link href="/register" className="secondary-button mt-4 inline-flex">
                Claim profile
              </Link>
            </article>
            <article className="route-tile">
              <h3>Need assistance?</h3>
              <p>
                Contact the operators for onboarding support if you are unsure about
                claim eligibility.
              </p>
              <Link href="/contact" className="secondary-button mt-4 inline-flex">
                Contact JnUITS
              </Link>
            </article>
          </div>
        </div>

        <div className="grid gap-6">
          <article className="route-tile">
            <h3>Legacy application status</h3>
            <p className="mb-4">
              Check the latest review status for a previously submitted public
              application.
            </p>
            <input
              type="email"
              placeholder="Application email"
              value={statusEmail}
              onChange={(event) => setStatusEmail(event.target.value)}
            />
            <button
              className="secondary-button mt-3"
              disabled={isCheckingStatus}
              onClick={handleStatusCheck}
              type="button"
            >
              {isCheckingStatus ? "Checking..." : "Check status"}
            </button>
            {statusMessage ? (
              <p
                className={`mt-3 text-sm font-semibold ${
                  statusValue ? statusClassNames[statusValue] : "text-[var(--muted)]"
                }`}
              >
                {statusMessage}
              </p>
            ) : null}
          </article>

          <article className="route-tile">
            <h3>Next onboarding path</h3>
            <p>
              The active onboarding model now prioritizes secure invitation + claim
              flows over open intake submission.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/login" className="secondary-button">
                Sign in
              </Link>
              <Link href="/register" className="ghost-button">
                Open claim page
              </Link>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
