import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Award,
  Bell,
  Calendar,
  CalendarDays,
  Clock,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  Phone,
  UserPlus,
} from "lucide-react";

import { getContactContent } from "@/lib/content/site-singletons";
import type { ContactSettings } from "@/lib/contact-settings";
import { getContactSettings } from "@/lib/contact-settings";

import { ContactFormCard } from "./contact-form-card";

export const metadata: Metadata = {
  title: "Contact — JnU IT Society",
  description:
    "Get in touch with Jagannath University IT Society. Send a message, find our address, or connect on social media.",
};

const inquiryCategories = [
  { label: "General Inquiry", value: "general" },
  { label: "Membership & Registration", value: "membership_registration" },
  { label: "Event Collaboration", value: "event_collaboration" },
  { label: "Sponsorship & Partnership", value: "sponsorship_partnership" },
  { label: "Certificate Verification", value: "certificate_verification" },
  { label: "Media & Press", value: "media_press" },
  { label: "Technical Support", value: "technical_support" },
  { label: "Workshop & Training", value: "workshop_training" },
  { label: "Job & Internship Posting", value: "job_internship_posting" },
  { label: "Feedback & Suggestions", value: "feedback_suggestions" },
];

const jnuitsMapEmbedSrc =
  "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3653.075248110007!2d90.40602729229096!3d23.70900673544924!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3755b9072c00d493%3A0x4c7a9385bc430a6f!2sJagannath%20University%20IT%20Society!5e0!3m2!1sen!2sbd!4v1778303281126!5m2!1sen!2sbd";

