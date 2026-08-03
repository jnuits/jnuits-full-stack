"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search } from "lucide-react";

import { filterDialCountries, type DialCountry } from "@/lib/phone";

/**
 * The searchable dial-code picker, lifted out of `contact-form-card.tsx`.
 *
 * Decision 4 and 13.3b both say reuse this rather than build a second one, and
 * task 2.6 is the second consumer. The extraction is faithful: the portal, the
 * fixed-position dropdown that follows scroll and resize, the outside-pointerdown
 * close, the Escape handler and the autofocused search box all behave as they
 * did on `/contact`.
 *
 * **Contact's submitted value is deliberately untouched.** Only the widget moved;
 * contact still composes its own `phone_whatsapp` exactly as before, including
 * the fact that it does not drop a leading trunk zero. See the PR body — that is
 * a pre-existing defect on a different surface, reported rather than fixed here.
 *
 * ## Why a portal
 *
 * The dropdown is `position: fixed` and appended to `document.body`, so it
 * cannot be clipped by an ancestor's `overflow`. The form card and the Studio
 * question rows both clip, so an in-flow dropdown would be cut off in both.
 */
const DROPDOWN_CLASS =
  "rounded-xl border border-border bg-popover p-0 text-popover-foreground shadow-lg";

export function CountryDialPicker({
  country,
  describedBy,
  disabled,
  onCountryChange,
}: {
  country: DialCountry;
  describedBy?: string;
  disabled?: boolean;
  onCountryChange: (country: DialCountry) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const matches = filterDialCountries(query);

  useEffect(() => {
    if (!open) return;

    const position = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      // Measured against the whole field rather than the button, so the list is
      // as wide as the input it belongs to, and clamped so it cannot hang off
      // either edge on a narrow viewport.
      const field = trigger.parentElement ?? trigger;
      const rect = field.getBoundingClientRect();
      const width = Math.min(rect.width, window.innerWidth - 16);

      setDropdownStyle({
        left: Math.min(Math.max(8, rect.left), window.innerWidth - width - 8),
        position: "fixed",
        top: rect.bottom + 4,
        width,
        zIndex: 50,
      });
    };

    position();
    window.addEventListener("resize", position);
    // Capturing, because the scroll that matters may be on an ancestor rather
    // than the window.
    window.addEventListener("scroll", position, true);

    const focusTimer = window.setTimeout(() => searchRef.current?.focus(), 0);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;

      if (
        triggerRef.current?.parentElement?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return;
      }

      setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  function choose(next: DialCountry) {
    onCountryChange(next);
    setOpen(false);
    setQuery("");
    // Focus returns to the trigger rather than being left on a removed element,
    // which would drop a keyboard user back at the top of the document.
    triggerRef.current?.focus();
  }

  return (
    <>
      <button
        aria-describedby={describedBy}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Select country dialling code"
        className="flex h-full w-[7.75rem] flex-shrink-0 cursor-pointer items-center gap-1.5 border-r border-border/70 bg-muted/30 px-3 text-sm transition-colors hover:bg-muted/50 focus:outline-none disabled:cursor-not-allowed sm:w-[8.75rem]"
        disabled={disabled}
        onClick={() => {
          setQuery("");
          setOpen((isOpen) => !isOpen);
        }}
        ref={triggerRef}
        type="button"
      >
        <span aria-hidden="true">{country.flag}</span>
        <span className="font-medium">{country.code}</span>
        <span className="text-muted-foreground">{country.dial}</span>
        <ChevronDown aria-hidden="true" className="ml-auto text-muted-foreground" size={12} />
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div className={DROPDOWN_CLASS} ref={dropdownRef} style={dropdownStyle}>
              <div className="flex h-10 items-center gap-2 border-b border-border px-3">
                <Search aria-hidden="true" className="text-muted-foreground" size={13} />
                <input
                  aria-label="Search country"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  onChange={(event) => setQuery(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setOpen(false);
                      triggerRef.current?.focus();
                    }
                  }}
                  placeholder="Search country..."
                  ref={searchRef}
                  value={query}
                />
              </div>
              <div className="max-h-56 overflow-y-auto p-1" role="listbox">
                {matches.length ? (
                  matches.map((candidate) => (
                    <button
                      aria-selected={candidate.code === country.code}
                      className="flex w-full items-center rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted"
                      key={`${candidate.code}-${candidate.dial}`}
                      onClick={() => choose(candidate)}
                      role="option"
                      type="button"
                    >
                      <span aria-hidden="true" className="mr-2 text-base">
                        {candidate.flag}
                      </span>
                      <span className="min-w-0 grow text-sm">{candidate.name}</span>
                      <span className="ml-2 font-mono text-xs text-muted-foreground">
                        {candidate.dial}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-3 text-xs text-muted-foreground">No country found.</p>
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
