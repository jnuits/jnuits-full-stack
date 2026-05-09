"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, ChevronDown, Clock, Loader2, Search } from "lucide-react";

import { TurnstileWidget } from "@/components/contact/TurnstileWidget";
import { COUNTRIES } from "@/lib/countries";

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

type Country = (typeof COUNTRIES)[number];

const sortedCountries = [...COUNTRIES].sort((countryA, countryB) =>
  countryA.name.localeCompare(countryB.name),
);
const defaultCountry = COUNTRIES.find((country) => country.code === "BD") ?? COUNTRIES[0];

const labelClass = "mb-1 block text-sm font-medium text-foreground";
const inputClass =
  "h-12 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20";
const compactInputClass =
  "h-10 min-w-0 grow rounded-r-lg border border-input bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20";

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
  const [selectedCountry, setSelectedCountry] = useState<Country>(defaultCountry);
  const [countrySearch, setCountrySearch] = useState("");
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryDropdownStyle, setCountryDropdownStyle] = useState<CSSProperties>({});
  const phoneFieldRef = useRef<HTMLDivElement>(null);
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  const countrySearchRef = useRef<HTMLInputElement>(null);
  const submitDisabled = !!(isSubmitting || !canSubmit);
  const normalizedPhoneNumber = phoneNumber.replace(/[^\d]/g, "");
  const combinedPhoneValue = normalizedPhoneNumber
    ? `${selectedCountry.dial}${normalizedPhoneNumber}`
    : "";
  const filteredCountries = useMemo(() => {
    const query = countrySearch.trim().toLowerCase();

    if (!query) return sortedCountries;

    return sortedCountries.filter((country) => {
      return (
        country.name.toLowerCase().includes(query) ||
        country.code.toLowerCase().includes(query) ||
        country.dial.includes(query)
      );
    });
  }, [countrySearch]);

  useEffect(() => {
    if (!message) return;

    const timer = window.setTimeout(() => setShowSuccess(false), 3000);

    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (!countryPickerOpen) return;

    const updateDropdownPosition = () => {
      if (!phoneFieldRef.current) return;

      const rect = phoneFieldRef.current.getBoundingClientRect();
      const width = Math.min(rect.width, window.innerWidth - 16);
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);

      setCountryDropdownStyle({
        left,
        position: "fixed",
        top: rect.bottom + 4,
        width,
        zIndex: 50,
      });
    };

    updateDropdownPosition();
    window.addEventListener("resize", updateDropdownPosition);
    window.addEventListener("scroll", updateDropdownPosition, true);

    const focusTimer = window.setTimeout(() => countrySearchRef.current?.focus(), 0);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("resize", updateDropdownPosition);
      window.removeEventListener("scroll", updateDropdownPosition, true);
    };
  }, [countryPickerOpen]);

  useEffect(() => {
    if (!countryPickerOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;

      if (
        phoneFieldRef.current?.contains(target) ||
        countryDropdownRef.current?.contains(target)
      ) {
        return;
      }

      setCountryPickerOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [countryPickerOpen]);

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
          onSubmit={() => setIsSubmitting(true)}
        >
          <div className="flex-1 space-y-4">
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
              <div className="flex" ref={phoneFieldRef}>
                <button
                  type="button"
                  aria-expanded={countryPickerOpen}
                  aria-haspopup="listbox"
                  className="flex h-10 w-[8.75rem] flex-shrink-0 cursor-pointer items-center gap-1.5 rounded-l-lg border border-r-0 border-input bg-background px-3 text-sm transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/20 sm:w-[9.75rem]"
                  onClick={() => {
                    setCountrySearch("");
                    setCountryPickerOpen((isOpen) => !isOpen);
                  }}
                >
                  <span aria-hidden="true">{selectedCountry.flag}</span>
                  <span className="font-medium">{selectedCountry.code}</span>
                  <span className="text-muted-foreground">{selectedCountry.dial}</span>
                  <ChevronDown
                    aria-hidden="true"
                    size={12}
                    className="ml-auto text-muted-foreground"
                  />
                </button>
                <input
                  className={compactInputClass}
                  id="contact-phone-whatsapp"
                  type="tel"
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.currentTarget.value)}
                  placeholder="1XXX-XXXXXX"
                />
              </div>

              {countryPickerOpen && typeof document !== "undefined"
                ? createPortal(
                    <div
                      ref={countryDropdownRef}
                      className="rounded-xl border border-border bg-popover p-0 text-popover-foreground shadow-lg"
                      style={countryDropdownStyle}
                    >
                      <div className="flex h-10 items-center gap-2 border-b border-border px-3">
                        <Search aria-hidden="true" size={13} className="text-muted-foreground" />
                        <input
                          ref={countrySearchRef}
                          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                          value={countrySearch}
                          onChange={(event) => setCountrySearch(event.currentTarget.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Escape") {
                              setCountryPickerOpen(false);
                            }
                          }}
                          placeholder="Search country..."
                        />
                      </div>
                      <div className="max-h-56 overflow-y-auto p-1" role="listbox">
                        {filteredCountries.length > 0 ? (
                          filteredCountries.map((country) => (
                            <button
                              key={`${country.code}-${country.dial}`}
                              type="button"
                              role="option"
                              aria-selected={country.code === selectedCountry.code}
                              className="flex w-full items-center rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted"
                              onClick={() => {
                                setSelectedCountry(country);
                                setCountryPickerOpen(false);
                                setCountrySearch("");
                              }}
                            >
                              <span className="mr-2 text-base" aria-hidden="true">
                                {country.flag}
                              </span>
                              <span className="min-w-0 grow text-sm">{country.name}</span>
                              <span className="ml-2 font-mono text-xs text-muted-foreground">
                                {country.dial}
                              </span>
                            </button>
                          ))
                        ) : (
                          <p className="px-3 py-3 text-xs text-muted-foreground">
                            No country found.
                          </p>
                        )}
                      </div>
                    </div>,
                    document.body,
                  )
                : null}
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
                        setTurnstileError(true);
                        setCanSubmit(true);
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
            className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
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