const quickLinks = [
  {
    label: "Membership form",
    href: "/membership-form",
    icon: UserPlus,
  },
  {
    label: "Notices & announcements",
    href: "/notices",
    icon: Bell,
  },
  {
    label: "Upcoming events",
    href: "/events",
    icon: Calendar,
  },
  {
    label: "Certificate verification",
    href: "/certificates",
    icon: Award,
  },
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

function badgeClass(tone: string) {
  if (tone === "primary") {
    return "bg-primary text-primary-foreground";
  }

  if (tone === "outline") {
    return "border border-blue-200/60 bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400";
  }

  return "border border-border bg-muted text-muted-foreground";
}

function contactRoleBadgeClass(tone: string) {
  return `inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none ${badgeClass(
    tone,
  )}`;
}

function ContactGroup({
  children,
  icon,
  label,
}: {
  children: ReactNode;
  icon: ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/[0.12] text-primary dark:bg-primary/[0.18]">
        {icon}
      </div>
      <div className="min-w-0 grow">
        <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        {children}
      </div>
    </div>
  );
}

function socialHoverClass(label: string) {
  const normalized = label.toLowerCase();

  if (normalized.includes("facebook")) {
    return "hover:border-blue-600 hover:bg-blue-600 hover:text-white";
  }

  if (normalized.includes("linkedin")) {
    return "hover:border-blue-700 hover:bg-blue-700 hover:text-white";
  }

  if (normalized.includes("youtube")) {
    return "hover:border-red-600 hover:bg-red-600 hover:text-white";
  }

  return "hover:border-black hover:bg-black hover:text-white";
}

function mailHref(value: string) {
  return `mailto:${value}`;
}

function phoneHref(value: string) {
  return `tel:${value.replace(/[^\d+]/g, "")}`;
}

type OfficialContactProps = {
  googleBusinessHref: string;
  settings: ContactSettings;
  socialLinks: Array<{
    href: string;
    label: string;
  }>;
};

function OfficialContact({ googleBusinessHref, settings, socialLinks }: OfficialContactProps) {
  const contactEmails = [
    {
      href: mailHref(settings.email_primary),
      label: "Primary",
      tone: "primary",
      value: settings.email_primary,
    },
    {
      href: mailHref(settings.email_university),
      label: "University",
      tone: "outline",
      value: settings.email_university,
    },
    {
      href: mailHref(settings.email_legacy),
      label: "Legacy",
      tone: "muted",
      value: settings.email_legacy,
    },
  ];
  const contactPhones = [settings.phone_primary, settings.phone_secondary].filter(Boolean);
  const officeHours = [
    { day: "Saturday", hours: settings.hours_sat },
    { day: "Sunday", hours: settings.hours_sun },
    { day: "Monday", hours: settings.hours_mon },
    { day: "Tuesday", hours: settings.hours_tue },
    { day: "Wednesday", hours: settings.hours_wed },
    { day: "Thursday", hours: settings.hours_thu },
    { day: "Friday", hours: settings.hours_fri },
  ];
  const weekendHours =
    settings.hours_fri.trim().toLowerCase() === "closed" &&
    settings.hours_sat.trim().toLowerCase() === "closed"
      ? "Closed"
      : `${settings.hours_fri} / ${settings.hours_sat}`;
  const compactOfficeHours = [
    { day: "Sun - Thu", hours: settings.hours_sun },
    { day: "Fri - Sat", hours: weekendHours },
  ];

  return (
    <aside
      className="order-1 flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm xl:order-2"
      aria-labelledby="contact-info-title"
    >
      <div className="h-[3px] rounded-t-2xl bg-primary/50" aria-hidden="true" />
      <div className="flex flex-1 flex-col p-6">
        <div>
          <h2 id="contact-info-title" className="text-xl font-bold text-foreground">
            Jagannath University IT Society
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Non-profit University IT Club</p>
        </div>

        <div className="my-6 h-px bg-border" aria-hidden="true" />

        <div className="space-y-3">
          <ContactGroup icon={<Mail aria-hidden="true" size={18} />} label="Email">
            <div className="flex flex-col gap-2">
              {contactEmails.map((item) => (
                <div key={item.value} className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <a
                    href={item.href}
                    aria-label={`Email ${item.label.toLowerCase()} address ${item.value}`}
                    className={
                      item.tone === "primary"
                        ? "break-all text-sm font-medium leading-6 text-foreground transition-colors hover:text-primary"
                        : "break-all text-sm leading-6 text-muted-foreground transition-colors hover:text-primary"
                    }
                  >
                    {item.value}
                  </a>
                  <span className={contactRoleBadgeClass(item.tone)}>{item.label}</span>
                </div>
              ))}
            </div>
          </ContactGroup>

          <ContactGroup icon={<Phone aria-hidden="true" size={18} />} label="Phone">
            <div className="flex flex-col gap-2">
              {contactPhones.map((phone) => (
                <div key={phone}>
                  <a
                    href={phoneHref(phone)}
                    aria-label={`Call ${phone}`}
                    className="text-sm font-medium leading-6 text-foreground transition-colors hover:text-primary"
                  >
                    {phone}
                  </a>
                </div>
              ))}
            </div>
          </ContactGroup>

          <ContactGroup icon={<MapPin aria-hidden="true" size={18} />} label="Address">
            <p className="text-sm font-medium leading-relaxed text-foreground">
              {settings.address}
            </p>
          </ContactGroup>

          <ContactGroup icon={<CalendarDays aria-hidden="true" size={18} />} label="Founded">
            <p className="text-sm font-medium text-foreground">{settings.founded_date}</p>
          </ContactGroup>
        </div>

        <div className="mt-6">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Follow us
          </p>
          <div
            className="flex flex-wrap gap-2"
            aria-label="Official Jagannath University IT Society social media"
          >
            {socialLinks.map((item) => (
              <a
                key={item.href}
                className={`flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted/50 text-muted-foreground transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${socialHoverClass(
                  item.label,
                )}`}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${item.label} (opens in new tab)`}
                title={item.label}
              >
                <span className="h-4 w-4">
                  <SocialIcon label={item.label} />
                </span>
              </a>
            ))}
          </div>

          <a
            href={googleBusinessHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open Google Business Listing in a new tab"
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition-all hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <Globe aria-hidden="true" size={15} />
            Google Business Listing
            <ExternalLink aria-hidden="true" size={13} className="text-muted-foreground" />
          </a>
        </div>

        <div className="mt-2 hidden border-t border-border/50 pt-4 xl:block">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Quick links
          </p>
          <div className="space-y-1">
            {quickLinks.map(({ label, href, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <Icon
                  aria-hidden="true"
                  size={14}
                  className="flex-shrink-0 text-muted-foreground/60 transition-colors group-hover:text-primary"
                />
                <span>{label}</span>
                <ArrowRight
                  aria-hidden="true"
                  size={12}
                  className="ml-auto text-primary opacity-0 transition-opacity group-hover:opacity-100"
                />
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-6 border-t border-border/50 pt-4">
          <ContactGroup icon={<Clock aria-hidden="true" size={18} />} label="Office hours">
            <div className="mt-2 space-y-1.5 xl:hidden">
              {compactOfficeHours.map(({ day, hours }) => {
                const value = hours.trim();
                const isClosed = !value || value.toLowerCase() === "closed";

                return (
                  <div key={day} className="flex items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground">{day}</span>
                    {isClosed ? (
                      <span className="text-xs italic text-muted-foreground">Closed</span>
                    ) : (
                      <span className="text-xs font-medium text-foreground">{value}</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-2 hidden space-y-1.5 xl:block">
              {officeHours.map(({ day, hours }) => {
                const value = hours.trim();
                const isClosed = !value || value.toLowerCase() === "closed";

                return (
                  <div key={day} className="flex items-center justify-between gap-2">
                    <span className="w-24 flex-shrink-0 text-xs text-muted-foreground">
                      {day}
                    </span>
                    {isClosed ? (
                      <span className="text-xs italic text-muted-foreground">Closed</span>
                    ) : (
                      <span className="text-xs font-medium text-foreground">{value}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </ContactGroup>
        </div>
      </div>
    </aside>
  );
}

function ContactHero() {
  return (
    <section className="px-6 py-12 text-center" aria-labelledby="contact-page-title">
      <div className="mx-auto max-w-[600px]">
        <div className="mb-5 flex items-center justify-center gap-3 text-primary">
          <span className="h-px w-8 bg-primary/50" aria-hidden="true" />
          <p className="text-[10px] font-bold uppercase tracking-widest">Get in touch</p>
          <span className="h-px w-8 bg-primary/50" aria-hidden="true" />
        </div>
        <h1
          id="contact-page-title"
          className="text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl lg:text-5xl"
        >
          We&apos;d love to hear from you.
        </h1>
        <p className="mx-auto mt-4 max-w-[480px] text-base leading-relaxed text-muted-foreground">
          Send us a message using the form or reach us directly using the contact details
          below.
        </p>
      </div>
    </section>
  );
}

function LocationMapCard() {
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-muted shadow-sm">
      <div className="relative h-[220px] sm:h-[280px] lg:h-[320px]">
        <iframe
          src={jnuitsMapEmbedSrc}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title="Jagannath University, Old Dhaka location map"
          className="absolute inset-0 h-full w-full"
        />

        <div className="absolute right-4 top-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-xs font-semibold text-foreground shadow-sm sm:right-6 sm:top-6">
          <MapPin aria-hidden="true" size={13} className="text-primary" />
          <span className="sm:hidden">JnU · Old Dhaka</span>
          <span className="hidden sm:inline">Jagannath University · Old Dhaka</span>
        </div>
      </div>
    </div>
  );
}

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [contactContent, contactSettings] = await Promise.all([
    getContactContent(),
    getContactSettings(),
  ]);
  const resolvedSearchParams = await searchParams;
  const message =
    typeof resolvedSearchParams.message === "string" ? resolvedSearchParams.message : null;
  const error =
    typeof resolvedSearchParams.error === "string" ? resolvedSearchParams.error : null;
  const categoryParam =
    typeof resolvedSearchParams.category === "string" ? resolvedSearchParams.category : null;
  const defaultCategory =
    categoryParam && inquiryCategories.some((category) => category.value === categoryParam)
      ? categoryParam
      : "general";
  const defaultSubject =
    typeof resolvedSearchParams.subject === "string" ? resolvedSearchParams.subject : "";

  return (
    <main className="bg-background text-foreground">
      <ContactHero />

      <section className="pb-16 pt-12" aria-label="Contact details and form">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2 xl:items-stretch">
            <div className="order-2 xl:order-1 xl:h-full">
              <ContactFormCard
                defaultCategory={defaultCategory}
                defaultSubject={defaultSubject}
                error={error}
                inquiryCategories={inquiryCategories}
                message={message}
              />
            </div>

            <OfficialContact
              googleBusinessHref={contactContent.googleBusinessHref}
              settings={contactSettings}
              socialLinks={contactContent.socialLinks}
            />
          </div>

          <LocationMapCard />
        </div>
      </section>
    </main>
  );
}
