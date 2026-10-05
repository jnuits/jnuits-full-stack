"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type PublicIntake = {
  href: string;
  title: string;
};

const membershipContactHref =
  "/contact?category=membership&subject=Membership%20and%20alumni%20support";

export default function MembershipFormPage() {
  const [intake, setIntake] = useState<PublicIntake | null>(null);

  useEffect(() => {
    let active = true;

    void fetch("/api/forms/intake/membership")
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as PublicIntake;
      })
      .then((payload) => {
        if (active && payload?.href && payload?.title) setIntake(payload);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="shell py-12">
      <section className="glass-card grid gap-8 px-6 py-8 sm:px-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <span className="eyebrow">Membership policy</span>
          <h1 className="section-title mt-4">
            {intake ? "Apply for JnUITS membership" : "New public membership applications are currently closed"}
          </h1>
          <p className="section-copy mt-4">
            {intake
              ? `Start the ${intake.title} below. Confirm your email first, then the JnUITS review team will review your application.`
              : "Membership is currently granted through an invitation-first onboarding process. Current invited members can claim their profile from the registration page, and applicants can contact support for onboarding assistance."}
          </p>

          <div className="mt-8 route-grid">
            {intake ? (
              <article className="route-tile">
                <h3>Start a new application</h3>
                <p>Submit your details through the current secure membership intake form.</p>
                <Link href={intake.href} className="primary-button mt-4 inline-flex">
                  Open application form
                </Link>
              </article>
            ) : null}
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
                membership application.
              </p>
              <Link
                href={membershipContactHref}
                className="secondary-button mt-4 inline-flex"
              >
                Contact JnUITS
              </Link>
            </article>
          </div>
        </div>

        <div className="grid gap-6">
          <article className="route-tile">
            <h3>Sign in to your member portal</h3>
            <p className="text-sm leading-6 text-[var(--muted-foreground)]">
              If you have already claimed your profile, sign in to access your portal
              dashboard, update your details, and view your membership history.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/portal/login" className="secondary-button">
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
