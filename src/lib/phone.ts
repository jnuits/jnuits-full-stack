import { COUNTRIES } from "@/lib/countries";

/**
 * The one telephone contract. Task 2.6, decision 4.
 *
 * Before this there was no format rule anywhere: the schema capped a telephone
 * answer at 32 characters and nothing else, so `"call me"` was a valid phone
 * number and `+8801700000000`, `01721129467` and `01721-129467` were three
 * different stored values for the same person.
 *
 * Deliberately free of DOM APIs and of `zod`, so it can be imported by the node
 * project (`definition.ts`), the jsdom project (`field-validation.ts`) and a
 * client component without any of them pulling in the others' dependencies.
 *
 * ## Why not a phone-number library
 *
 * `libphonenumber-js` would give real per-country length and prefix rules. It is
 * also a new dependency, which needs approval, and roughly 145 KB minified for a
 * form that currently collects one optional contact number. The rule here is
 * E.164 shape only: a country code and 7 to 15 digits. It cannot tell a real
 * Dhaka mobile from a plausible-looking fake, and it does not claim to — the
 * point is that every stored answer is one canonical shape rather than five.
 */

/**
 * Written for a respondent, not a spec. The example is a Bangladeshi mobile
 * because that is who most respondents are, and the country code is shown
 * explicitly because omitting it is the failure this message exists for.
 */
export const PHONE_ANSWER_MESSAGE =
  "Enter the number with its country code, for example +8801712345678.";

/**
 * E.164 allows at most 15 digits including the country code, and a country code
 * never begins with zero.
 *
 * The floor is 7 rather than 8: `ANSWER_LENGTH_LIMITS.telephone` already uses 7
 * as its floor, and a rule stricter than the schema's own would reject an answer
 * the schema was willing to store.
 */
export const PHONE_DIGIT_LIMITS = { max: 15, min: 7 } as const;

const CANONICAL_PHONE_PATTERN = new RegExp(
  `^\\+[1-9]\\d{${PHONE_DIGIT_LIMITS.min - 1},${PHONE_DIGIT_LIMITS.max - 1}}$`
);

/**
 * Punctuation a respondent will type and a machine should absorb.
 *
 * Includes the non-breaking space, which is what a paste from a contact card or
 * a web page usually carries, and the Unicode hyphens Word and iOS substitute
 * for a plain `-`.
 */
const SEPARATOR_PATTERN = /[\s\u00a0()./\u2010-\u2015-]/g;

/** The default country for this site's audience, per decision 4. */
export const DEFAULT_COUNTRY_CODE = "BD";

export type DialCountry = (typeof COUNTRIES)[number];

export const DEFAULT_COUNTRY: DialCountry =
  COUNTRIES.find((country) => country.code === DEFAULT_COUNTRY_CODE) ?? COUNTRIES[0];

/**
 * Countries by name, which is how someone looks for one.
 *
 * `COUNTRIES` is roughly alphabetical already but not reliably, and `UAE`, `UK`
 * and `USA` sit at the end of it.
 */
export const SORTED_COUNTRIES: readonly DialCountry[] = [...COUNTRIES].sort((first, second) =>
  first.name.localeCompare(second.name)
);

/**
 * @returns countries matching a search, by name, ISO code or dial code.
 *
 * Dial-code search deliberately tolerates a typed `+`, because that is how the
 * code is displayed and therefore how it gets typed.
 */
export function filterDialCountries(query: string): readonly DialCountry[] {
  const needle = query.trim().toLowerCase();

  if (!needle) {
    return SORTED_COUNTRIES;
  }

  const dialNeedle = needle.startsWith("+") ? needle : `+${needle}`;

  return SORTED_COUNTRIES.filter(
    (country) =>
      country.name.toLowerCase().includes(needle) ||
      country.code.toLowerCase().includes(needle) ||
      country.dial.includes(dialNeedle)
  );
}

/**
 * The national part of a number, with separators and the trunk prefix removed.
 *
 * The leading zero goes because it is a *national* dialling prefix: a Bangladeshi
 * mobile written `01721129467` at home is `+880 1721129467` abroad. Keeping it
 * would produce `+8801721129467` with an extra zero, which is a different and
 * unreachable number.
 */
export function toNationalDigits(value: string): null | string {
  const compact = value.replace(SEPARATOR_PATTERN, "");

  if (!compact) {
    return "";
  }

  // Deleting unsupported characters would silently turn a typo into another number.
  return /^\d+$/.test(compact) ? compact.replace(/^0+/, "") : null;
}

/**
 * Builds an answer from a picked country and a typed national number.
 *
 * **Empty and unusable are different, and conflating them loses data.** An
 * earlier version composed from `toNationalDigits` alone, which strips every
 * non-digit: `"call me"` became `""`, the composed answer became `""`, and
 * `toAnswers` omits an empty telephone answer entirely because that is how an
 * untouched optional question has to behave. So a respondent typed something,
 * was told nothing, and submitted a form with no phone number in it.
 *
 * Now only a genuinely blank input composes to `""`. Anything else is composed
 * with the dial code even when it yields no digits, so it reaches the shared
 * rule and is rejected — on the client beside the control, and again on the
 * server if a request arrives without passing through this.
 *
 * @returns the canonical value, `""` when nothing was typed, or an
 * uncanonicalisable string that `checkAnswerRule` will reject.
 */
export function composePhoneAnswer(dial: string, nationalNumber: string) {
  const typed = nationalNumber.trim();

  if (!typed) {
    return "";
  }

  const national = toNationalDigits(typed);

  return national ? `${dial}${national}` : `${dial}${typed}`;
}

