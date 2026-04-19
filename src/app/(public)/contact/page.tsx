import Link from "next/link";
import {
  Building2,
  CalendarDays,
  ExternalLink,
  Globe2,
  Mail,
  MapPin,
  Phone,
  Send,
} from "lucide-react";

import { getContactContent } from "@/lib/content/site-singletons";

const inquiryCategories = [
  { label: "General inquiry", value: "general" },
  { label: "Membership and alumni", value: "membership" },
  { label: "Certificate verification", value: "certificate" },
  { label: "Events and programs", value: "events" },
  { label: "Media and public relations", value: "media" },
  { label: "Partnership and sponsorship", value: "partnership" },
];

function SocialIcon({ label }: { label: string }) {
  const normalized = label.toLowerCase();

  if (normalized.includes("facebook")) {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
        <path
          d="M14.2 8.2h2.2V4.6A25.4 25.4 0 0 0 13.2 4c-3.2 0-5.4 1.9-5.4 5.4v3H4.4v4h3.4V24h4.1v-7.6h3.2l.5-4h-3.7V9.8c0-1.1.3-1.6 2.3-1.6Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  if (normalized.includes("linkedin")) {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
        <path
          d="M6.7 8.8H3.1V21h3.6V8.8ZM5 3a2.1 2.1 0 1 0 0 4.2A2.1 2.1 0 0 0 5 3Zm16 11c0-3.4-1.8-5.5-4.7-5.5a4 4 0 0 0-3.4 1.8V8.8H9.4V21H13v-6.5c0-1.7.8-2.7 2.2-2.7s2.2.9 2.2 2.7V21H21v-7Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  if (normalized.includes("youtube")) {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
        <path
          d="M21.6 7.2a3 3 0 0 0-2.1-2.1C17.6 4.6 12 4.6 12 4.6s-5.6 0-7.5.5a3 3 0 0 0-2.1 2.1A31.6 31.6 0 0 0 2 12a31.6 31.6 0 0 0 .4 4.8 3 3 0 0 0 2.1 2.1c1.9.5 7.5.5 7.5.5s5.6 0 7.5-.5a3 3 0 0 0 2.1-2.1A31.6 31.6 0 0 0 22 12a31.6 31.6 0 0 0-.4-4.8ZM10 15.5v-7l6 3.5-6 3.5Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path
        d="m4.8 4 5.7 7.7L4.4 20h2.7l4.7-6.3 4.6 6.3h3.2l-6.1-8.3L19.2 4h-2.7l-4.3 5.8L7.9 4H4.8Zm4 2 7.1 12h-1.4L7.4 6h1.4Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const contactContent = await getContactContent();
  const resolvedSearchParams = await searchParams;
  const message =
    typeof resolvedSearchParams.message === "string"
      ? resolvedSearchParams.message
      : null;
  const error =
    typeof resolvedSearchParams.error === "string"
      ? resolvedSearchParams.error
      : null;
  const phoneHref = `tel:${contactContent.phone.replace(/[^\d+]/g, "")}`;

  return (
    <main className="contact-page shell py-8 sm:py-10 lg:py-12">
      <section className="contact-shell" aria-labelledby="contact-form-title">
        <div className="contact-form-panel">
          <div className="contact-panel-heading">
            <span>Contact form</span>
            <h1 id="contact-form-title">Route your inquiry to the right team.</h1>
          </div>

          <div className="contact-status-region" aria-live="polite" aria-atomic="true">
            {message ? <p className="flash-panel" data-tone="success">{message}</p> : null}
            {error ? <p className="flash-panel" data-tone="error">{error}</p> : null}
          </div>

          <form
            action="/api/contact/submit"
            method="post"
            className="contact-form"
            id="contact-form"
          >
            <div className="contact-form-grid">
              <label className="input-label" htmlFor="contact-name">
                Name
                <input
                  id="contact-name"
                  name="name"
                  placeholder="e.g. Jakiya Rahman"
                  autoComplete="name"
                  required
                />
              </label>
              <label className="input-label" htmlFor="contact-email">
                Email address
                <input
                  id="contact-email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </label>
            </div>

            <label className="input-label" htmlFor="contact-category">
              Inquiry category
              <select id="contact-category" name="category" defaultValue="general" required>
                {inquiryCategories.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="input-label" htmlFor="contact-subject">
              Subject
              <input
                id="contact-subject"
                name="subject"
                placeholder="e.g. Certificate verification support"
                required
              />
            </label>

            <label className="input-label" htmlFor="contact-message">
              Message
              <textarea
                id="contact-message"
                name="message"
                rows={6}
                placeholder="Write your message here."
                required
              />
            </label>

            <div className="contact-honeypot" aria-hidden="true">
              <label htmlFor="contact-website">Website</label>
              <input id="contact-website" name="website" tabIndex={-1} autoComplete="off" />
            </div>

            <button className="primary-button contact-submit" type="submit">
              <Send aria-hidden="true" size={18} strokeWidth={2.2} />
              Send message
            </button>
          </form>
        </div>

        <aside className="contact-info-panel" aria-labelledby="contact-info-title">
          <div className="contact-panel-heading contact-panel-heading--info">
            <span>Official contact</span>
            <h2 id="contact-info-title">Contact JnUITS</h2>
          </div>

          <div className="contact-org-card">
            <Building2 aria-hidden="true" size={21} strokeWidth={2.1} />
            <div>
              <p>Jagannath University IT Society (JnUITS)</p>
              <span>{contactContent.organizationType}</span>
            </div>
          </div>

          <div className="contact-info-list">
            <Link
              className="contact-info-row"
              href={contactContent.googleBusinessHref}
              target="_blank"
            >
              <MapPin aria-hidden="true" size={20} strokeWidth={2.1} />
              <span>
                <strong>Address</strong>
                {contactContent.address}
              </span>
            </Link>
            <Link className="contact-info-row" href={`mailto:${contactContent.email}`}>
              <Mail aria-hidden="true" size={20} strokeWidth={2.1} />
              <span>
                <strong>Email</strong>
                {contactContent.email}
              </span>
            </Link>
            <Link className="contact-info-row" href={phoneHref}>
              <Phone aria-hidden="true" size={20} strokeWidth={2.1} />
              <span>
                <strong>Phone</strong>
                {contactContent.phone}
              </span>
            </Link>
            <div className="contact-info-row">
              <CalendarDays aria-hidden="true" size={20} strokeWidth={2.1} />
              <span>
                <strong>Founded</strong>
                Nov 11, 2015
              </span>
            </div>
          </div>

          <div className="contact-social-block">
            <h3>Social Media &amp; Links</h3>
            <div className="contact-social-icons" aria-label="Official JnUITS social media">
              {contactContent.socialLinks.map((item) => (
                <Link
                  key={item.href}
                  className="contact-social-icon"
                  href={item.href}
                  target="_blank"
                  aria-label={item.label}
                  title={item.label}
                >
                  <SocialIcon label={item.label} />
                </Link>
              ))}
            </div>
            <Link
              className="contact-business-link"
              href={contactContent.googleBusinessHref}
              target="_blank"
            >
              <Globe2 aria-hidden="true" size={18} strokeWidth={2.1} />
              Google Business Public Listing
              <ExternalLink aria-hidden="true" size={15} strokeWidth={2.1} />
            </Link>
          </div>
        </aside>
      </section>
    </main>
  );
}
