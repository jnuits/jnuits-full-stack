import type { Metadata } from "next";
import Link from "next/link";
import { brandProfile } from "@/lib/branding";

export const metadata: Metadata = {
  title: "Privacy Policy | JnUITS",
  description:
    "Privacy policy for Jagannath University IT Society public website and member portal.",
};

const sections = [
  {
    title: "Information we collect",
    body:
      "We may collect contact details, membership application data, certificate lookup identifiers, portal account information, profile update requests, and messages submitted through official forms.",
  },
  {
    title: "How we use information",
    body:
      "We use submitted information to operate society programs, verify certificates, manage membership and portal access, respond to inquiries, publish approved public content, and protect the platform from abuse.",
  },
  {
    title: "Service providers",
    body:
      "The platform may use trusted providers such as Supabase for authentication and database services, Resend for email delivery, Cloudinary for uploaded media, Sentry for error monitoring, and Vercel for hosting.",
  },
  {
    title: "Data protection",
    body:
      "Administrative access is restricted by role-based controls. Sensitive member updates are moderated, and public visibility is limited to information approved for publication or directory display.",
  },
  {
    title: "Your choices",
    body:
      "Members may request profile corrections, workplace updates, or visibility changes through the member portal or by contacting the society through the official contact email.",
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="shell py-12">
      <section className="glass-card px-6 py-8 sm:px-8">
        <span className="eyebrow">Policies</span>
        <h1 className="section-title mt-4">Privacy Policy</h1>
        <p className="section-copy mt-5">
          This policy explains how {brandProfile.fullName} ({brandProfile.shortName})
          handles information submitted through the public website, certificate
          verification paths, membership flows, and member portal.
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
        <article className="section-band">
          <p className="section-divider">Contact for privacy requests</p>
          <p className="mt-5 text-sm leading-7 text-[var(--muted-foreground)]">
            For privacy questions or correction requests, contact{" "}
            <Link className="queue-link" href={`mailto:${brandProfile.email}`}>
              {brandProfile.email}
            </Link>
            . This boilerplate should be reviewed before final production
            launch.
          </p>
        </article>
      </section>
    </div>
  );
}