/**
 * What a picked country and a typed number resolve to.
 *
 * `empty` and `invalid` are separate states because they mean different things
 * to a caller. An untouched optional field submits nothing and must not be
 * reported as an error; an unusable one has to stop the submission and say why.
 * Collapsing the two is the data-loss bug `composePhoneAnswer` documents.
 */
export type PhoneEntry =
  | { status: "empty"; value: "" }
  | { status: "invalid"; value: string }
  | { status: "ok"; value: string };

/**
 * Resolves what a respondent typed beside a country picker into one canonical
 * answer, or reports that it cannot be. Issue #131.
 *
 * Three readings are tried in a fixed order, and the order is the design:
 *
 * 1. **The value carries its own country code** (`+880…`, `008801…`). It beats
 *    the picker. Someone who pastes a full international number has stated the
 *    country more explicitly than a dropdown they may never have touched, and
 *    prepending the picked dial code to it would produce nonsense.
 * 2. **The literal reading**: the picked dial code plus what was typed, with
 *    separators and the trunk zero removed. This is the ordinary case and it is
 *    tried before any cleverness, so a number that already reads correctly is
 *    never reinterpreted.
 * 3. **A country code typed without its `+`** (`8801712345678` under `+880`).
 *    Attempted *only* when reading 2 produced something invalid and stripping
 *    the duplicate produces something valid.
 *
 * Reading 3 cannot fire when reading 2 already worked, and that ordering is
 * load-bearing rather than incidental. Under `+1`, `1234567890` is both a valid
 * ten-digit national number and a string that looks like a repeated country
 * code; the literal reading wins, so the number typed under the country chosen
 * is the number stored. Only when exactly one reading survives does this
 * disambiguate, which is not the same as guessing.
 */
export function resolvePhoneEntry(dial: string, typed: string): PhoneEntry {
  const trimmed = typed.trim();

  if (!trimmed) {
    return { status: "empty", value: "" };
  }

  const compact = trimmed.replace(SEPARATOR_PATTERN, "");

  if (compact.startsWith("+") || compact.startsWith("00")) {
    const canonical = normalizePhoneAnswer(trimmed);

    return canonical
      ? { status: "ok", value: canonical }
      : { status: "invalid", value: trimmed };
  }

  const composed = composePhoneAnswer(dial, trimmed);

  if (isCanonicalPhoneAnswer(composed)) {
    return { status: "ok", value: composed };
  }

  const national = toNationalDigits(trimmed);
  const dialDigits = dial.replace(/^\+/, "");

  if (national && dialDigits && national.startsWith(dialDigits)) {
    const deduplicated = `${dial}${national.slice(dialDigits.length)}`;

    if (isCanonicalPhoneAnswer(deduplicated)) {
      return { status: "ok", value: deduplicated };
    }
  }

  // The unusable value is carried out rather than discarded. A caller handed
  // `""` here would submit an empty optional field and say nothing at all.
  return { status: "invalid", value: composed || trimmed };
}

/**
 * Canonicalises whatever arrived, or `null` when it cannot be.
 *
 * Permissive about separators, strict about the country code:
 *
 *   - `+880 1712-345678` → `+8801712345678`
 *   - `008801712345678` → `+8801712345678`, because `00` is the other way to
 *     write `+` and half the world writes it that way
 *   - `01712345678` → `null`. **Not guessed at.** Inferring `+880` because this
 *     site is Bangladeshi would silently mangle the number of every respondent
 *     abroad, who are exactly the people a country picker exists to serve.
 *
 * @returns the canonical `+<digits>` form, or `null` for anything that is not a
 * resolvable international number.
 */
export function normalizePhoneAnswer(value: string): null | string {
  const compact = value.replace(SEPARATOR_PATTERN, "");

  if (!compact) {
    return null;
  }

  const withPlus = compact.startsWith("00") ? `+${compact.slice(2)}` : compact;

  if (!withPlus.startsWith("+")) {
    return null;
  }

  // Checked after the prefix is settled rather than before, so that a stray
  // letter anywhere in the number is rejected instead of being stripped out and
  // turned into a different, valid-looking number.
  const canonical = `+${withPlus.slice(1)}`;

  return CANONICAL_PHONE_PATTERN.test(canonical) ? canonical : null;
}

/** Whether a value is already exactly canonical, with nothing to normalise. */
export function isCanonicalPhoneAnswer(value: string) {
  return CANONICAL_PHONE_PATTERN.test(value);
}

/**
 * Splits a canonical answer back into a country and a national number.
 *
 * Used to reopen an existing value in the picker. Longest dial code first,
 * because `+1` is a prefix of `+1...` for Canada and the USA and `+7` is shared
 * by Russia and Kazakhstan: a shortest-match walk would attribute a Kazakh
 * number to Russia. Ambiguity between two countries sharing one code is not
 * resolvable from the number alone, so the first match by sort order wins and
 * the dial code — the part that affects the stored value — is right either way.
 *
 * @returns the split, or `null` when the value is not canonical.
 */
export function splitPhoneAnswer(
  value: string
): null | { country: DialCountry; nationalNumber: string } {
  if (!isCanonicalPhoneAnswer(value)) {
    return null;
  }

  const byLongestDial = [...COUNTRIES].sort((first, second) => second.dial.length - first.dial.length);
  const country = byLongestDial.find((candidate) => value.startsWith(candidate.dial));

  if (!country) {
    return null;
  }

  return { country, nationalNumber: value.slice(country.dial.length) };
}
