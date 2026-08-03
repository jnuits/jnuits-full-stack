import { describe, expect, it } from "vitest";

import {
  composePhoneAnswer,
  DEFAULT_COUNTRY,
  filterDialCountries,
  isCanonicalPhoneAnswer,
  normalizePhoneAnswer,
  PHONE_DIGIT_LIMITS,
  splitPhoneAnswer,
  toNationalDigits,
} from "@/lib/phone";

/**
 * Task 2.6. Before this there was no telephone format rule anywhere: the schema
 * capped the answer at 32 characters and nothing else.
 */

describe("normalising what a respondent actually types", () => {
  it.each([
    ["+8801712345678", "already canonical"],
    ["+880 1712 345678", "spaces"],
    ["+880 1712-345678", "spaces and a hyphen"],
    ["+880 (1712) 345.678", "brackets and a dot"],
    ["008801712345678", "the 00 international prefix"],
  ])("%s (%s) becomes +8801712345678", (input) => {
    expect(normalizePhoneAnswer(input)).toBe("+8801712345678");
  });

  it("absorbs a non-breaking space and a Unicode hyphen, which is what a paste carries", () => {
    // A number copied from a contact card or a web page rarely arrives with
    // plain ASCII separators.
    expect(normalizePhoneAnswer("+880\u00a01712\u2013345678")).toBe("+8801712345678");
  });

  it("refuses a bare national number rather than guessing the country", () => {
    // The deliberate refusal. Inferring +880 because this site is Bangladeshi
    // would silently mangle the number of every respondent abroad, who are
    // exactly the people a country picker exists to serve.
    expect(normalizePhoneAnswer("01712345678")).toBeNull();
  });

  it.each(["call me", "+880 1712 EXTENSION", "+", "++8801712345678", ""])(
    "refuses %s",
    (input) => {
      expect(normalizePhoneAnswer(input)).toBeNull();
    }
  );

  it("refuses a letter hidden inside the digits rather than stripping it out", () => {
    // Stripping would turn this into a different, valid-looking number and store
    // it, which is worse than rejecting it.
    expect(normalizePhoneAnswer("+88017a2345678")).toBeNull();
  });

  it("refuses a country code beginning with zero", () => {
    expect(normalizePhoneAnswer("+0801712345678")).toBeNull();
  });

  it.each([
    [PHONE_DIGIT_LIMITS.min, true],
    [PHONE_DIGIT_LIMITS.max, true],
    [PHONE_DIGIT_LIMITS.min - 1, false],
    [PHONE_DIGIT_LIMITS.max + 1, false],
  ])("a %i digit number is accepted: %s", (digits, accepted) => {
    const value = `+${"1".repeat(digits)}`;

    expect(normalizePhoneAnswer(value) !== null).toBe(accepted);
  });
});

describe("the national part", () => {
  it("drops the trunk zero, because that is a national dialling prefix", () => {
    // 01712345678 at home is +880 1712345678 abroad. Keeping the zero produces a
    // different and unreachable number.
    expect(toNationalDigits("01712345678")).toBe("1712345678");
  });

  it("drops several leading zeros, not only one", () => {
    expect(toNationalDigits("0001712345678")).toBe("1712345678");
  });

  it("keeps interior zeros", () => {
    expect(toNationalDigits("1700000000")).toBe("1700000000");
  });

  it("returns nothing for punctuation alone", () => {
    expect(toNationalDigits(" - () ")).toBe("");
  });

  it("refuses unsupported characters instead of deleting them", () => {
    // Silent deletion would turn a typo into a different, valid-looking number.
    expect(toNationalDigits("1712abc345678")).toBeNull();
  });
});

describe("composing an answer from a picked country and a typed number", () => {
  it("produces the canonical form", () => {
    expect(composePhoneAnswer("+880", "1712-345678")).toBe("+8801712345678");
  });

  it("drops the trunk zero a respondent naturally types", () => {
    expect(composePhoneAnswer("+880", "01712345678")).toBe("+8801712345678");
  });

  it("keeps mixed letters visible to validation instead of silently deleting them", () => {
    const composed = composePhoneAnswer("+880", "1712abc345678");

    expect(composed).toContain("abc");
    expect(normalizePhoneAnswer(composed)).toBeNull();
  });

  it("produces an empty string when nothing was typed, not a bare dial code", () => {
    // Load-bearing. `toAnswers` omits the question entirely on an empty string,
    // so an untouched optional telephone field submits nothing at all rather
    // than "+880", which would then fail the format rule.
    expect(composePhoneAnswer("+880", "")).toBe("");
    expect(composePhoneAnswer("+880", "   ")).toBe("");
  });
});

describe("reading a canonical answer back apart", () => {
  it("finds the country and the national number", () => {
    expect(splitPhoneAnswer("+8801712345678")).toEqual({
      country: expect.objectContaining({ code: "BD", dial: "+880" }),
      nationalNumber: "1712345678",
    });
  });

  it("prefers the longest matching dial code", () => {
    // +1 is a prefix of nothing here, but +7 is shared by Russia and Kazakhstan
    // and +880 begins with +88, so a shortest-match walk would misattribute.
    const split = splitPhoneAnswer("+8801712345678");

    expect(split?.country.dial).toBe("+880");
  });

  it("returns null for anything not canonical", () => {
    expect(splitPhoneAnswer("01712345678")).toBeNull();
    expect(splitPhoneAnswer("+880 1712 345678")).toBeNull();
  });

  it("round-trips through compose", () => {
    const split = splitPhoneAnswer("+8801712345678");

    if (!split) throw new Error("The fixture should be canonical.");

    expect(composePhoneAnswer(split.country.dial, split.nationalNumber)).toBe("+8801712345678");
  });
});

describe("canonical recognition", () => {
  it("accepts only the stored shape", () => {
    expect(isCanonicalPhoneAnswer("+8801712345678")).toBe(true);
    expect(isCanonicalPhoneAnswer("+880 1712345678")).toBe(false);
    expect(isCanonicalPhoneAnswer("8801712345678")).toBe(false);
  });
});

describe("the country list", () => {
  it("defaults to Bangladesh, per decision 4", () => {
    expect(DEFAULT_COUNTRY).toMatchObject({ code: "BD", dial: "+880" });
  });

  it("finds a country by name, ISO code or dial code", () => {
    expect(filterDialCountries("bangla")[0]).toMatchObject({ code: "BD" });
    expect(filterDialCountries("bd")[0]).toMatchObject({ code: "BD" });
    expect(filterDialCountries("880").some((country) => country.code === "BD")).toBe(true);
  });

  it("tolerates a typed plus on a dial code, because that is how it is displayed", () => {
    expect(filterDialCountries("+880").some((country) => country.code === "BD")).toBe(true);
  });

  it("returns everything for an empty search, sorted by name", () => {
    const all = filterDialCountries("   ");
    const names = all.map((country) => country.name);

    expect(names).toEqual([...names].sort((first, second) => first.localeCompare(second)));
    expect(all.length).toBeGreaterThan(100);
  });

  it("returns nothing for a search that matches nothing", () => {
    expect(filterDialCountries("zzzzz")).toEqual([]);
  });
});
