"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Loader2 } from "lucide-react";

import { TurnstileWidget } from "@/components/contact/TurnstileWidget";

type InquiryCategory = {
  label: string;
  value: string;
};

type ContactFormCardProps = {
  defaultCategory: string;
  defaultSubject: string;
  error: string | null;
  inquiryCategories: InquiryCategory[];
  message: string | null;
};

export function ContactFormCard({
  defaultCategory,
  defaultSubject,
  error,
  inquiryCategories,
  message,
}: ContactFormCardProps) {
  const [messageLength, setMessageLength] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(Boolean(message));
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileError, setTurnstileError] = useState(false);
  const [canSubmit, setCanSubmit] = useState(false);
  const submitDisabled: boolean = isSubmitting || !canSubmit;

  useEffect(() => {
    if (!message) return;

    const timer = window.setTimeout(() => setShowSuccess(false), 3000);

    return () => window.clearTimeout(timer);
  }, [message]);

  return (
    <section
      aria-labelledby="contact-form-title"
      className="h-full overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
    >
      <div className="h-[3px] rounded-t-2xl bg-primary" aria-hidden="true" />
      <div className="p-5">
        <h2 id="contact-form-title" className="text-2xl font-bold tracking-tight text-foreground">
          Send us a message
        </h2>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock aria-hidden="true" size={13} />
          We typically respond within 2-3 business days.
        </p>

        <div aria-live="polite" aria-atomic="true" className="mt-5 space-y-2">
          {message ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
              {message}
            </p>
          ) : null}
        </div>

        <form
          action="/api/contact/submit"
          method="post"
          className="mt-6 space-y-5"
          id="contact-form"
          onSubmit={() => setIsSubmitting(true)}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-semibold text-foreground" htmlFor="contact-name">
              Name
              <input
                className="h-12 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                id="contact-name"
                name="name"
                placeholder="e.g. Jakiya Rahman"
                autoComplete="name"
                required
              />
            </label>
            <label className="space-y-2 text-sm font-semibold text-foreground" htmlFor="contact-email">
              Email address
              <input
                className="h-12 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                id="contact-email"
                name="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </label>
          </div>

          <label className="space-y-2 text-sm font-semibold text-foreground" htmlFor="contact-sender-type">
            I am a...
            <select
              className="h-12 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              id="contact-sender-type"
              name="sender_type"
              defaultValue=""
              required
            >
              <option value="" disabled>
                Select sender type
              </option>
              <option value="jnu_student">JnU Student</option>
              <option value="jnuits_member">JnUITS Member</option>
              <option value="jnu_faculty_staff">JnU Faculty / Staff</option>
              <option value="student_other_university">Student from Another University</option>
              <option value="university_organisation">University Organisation</option>
              <option value="tech_company">Tech Company</option>
              <option value="edtech_company">EdTech Company</option>
              <option value="ngo_nonprofit">NGO / Non-profit</option>
              <option value="media_press">Media / Press</option>
              <option value="other">Other</option>
            </select>
          </label>

          <label className="space-y-2 text-sm font-semibold text-foreground" htmlFor="contact-phone-whatsapp">
            Phone or WhatsApp number
            <input
              className="h-12 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
              id="contact-phone-whatsapp"
              name="phone_whatsapp"
              type="tel"
              placeholder="e.g. +880 1700-000000"
            />
            <span className="block text-xs font-normal text-muted-foreground">
              Optional. We may use this to follow up on your inquiry.
            </span>
          </label>

          <label className="space-y-2 text-sm font-semibold text-foreground" htmlFor="contact-category">
            Inquiry category
            <select
              className="h-12 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              id="contact-category"
              name="category"
              defaultValue={defaultCategory}
              required
            >
              {inquiryCategories.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm font-semibold text-foreground" htmlFor="contact-subject">
            Subject
            <input
              className="h-12 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
              id="contact-subject"
              name="subject"
              defaultValue={defaultSubject}
              placeholder="e.g. Certificate verification support"
              required
            />
          </label>

          <label className="space-y-2 text-sm font-semibold text-foreground" htmlFor="contact-message">
            Message
            <textarea
              className="min-h-[140px] w-full resize-y rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
              id="contact-message"
              name="message"
              rows={5}
              placeholder="Write your message here."
              onChange={(event) => setMessageLength(event.currentTarget.value.length)}
              required
            />
            <span className="block text-right text-xs text-muted-foreground">
              {messageLength} / 1000
            </span>
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label
              className="space-y-2 text-sm font-semibold text-foreground"
              htmlFor="contact-attachment-url"
            >
              Attachment or document URL
              <input
                className="h-12 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                id="contact-attachment-url"
                name="attachment_url"
                type="url"
                placeholder="https://drive.google.com/... or any public link"
              />
              <span className="block text-xs font-normal text-muted-foreground">
                Optional. Link a Google Drive file, Dropbox, or any publicly accessible document
                or image.
              </span>
            </label>

            <label
              className="space-y-2 text-sm font-semibold text-foreground"
              htmlFor="contact-additional-notes"
            >
              Additional notes
              <input
                className="h-12 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                id="contact-additional-notes"
                name="additional_notes"
                type="text"
                placeholder="Reference number, deadline, or brief context"
              />
            </label>
          </div>

          <input type="hidden" name="cf_turnstile_token" value={turnstileToken} />

          <div className="space-y-2">
            <TurnstileWidget
              onSuccess={(token) => {
                setTurnstileToken(token);
                setTurnstileError(false);
                setCanSubmit(true);
              }}
              onError={() => {
                setTurnstileError(true);
                setCanSubmit(true);
              }}
              onExpired={() => {
                setTurnstileToken("");
                setCanSubmit(false);
              }}
            />
            {turnstileError ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Verification unavailable. You may still submit your message.
              </p>
            ) : null}
          </div>

          <div className="sr-only" aria-hidden="true">
            <label htmlFor="contact-website">Website</label>
            <input id="contact-website" name="website" tabIndex={-1} autoComplete="off" />
          </div>

          <button
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
            type="submit"
            disabled={submitDisabled}
          >
            {isSubmitting ? (
              <>
                <Loader2 aria-hidden="true" size={15} className="animate-spin" />
                Sending...
              </>
            ) : submitDisabled ? (
              <span className="text-primary-foreground/70">Complete verification above</span>
            ) : showSuccess ? (
              <>
                <CheckCircle2 aria-hidden="true" size={15} className="text-emerald-200" />
                Message sent!
              </>
            ) : (
              "Send message"
            )}
          </button>

          {error ? (
            <p className="text-sm font-medium text-destructive">Failed to send. Try again.</p>
          ) : null}
        </form>
      </div>
    </section>
  );
}
