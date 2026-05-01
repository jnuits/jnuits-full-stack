import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, GraduationCap, IdCard, Mail, Search } from "lucide-react";

import { getAppBaseUrl } from "@/lib/env";

export const metadata: Metadata = {
  description:
    "Alumni access for former Jagannath University IT Society members, including invited alumni claims and verification support for unlisted former members.",
  openGraph: {
    description:
      "Claim an invited alumni profile or request verification if you were previously part of JnUITS but are not listed yet.",
    siteName: "JnUITS",
    title: "Alumni Access | JnUITS",
    type: "website",
    url: `${getAppBaseUrl()}/alumni`,
  },
  title: "Alumni Access | JnUITS",
};

const contactHref =
  "/contact?category=membership&subject=Alumni%20verification%20request";

export default function AlumniAccessPage() {
  return (
    <main className="shell py-12">
      <section className="glass-card grid gap-8 px-6 py-8 sm:px-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <span className="eyebrow">Alumni access</span>
          <h1 className="section-title mt-4">
            Join the JnUITS alumni network with your permanent member identity.
          </h1>
          <p className="section-copy mt-4">
            Alumni keep the same JnUITS membership ID they received as members.
            If your record is already invited, claim it with your code. If you
            were part of JnUITS before the current directory existed, request
            verification so the team can create or reconcile your alumni record.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="primary-button" href="/register">
              Claim invited profile
              <ArrowRight aria-hidden="true" size={17} />
            </Link>
            <Link className="secondary-button" href={contactHref}>
              Request alumni verification
            </Link>
          </div>
        </div>

        <div className="grid gap-4">
          <article className="route-tile">
            <GraduationCap
              aria-hidden="true"
              className="text-[var(--brand-blue)]"
              size={24}
            />
            <h2>Already listed or invited</h2>
            <p>
              Use your invitation code to claim the profile. Your member ID
              remains fixed for alumni access and public directory display.
            </p>
            <Link className="ghost-button mt-4 inline-flex" href="/register">
              Claim profile
            </Link>
          </article>

          <article className="route-tile">
            <IdCard
              aria-hidden="true"
              className="text-[var(--brand-blue)]"
              size={24}
            />
            <h2>Former member not listed yet</h2>
            <p>
              Past JnUITS participants can request alumni verification even if
              they never received a modern membership ID or are missing from the
              current directory.
            </p>
            <Link className="ghost-button mt-4 inline-flex" href={contactHref}>
              Start verification
            </Link>
          </article>
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <article className="route-tile">
          <Search
            aria-hidden="true"
            className="text-[var(--brand-blue)]"
            size={22}
          />
          <h2>Browse alumni directory</h2>
          <p>
            View public alumni profiles that have opted in to directory
            visibility.
          </p>
          <Link className="secondary-button mt-4 inline-flex" href="/members?type=alumni">
            View alumni
          </Link>
        </article>

        <article className="route-tile">
          <Mail
            aria-hidden="true"
            className="text-[var(--brand-blue)]"
            size={22}
          />
          <h2>Need help choosing the right path?</h2>
          <p>
            Contact the membership team with your name, department, batch, and
            any proof of past JnUITS involvement so they can review it.
          </p>
          <Link className="secondary-button mt-4 inline-flex" href={contactHref}>
            Contact membership team
          </Link>
        </article>
      </section>
    </main>
  );
}
