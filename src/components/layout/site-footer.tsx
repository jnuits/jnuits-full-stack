import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import { SiteBrand } from "@/components/layout/site-brand";
import { brandProfile } from "@/lib/branding";
import { getFooterContent } from "@/lib/content/site-singletons";
import {
  publicFooterNavigation,
  publicPolicyNavigation,
  publicPrimaryNavigation,
  publicResourceNavigation,
} from "@/lib/site";

function FooterSocialIcon({ label }: { label: string }) {
  const normalized = label.toLowerCase();

  if (normalized.includes("facebook")) {
    return (
      <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
        <path
          d="M14.2 8.2h2.2V4.6A25.4 25.4 0 0 0 13.2 4c-3.2 0-5.4 1.9-5.4 5.4v3H4.4v4h3.4V24h4.1v-7.6h3.2l.5-4h-3.7V9.8c0-1.1.3-1.6 2.3-1.6Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  if (normalized.includes("linkedin")) {
    return (
      <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
        <path
          d="M6.7 8.8H3.1V21h3.6V8.8ZM5 3a2.1 2.1 0 1 0 0 4.2A2.1 2.1 0 0 0 5 3Zm16 11c0-3.4-1.8-5.5-4.7-5.5a4 4 0 0 0-3.4 1.8V8.8H9.4V21H13v-6.5c0-1.7.8-2.7 2.2-2.7s2.2.9 2.2 2.7V21H21v-7Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  if (normalized.includes("youtube")) {
    return (
      <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
        <path
          d="M21.6 7.2a3 3 0 0 0-2.1-2.1C17.6 4.6 12 4.6 12 4.6s-5.6 0-7.5.5a3 3 0 0 0-2.1 2.1A31.6 31.6 0 0 0 2 12a31.6 31.6 0 0 0 .4 4.8 3 3 0 0 0 2.1 2.1c1.9.5 7.5.5 7.5.5s5.6 0 7.5-.5a3 3 0 0 0 2.1-2.1A31.6 31.6 0 0 0 22 12a31.6 31.6 0 0 0-.4-4.8ZM10 15.5v-7l6 3.5-6 3.5Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path
        d="m4.8 4 5.7 7.7L4.4 20h2.7l4.7-6.3 4.6 6.3h3.2l-6.1-8.3L19.2 4h-2.7l-4.3 5.8L7.9 4H4.8Zm4 2 7.1 12h-1.4L7.4 6h1.4Z"
        fill="currentColor"
      />
    </svg>
  );
}

export async function SiteFooter() {
  const footerContent = await getFooterContent();

  return (
    <footer className="site-footer mt-20">
      <div className="shell grid gap-8 py-12 lg:grid-cols-[1.2fr_0.75fr_0.85fr_0.75fr_1.15fr]">
        <div className="site-footer__brand-block">
          <SiteBrand displayTitle="JnU IT Society" inverted />
          <div className="site-footer-contact">
            <Link
              className="site-footer-contact__link"
              href={`mailto:${footerContent.email}`}
            >
              <Mail aria-hidden="true" size={16} strokeWidth={1.9} />
              <span>{footerContent.email}</span>
            </Link>
            <Link
              className="site-footer-contact__link"
              href={`tel:${footerContent.phone.replace(/[^\d+]/g, "")}`}
            >
              <Phone aria-hidden="true" size={16} strokeWidth={1.9} />
              <span>{footerContent.phone}</span>
            </Link>
          </div>
          <nav
            aria-label="Official JnU IT Society social media"
            className="site-footer-social"
          >
            {brandProfile.socialLinks.map((item) => (
              <Link
                aria-label={item.label}
                className="site-footer-social__link"
                href={item.href}
                key={item.href}
                target="_blank"
                title={item.label}
              >
                <FooterSocialIcon label={item.label} />
              </Link>
            ))}
          </nav>
        </div>

        <div className="site-footer__desktop-links">
          <p className="site-footer__column-title">
            Primary
          </p>
          <div className="mt-3 grid gap-2 text-sm text-white/80">
            {publicPrimaryNavigation.map((item) => (
              <Link href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <p className="site-footer__column-title">
            Resources
          </p>
          <div className="mt-3 grid gap-2 text-sm text-white/80">
            {publicResourceNavigation.map((item) => (
              <Link
                className="site-footer__header-repeat"
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
            {publicFooterNavigation.map((item) => (
              <Link href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <p className="site-footer__column-title">
            Policies
          </p>
          <div className="mt-3 grid gap-2 text-sm text-white/80">
            {publicPolicyNavigation.map((item) => (
              <Link href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <p className="site-footer__column-title">
            Newsletter
          </p>
          <p className="mt-3 text-sm leading-7 text-white/70">
            Get updates about events, notices, and member opportunities.
          </p>
          <form
            action="/api/contact/submit"
            className="site-footer-newsletter"
            method="post"
          >
            <input name="name" type="hidden" value="Newsletter subscriber" />
            <input name="category" type="hidden" value="general" />
            <input
              name="subject"
              type="hidden"
              value="Newsletter subscription request"
            />
            <input
              name="message"
              type="hidden"
              value="Please add this email address to the JnU IT Society newsletter list."
            />
            <label className="sr-only" htmlFor="footer-newsletter-email">
              Email address
            </label>
            <input
              autoComplete="email"
              id="footer-newsletter-email"
              name="email"
              placeholder="you@example.com"
              required
              type="email"
            />
            <div className="site-footer-newsletter__trap" aria-hidden="true">
              <label htmlFor="footer-newsletter-website">Website</label>
              <input
                autoComplete="off"
                id="footer-newsletter-website"
                name="website"
                tabIndex={-1}
              />
            </div>
            <button type="submit">Subscribe</button>
          </form>
        </div>
      </div>
    </footer>
  );
}
