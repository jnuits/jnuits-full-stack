import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import { SiteBrand } from "@/components/layout/site-brand";
import { brandProfile } from "@/lib/branding";
import { getFooterContent } from "@/lib/content/site-singletons";
import { NewsletterSubscribeForm } from "@/components/newsletter/newsletter-subscribe-form";
import {
  publicFooterNavigation,
  publicPolicyNavigation,
  publicPrimaryNavigation,
  publicResourceNavigation,
} from "@/lib/site";

function FooterSocialIcon({ label }: { label: string }) {
  const normalized = label.toLowerCase();

  if (normalized.includes("group")) {
    return (
      <svg aria-hidden="true" focusable="false" fill="none" viewBox="0 0 24 24">
        <path
          d="M16 19c0-2.2-1.8-4-4-4H7c-2.2 0-4 1.8-4 4"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2"
        />
        <path
          d="M14.5 5.4a3 3 0 1 1 0 5.2M9.5 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM21 19c0-1.8-1.2-3.2-2.9-3.8"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

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

  if (normalized.includes("instagram")) {
    return (
      <svg aria-hidden="true" focusable="false" fill="none" viewBox="0 0 24 24">
        <rect
          height="16"
          rx="4.4"
          stroke="currentColor"
          strokeWidth="2"
          width="16"
          x="4"
          y="4"
        />
        <circle cx="12" cy="12" r="3.4" stroke="currentColor" strokeWidth="2" />
        <circle cx="16.7" cy="7.3" fill="currentColor" r="1.1" />
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

  if (normalized.includes("google")) {
    return (
      <svg aria-hidden="true" focusable="false" fill="none" viewBox="0 0 24 24">
        <path
          d="M12 21s6.5-5.8 6.5-11.1A6.5 6.5 0 0 0 5.5 9.9C5.5 15.2 12 21 12 21Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <path
          d="M14.7 10.1h-2.5v1.7h1.4c-.3.8-1 1.2-2 1.2a2.6 2.6 0 1 1 1.8-4.5l1.2-1.2A4.2 4.2 0 1 0 15.8 12c.1-.5.1-1 .1-1.4 0-.2 0-.4-.1-.5h-1.1Z"
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

function getFooterSocialKey(label: string) {
  const normalized = label.toLowerCase();

  if (normalized.includes("google")) return "google";
  if (normalized.includes("group")) return "facebook-group";
  if (normalized.includes("facebook")) return "facebook";
  if (normalized.includes("linkedin")) return "linkedin";
  if (normalized.includes("instagram")) return "instagram";
  if (normalized.includes("youtube")) return "youtube";
  return "twitter";
}

export async function SiteFooter() {
  const footerContent = await getFooterContent();

  return (
    <footer className="site-footer">
      <div className="shell grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-[1.2fr_0.75fr_0.85fr_0.75fr_1.15fr]">
        <div className="site-footer__brand-block sm:col-span-2 lg:col-span-1">
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
            className="site-footer-social-row"
          >
            {brandProfile.socialLinks.map((item) => (
              <Link
                aria-label={`${item.label} opens in a new tab`}
                className="site-footer-social-link"
                data-social={getFooterSocialKey(item.label)}
                href={item.href}
                key={item.href}
                rel="noopener noreferrer"
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
          <NewsletterSubscribeForm />
        </div>
      </div>
    </footer>
  );
}
