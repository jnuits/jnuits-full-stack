import Link from "next/link";
import { getContactContent } from "@/lib/content/site-singletons";

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

  return (
    <div className="shell py-12">
      <div className="glass-card grid gap-8 px-6 py-8 sm:px-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <span className="eyebrow">Contact</span>
          <h1 className="section-title mt-4">{contactContent.title}</h1>
          <p className="section-copy mt-4">{contactContent.summary}</p>
          {message ? <p className="status-pill mt-6">{message}</p> : null}
          {error ? (
            <p className="mt-4 text-sm font-semibold text-[var(--brand-rust)]">{error}</p>
          ) : null}
          <form action="/api/contact/submit" method="post" className="mt-8 grid gap-4" id="contact-form">
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
            <label className="input-label" htmlFor="contact-subject">
              Subject
              <input
                id="contact-subject"
                name="subject"
                placeholder="e.g. Membership enquiry"
                required
              />
            </label>
            <label className="input-label" htmlFor="contact-message">
              Message
              <textarea
                id="contact-message"
                name="message"
                rows={7}
                placeholder="How can we help?"
                required
              />
            </label>
            <div style={{ display: "none" }}>
              <input name="website" tabIndex={-1} autoComplete="off" />
            </div>
            <button className="primary-button w-full sm:w-fit" type="submit">
              Send message
            </button>
          </form>
        </div>

        <div className="route-grid content-start">
          <article className="route-tile">
            <h3>{contactContent.university}</h3>
            <p>
              <Link href={`mailto:${contactContent.email}`}>{contactContent.email}</Link>
            </p>
          </article>
          <article className="route-tile">
            <h3>Type</h3>
            <p>{contactContent.organizationType}</p>
          </article>
          <article className="route-tile">
            <h3>Located in</h3>
            <p>{contactContent.location}</p>
          </article>
          <article className="route-tile">
            <h3>Address</h3>
            <p>{contactContent.address}</p>
          </article>
          <article className="route-tile">
            <h3>Phone</h3>
            <p>
              <Link href={`tel:${contactContent.phone.replace(/\s+/g, "")}`}>
                {contactContent.phone}
              </Link>
            </p>
          </article>
          <article className="route-tile">
            <h3>Founded</h3>
            <p>{contactContent.foundedLabel}</p>
          </article>
          <article className="route-tile">
            <h3>Social links</h3>
            <div className="grid gap-2 text-sm leading-7 text-[var(--brand-ink)]">
              {contactContent.socialLinks.map((item) => (
                <Link key={item.href} href={item.href} target="_blank">
                  {item.label}
                </Link>
              ))}
            </div>
          </article>
          <article className="route-tile">
            <h3>Google Business</h3>
            <p>
              <Link href={contactContent.googleBusinessHref} target="_blank">
                View public business listing
              </Link>
            </p>
          </article>
        </div>
      </div>
    </div>
  );
}
