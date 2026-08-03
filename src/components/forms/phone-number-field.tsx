"use client";

import { useState } from "react";

import { CountryDialPicker } from "@/components/ui/country-dial-picker";
import { phoneDialControlName } from "@/lib/forms/control-names";
import { DEFAULT_COUNTRY, type DialCountry } from "@/lib/phone";

/**
 * A telephone question: a country picker and a national number. Task 2.6.
 *
 * ## Which control carries the name
 *
 * The **visible** input is named, required and focusable, and holds the national
 * number. A hidden sibling holds the dial code, and `toAnswers` composes the two
 * into the canonical `+<dial><national>` that gets submitted.
 *
 * Putting the name on the hidden input instead — which is what `/contact` does —
 * would break three things at once here: `required` is ignored on a hidden
 * input, so a required telephone question would submit empty; constraint
 * validation reports nothing for it, so `collectNativeFieldErrors` would find a
 * control that is always valid; and task 2.2's focus effect looks up the
 * question's canonical id, so a failed submit would focus something invisible.
 * Contact gets away with it because it has none of those three behaviours.
 *
 * ## Uncontrolled, still
 *
 * The national number is tracked in state because the dial code has to be
 * composed with it, which is a change from every other control on this form. The
 * submitted value still comes out of `FormData` at submit time, so nothing above
 * this component reads it.
 */
const FIELD_SHELL_CLASS =
  "flex h-12 overflow-hidden rounded-xl border border-border bg-background transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20";

const FIELD_SHELL_INVALID_CLASS =
  "border-destructive focus-within:border-destructive focus-within:ring-destructive/20";

const NATIONAL_INPUT_CLASS =
  "h-full min-w-0 grow border-0 bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/70 disabled:cursor-not-allowed";

/**
 * The placeholder is the country's own national format where we know it, and
 * otherwise a neutral prompt.
 *
 * Only Bangladesh is spelled out, because it is the default and the one an
 * example genuinely helps with. Inventing a plausible-looking example for a
 * hundred other countries would be guessing, and a wrong example is worse than
 * none: it teaches a respondent the wrong shape.
 */
function nationalPlaceholder(country: DialCountry) {
  return country.code === "BD" ? "1712345678" : "Phone number";
}

export function PhoneNumberField({
  describedBy,
  fieldId,
  inputId,
  invalid,
  preview,
  required,
}: {
  describedBy?: string;
  fieldId: string;
  inputId: string;
  invalid: boolean;
  preview?: boolean;
  required: boolean;
}) {
  const [country, setCountry] = useState<DialCountry>(DEFAULT_COUNTRY);
  const [nationalNumber, setNationalNumber] = useState("");

  return (
    <div
      className={
        invalid ? `${FIELD_SHELL_CLASS} ${FIELD_SHELL_INVALID_CLASS}` : FIELD_SHELL_CLASS
      }
    >
      <CountryDialPicker
        country={country}
        describedBy={describedBy}
        disabled={preview}
        onCountryChange={setCountry}
      />
      <input
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        autoComplete="tel-national"
        className={NATIONAL_INPUT_CLASS}
        disabled={preview}
        id={inputId}
        // Unnamed in the preview, like every other preview control, so nothing
        // there can be submitted even if a preview were somehow inside a form.
        name={preview ? undefined : fieldId}
        onChange={(event) => setNationalNumber(event.currentTarget.value)}
        placeholder={nationalPlaceholder(country)}
        required={!preview && required}
        type="tel"
        value={nationalNumber}
      />
      {preview ? null : (
        <input name={phoneDialControlName(fieldId)} type="hidden" value={country.dial} />
      )}
    </div>
  );
}
