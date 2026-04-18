import Link from "next/link";

import { brandProfile } from "@/lib/branding";
import { getContactContent } from "@/lib/content/site-singletons";

const inquiryCategories = [
  { label: "General inquiry", value: "general" },
  { label: "Membership and alumni", value: "membership" },
  { label: "Certificate verification", value: "certificate" },
  { label: "Events and programs", value: "events" },
  { label: "Media and public relations", value: "media" },
  { label: "Partnership and sponsorship", value: "partnership" },
];

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
  const facebookLink = contactContent.socialLinks.find(
    (item) => item.label.toLowerCase() === "facebook"
  );
  const phoneHref = `tel:${contactContent.phone.replace(/[^\d+]/g, "")}`;

  return (
    <div className="contact-page shell py-10 sm:py-12 lg:py-16">
      <section className="contact-hero">
        <div className="contact-hero__copy">
          <span className="eyebrow">Official contact hub</span>
          <h1 className="section-title mt-4">{contactContent.title}</h1>
          <p className="section-copy mt-4">{contactContent.summary}</p>
          <p className="contact-slogan">{brandProfile.slogan}</p>
          <div className="contact-actions" aria-label="Primary contact actions">
            <Link className="primary-button" href={`mailto:${contactContent.email}`}>
              Email JnUITS
            </Link>
            <Link className="secondary-button" href={phoneHref}>
              Call {contactContent.phone}
            </Link>
            {facebookLink ? (
              <Link className="ghost-button" href={facebookLink.href} target="_blank">
                Latest updates on Facebook
              </Link>
            ) : null}
          </div>
        </div>

        <aside className="contact-hero__card" aria-label="Organization details">
          <p className="contact-card-kicker">{contactContent.organizationType}</p>
          <h2>{brandProfile.fullName}</h2>
          <dl className="contact-facts">
            <div>
              <dt>Located in</dt>
              <dd>{contactContent.location}</dd>
            </div>
            <div>
              <dt>Address</dt>
              <dd>{contactContent.address}</dd>
            </div>
            <div>
              <dt>Founded</dt>
              <dd>{contactContent.foundedLabel}</dd>
            </div>
          </dl>
        </aside>
      </section>

      <section className="contact-layout mt-8 lg:mt-10">
        <div className="contact-form-card">
          <div>
            <span className="eyebrow">Send a message</span>
            <h2 className="contact-section-title mt-4">Route your inquiry to the right team.</h2>
            <p className="section-copy mt-3" id="contact-guidance">
              Choose the closest category, include the useful context, and the JnUITS
              team will respond through the email address you provide.
            </p>
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
            aria-describedby="contact-guidance"
          >
            <div className="contact-form-grid">
              <label className="input-label" htmlFor="contact-name">
                Your name
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
                rows={7}
                placeholder="Share certificate IDs, event names, membership IDs, or dates when useful."
                required
              />
            </label>

            <div className="contact-honeypot" aria-hidden="true">
              <label htmlFor="contact-website">Website</label>
              <input id="contact-website" name="website" tabIndex={-1} autoComplete="off" />
            </div>

            <button className="primary-button contact-submit" type="submit">
              Send message
            </button>
          </form>
        </div>

        <aside className="contact-directory" aria-label="Contact directory">
          <article className="contact-directory-card contact-directory-card--highlight">
            <span>Most active channel</span>
            <h3>Follow JnUITS on Facebook</h3>
            <p>
              Event announcements, club updates, and public notices are usually published
              on Facebook first.
            </p>
            {facebookLink ? (
              <Link href={facebookLink.href} target="_blank">
                Open Facebook page
              </Link>
            ) : null}
          </article>

          <div className="contact-detail-grid">
            <article className="contact-directory-card">
              <span>Email</span>
              <h3>{contactContent.email}</h3>
              <Link href={`mailto:${contactContent.email}`}>Send email</Link>
            </article>
            <article className="contact-directory-card">
              <span>Phone</span>
              <h3>{contactContent.phone}</h3>
              <Link href={phoneHref}>Call now</Link>
            </article>
            <article className="contact-directory-card">
              <span>Google Business</span>
              <h3>Public listing</h3>
              <Link href={contactContent.googleBusinessHref} target="_blank">
                View listing
              </Link>
            </article>
            <article className="contact-directory-card">
              <span>Social media</span>
              <h3>Official accounts</h3>
              <div className="contact-social-list">
                {contactContent.socialLinks.map((item) => (
                  <Link key={item.href} href={item.href} target="_blank">
                    {item.label}
                  </Link>
                ))}
              </div>
            </article>
          </div>
        </aside>
      </section>
    </div>
  );
}
