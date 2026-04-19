import type { Metadata } from "next";
import Link from "next/link";
import { brandProfile } from "@/lib/branding";

export const metadata: Metadata = {
  title: "Cookie Policy | JnUITS",
  description:
    "Cookie policy for Jagannath University IT Society public website and member portal.",
};

const sections = [
  {
    title: "Essential cookies",
    body:
      "We use essential cookies and similar browser storage to keep authentication sessions, theme preferences, form protections, and security controls working correctly.",
  },
  {
    title: "Preference storage",
    body:
      "The site may store non-sensitive preferences such as light or dark mode so the interface remains consistent on your next visit.",
  },
  {
    title: "Analytics and monitoring",
    body:
      "The platform may use privacy-conscious observability tools to understand errors, performance, and reliability. These tools help operators maintain the website and portal.",
  },
  {
    title: "Managing cookies",
    body:
      "You can clear or block cookies from your browser settings. Some authenticated portal features may stop working if essential cookies are disabled.",
  },
];

export default function CookiePolicyPage() {
  return (
    <div className="shell py-12">
      <section className="glass-card px-6 py-8 sm:px-8">
        <span className="eyebrow">Policies</span>
        <h1 className="section-title mt-4">Cookie Policy</h1>
        <p className="section-copy mt-5">
          This policy explains how {brandProfile.fullName} uses cookies and
          browser storage across the public website, certificate verification,
          member portal, and operator workspace.
        </p>
        <p className="mt-5 text-sm font-semibold text-[var(--muted-foreground)]">
          Last updated: April 19, 2026
        </p>
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        {sections.map((section) => (
          <article className="section-band" key={section.title}>
            <p className="section-divider">{section.title}</p>
            <p className="mt-5 text-sm leading-7 text-[var(--muted-foreground)]">
              {section.body}
            </p>
          </article>
        ))}
        <article className="section-band lg:col-span-2">
          <p className="section-divider">Questions</p>
          <p className="mt-5 text-sm leading-7 text-[var(--muted-foreground)]">
            For questions about cookie usage, contact{" "}
            <Link className="queue-link" href={`mailto:${brandProfile.email}`}>
              {brandProfile.email}
            </Link>
            .
          </p>
        </article>
      </section>
    </div>
  );
}
