"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type PublicIntake = {
  href: string;
  title: string;
};

export default function AlumniJoinPage() {
  const [intake, setIntake] = useState<PublicIntake | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void fetch("/api/forms/intake/alumni")
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as PublicIntake;
      })
      .then((payload) => {
        if (active) setIntake(payload?.href && payload?.title ? payload : null);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="shell py-12">
      <section className="glass-card max-w-2xl px-6 py-8 sm:px-8">
        <h1 className="section-title">Join the JnUITS alumni community</h1>
        <p className="section-copy mt-4">
          Former members can request alumni onboarding. We will verify the request, reconcile your existing member record when possible, and send the normal account claim invitation after approval.
        </p>
        {isLoading ? (
          <p className="mt-6 text-sm font-semibold text-[var(--muted-foreground)]" role="status">
            Loading alumni onboarding…
          </p>
        ) : intake ? (
          <Link className="primary-button mt-6 inline-flex" href={intake.href}>
            Open {intake.title}
          </Link>
        ) : (
          <div className="mt-6 rounded-lg border border-[var(--line)] bg-[var(--bg)] p-4">
            <p className="text-sm leading-6 text-[var(--muted-foreground)]">
              Alumni onboarding is not open at the moment. Contact JnUITS for help with an existing member record or a future intake.
            </p>
            <Link className="secondary-button mt-4 inline-flex" href="/contact?category=membership&subject=Alumni%20onboarding%20support">
              Contact JnUITS
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
