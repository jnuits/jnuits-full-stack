"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Clock, Loader2 } from "lucide-react";

import { TurnstileWidget } from "@/components/contact/TurnstileWidget";
import { CountryDialPicker } from "@/components/ui/country-dial-picker";
import {
  DEFAULT_COUNTRY,
  PHONE_ANSWER_MESSAGE,
  resolvePhoneEntry,
  type DialCountry,
} from "@/lib/phone";

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

const labelClass = "mb-1 block text-sm font-medium text-foreground";
const inputClass =
  "h-12 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20";
const compactInputClass =
  "h-full min-w-0 grow border-0 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground/70";

/**
 * Issue #131. The error element's id is a module constant because three things
 * have to agree on it: the paragraph that carries the message, the input's
 * `aria-describedby`, and the picker's. A literal repeated three times is a
 * dangling reference waiting to happen, and a dangling `aria-describedby` is
 * worse than none — some screen readers announce nothing at all for the control.
 */
const phoneErrorId = "contact-phone-whatsapp-error";

function cn(...classes: Array<false | null | string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

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
  const [selectedCountry, setSelectedCountry] = useState<DialCountry>(DEFAULT_COUNTRY);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const submitDisabled = !!(isSubmitting || !canSubmit);
  /**
   * Issue #131, resolved through the shared contract rather than here.
   *
   * This used to concatenate the dial code with `phoneNumber.replace(/[^\d]/g, "")`,
   * which keeps the national trunk zero: `01712345678` under `+880` submitted
   * `+88001712345678`, which is not a badly formatted version of the number but a
   * different and unreachable one. `resolvePhoneEntry` owns every reading of what
   * was typed, so there is one normaliser in the codebase and not two.
   */
  const phoneEntry = resolvePhoneEntry(selectedCountry.dial, phoneNumber);
  /**
   * Shown once the respondent has left the field or tried to submit, never while
   * they are still typing. A rule evaluated on every keystroke reports every
   * half-finished number as broken, which trains people to ignore it.
   */
  const phoneError = phoneTouched && phoneEntry.status === "invalid" ? PHONE_ANSWER_MESSAGE : null;
  /**
   * Carries the unusable value through when there is one, rather than blanking
   * it. Submitting `""` would look to the server like an untouched optional
   * field, which is how a respondent ends up sending a message with the phone
   * number they typed silently missing from it.
   */
  const combinedPhoneValue = phoneEntry.value;
  const phonePlaceholder = useMemo(
    () => (selectedCountry.code === "BD" ? "1721-129467" : "Phone number"),
    [selectedCountry.code]
  );

  useEffect(() => {
    if (!message) return;

    const timer = window.setTimeout(() => setShowSuccess(false), 3000);

    return () => window.clearTimeout(timer);
  }, [message]);

  return (
    <section
      aria-labelledby="contact-form-title"
      className="flex h-full flex-col overflow-visible rounded-2xl border border-border bg-card shadow-sm"
    >
      <div className="h-[3px] rounded-t-2xl bg-primary" aria-hidden="true" />
      <div className="flex flex-1 flex-col p-6">
        <h2 id="contact-form-title" className="text-2xl font-bold tracking-tight text-foreground">
          Send us a message
        </h2>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock aria-hidden="true" size={13} />
          We typically respond within 2-3 business days.
        </p>

        <div aria-live="polite" aria-atomic="true" className="mt-5">
          {message ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
              {message}
            </p>
          ) : null}
        </div>

        <form
          action="/api/contact/submit"
          method="post"
          className="mt-4 flex flex-1 flex-col"
          id="contact-form"
          onSubmit={(event) => {
            if (phoneEntry.status === "invalid") {
              // Stopped here rather than at the server, which answers with a
              // redirect that discards everything else already typed.
              event.preventDefault();
              setPhoneTouched(true);
              phoneInputRef.current?.focus();
              return;
            }

            setIsSubmitting(true);
          }}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="contact-name">
                  Name
                </label>
                <input
                  className={inputClass}
                  id="contact-name"
                  name="name"
                  placeholder="e.g. Jakiya Rahman"
                  autoComplete="name"
                  required
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="contact-email">
                  Email address
                </label>
                <input
                  className={inputClass}
                  id="contact-email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div>
              <label className={labelClass} htmlFor="contact-sender-type">
                I am a...
              </label>
              <select
                className={inputClass}
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
            </div>

            <div>
              <label className={labelClass} htmlFor="contact-phone-whatsapp">
                Phone or WhatsApp number
              </label>
              <input type="hidden" name="phone_whatsapp" value={combinedPhoneValue} />
              <div
                className={cn(
                  "flex h-12 overflow-hidden rounded-xl border bg-background transition-colors focus-within:ring-2",
                  phoneError
                    ? "border-destructive focus-within:border-destructive focus-within:ring-destructive/20"
                    : "border-border focus-within:border-primary focus-within:ring-primary/20"
                )}
              >
                <CountryDialPicker
                  country={selectedCountry}
                  describedBy={phoneError ? phoneErrorId : undefined}
                  onCountryChange={setSelectedCountry}
                />
                <input
                  aria-describedby={phoneError ? phoneErrorId : undefined}
                  aria-invalid={phoneError ? true : undefined}
                  className={compactInputClass}
                  id="contact-phone-whatsapp"
                  type="tel"
                  value={phoneNumber}
                  onBlur={() => setPhoneTouched(true)}
                  onChange={(event) => setPhoneNumber(event.currentTarget.value)}
                  placeholder={phonePlaceholder}
                  ref={phoneInputRef}
                />
              </div>
              {phoneError ? (
                <p className="mt-1 text-sm font-medium text-destructive" id={phoneErrorId}>
                  {phoneError}
                </p>
              ) : null}
            </div>

            <div>
              <label className={labelClass} htmlFor="contact-category">
                Inquiry category
              </label>
              <select
                className={inputClass}
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
            </div>

            <div>
              <label className={labelClass} htmlFor="contact-subject">
                Subject
              </label>
              <input
                className={inputClass}
                id="contact-subject"
                name="subject"
                defaultValue={defaultSubject}
                placeholder="e.g. Certificate verification support"
                required
              />
            </div>

            <div>
              <label className={labelClass} htmlFor="contact-message">
                Message
              </label>
              <textarea
                className="min-h-[140px] w-full resize-y rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                id="contact-message"
                name="message"
                rows={5}
                placeholder="Write your message here."
                onChange={(event) => setMessageLength(event.currentTarget.value.length)}
                required
              />
              <span className="mt-1 block text-right text-xs text-muted-foreground">
                {messageLength} / 1000
              </span>
            </div>

            <div className="mt-1 border-t border-border/40 pt-4">
              <div className="space-y-3">
                <div>
                  <label className={labelClass} htmlFor="contact-attachment-url">
                    Attachment or document URL
                  </label>
                  <input
                    className={inputClass}
                    id="contact-attachment-url"
                    name="attachment_url"
                    type="url"
                    placeholder="https://drive.google.com/..."
                  />
                </div>

                <input type="hidden" name="cf_turnstile_token" value={turnstileToken} />

                <div>
                  <div
                    className={cn(
                      "overflow-hidden transition-all duration-300",
                      turnstileToken ? "h-0 opacity-0" : "h-auto opacity-100",
                    )}
                  >
                    <TurnstileWidget
                      onSuccess={(token) => {
                        setTurnstileToken(token);
                        setTurnstileError(false);
                        setCanSubmit(true);
                      }}
                      onError={() => {
                        setTurnstileToken("");
                        setTurnstileError(true);
                        setCanSubmit(false);
                      }}
                      onExpired={() => {
                        setTurnstileToken("");
                        setCanSubmit(false);
                      }}
                    />
                  </div>

                  {turnstileToken ? (
                    <div className="mt-2 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm dark:border-emerald-800 dark:bg-emerald-950/30">
                      <CheckCircle2
                        aria-hidden="true"
                        size={15}
                        className="flex-shrink-0 text-emerald-600 dark:text-emerald-400"
                      />
                      <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                        Human verification complete
                      </span>
                    </div>
                  ) : null}

                  {turnstileError && !turnstileToken ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Verification unavailable — you may still submit.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="sr-only" aria-hidden="true">
              <label htmlFor="contact-website">Website</label>
              <input id="contact-website" name="website" tabIndex={-1} autoComplete="off" />
            </div>
          </div>

          <button
            className="primary-button contact-submit-button mt-4 w-full disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={submitDisabled}
            suppressHydrationWarning
          >
            {isSubmitting ? (
              <>
                <Loader2 aria-hidden="true" size={15} className="animate-spin" />
                Sending...
              </>
            ) : !canSubmit ? (
              "Verify above to continue"
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
            <p className="mt-3 text-sm font-medium text-destructive">
              Failed to send. Try again.
            </p>
          ) : null}
        </form>
      </div>
    </section>
  );
}
