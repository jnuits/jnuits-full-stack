import type { Metadata } from "next";
import Link from "next/link";
import { brandProfile } from "@/lib/branding";

export const metadata: Metadata = {
  title: "Terms of Service | JnUITS",
  description:
    "Terms of service for Jagannath University IT Society public website and member portal.",
};

const sections = [
  {
    title: "Use of the platform",
    body:
      "The website and portal are provided for society information, certificate verification, membership workflows, approved public content, and administrative operations connected to Jagannath University IT Society.",
  },
  {
    title: "Accounts and portal access",
    body:
      "Portal accounts are intended for authorized members and administrators. Users are responsible for keeping account credentials secure and using access only for permitted society workflows.",
  },
  {
    title: "Certificate verification",
    body:
      "Certificate pages verify records stored in the JnUITS system. A successful lookup confirms that the certificate identifier exists in the current verification database.",
  },
  {
    title: "Submitted content",
    body:
      "Messages, applications, profile updates, workplace updates, blog drafts, and media submissions may be reviewed by authorized operators before action or publication.",
  },
  {
    title: "Acceptable use",
    body:
      "Do not submit false information, attempt unauthorized access, interfere with platform operations, scrape restricted data, or misuse public forms and portal features.",
  },
  {
    title: "Changes to these terms",
    body:
      "JnUITS may update these terms as the platform matures. Continued use of the website or portal after updates means the latest terms apply.",
  },
];

export default function TermsOfServicePage() {
  return (
    <div className="shell py-12">
      <section className="glass-card px-6 py-8 sm:px-8">
        <span className="eyebrow">Policies</span>
        <h1 className="section-title mt-4">Terms of Service</h1>
        <p className="section-copy mt-5">
          These terms describe expected use of the {brandProfile.fullName} public
          website, certificate verification tools, member portal, and operator
          workflows.
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
          <p className="section-divider">Contact</p>
          <p className="mt-5 text-sm leading-7 text-[var(--muted-foreground)]">
            Questions about these terms can be sent to{" "}
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
