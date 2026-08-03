import { describe, expect, it } from "vitest";

import {
  parseFormDefinition,
  validateFormAnswers,
} from "@/lib/forms/definition";

const assetId = "550e8400-e29b-41d4-a716-446655440000";

function createDefinition() {
  return {
    fields: [
      { id: "intro", label: "Before you start", type: "section" },
      { id: "full_name", label: "Full name", required: true, type: "text" },
      { id: "about", label: "About you", required: false, type: "textarea" },
      { id: "email", label: "Email", required: true, type: "email" },
      { id: "phone", label: "Phone", required: true, type: "telephone" },
      { id: "guests", label: "Guests", required: false, type: "number" },
      { id: "birth_date", label: "Birth date", required: false, type: "date" },
      {
        id: "department",
        label: "Department",
        options: [{ label: "CSE", value: "cse" }],
        required: true,
        type: "select",
      },
      {
        id: "attendance",
        label: "Attendance",
        options: [
          { label: "In person", value: "in_person" },
          { label: "Online", value: "online" },
        ],
        required: false,
        type: "radio",
      },
      {
        id: "interests",
        label: "Interests",
        options: [
          { label: "Design", value: "design" },
          { label: "Engineering", value: "engineering" },
        ],
        required: false,
        type: "multi_select",
      },
      { id: "newsletter", label: "Newsletter", required: false, type: "checkbox" },
      { id: "terms", label: "Terms", required: true, type: "consent" },
      { id: "portrait", label: "Portrait", required: false, type: "image" },
      { id: "resume", label: "Resume", required: false, type: "pdf" },
    ],
    payment: { enabled: false },
  };
}

describe("shared form definitions", () => {
  it("accepts every V1 field type with a disabled payment configuration", () => {
    const definition = parseFormDefinition(createDefinition());

    expect(definition.fields.map((field) => field.type)).toEqual([
      "section",
      "text",
      "textarea",
      "email",
      "telephone",
      "number",
      "date",
      "select",
      "radio",
      "multi_select",
      "checkbox",
      "consent",
      "image",
      "pdf",
    ]);
    expect(definition.payment).toEqual({ enabled: false });
  });

  it("rejects duplicate IDs and payment activation", () => {
    const duplicateFieldIds = createDefinition();
    duplicateFieldIds.fields[1] = {
      id: "email",
      label: "Full name",
      required: true,
      type: "text",
    };

    expect(() => parseFormDefinition(duplicateFieldIds)).toThrow(/unique/i);
    expect(() =>
      parseFormDefinition({ ...createDefinition(), payment: { enabled: true } })
    ).toThrow(/disabled/i);
  });

  it("canonicalizes valid answers and rejects unexpected or unconsented values", () => {
    const definition = parseFormDefinition(createDefinition());

    expect(
      validateFormAnswers(definition, {
        about: "  Student volunteer  ",
        attendance: "in_person",
        birth_date: "2026-07-16",
        department: "cse",
        email: " REDWAN@EXAMPLE.TEST ",
        full_name: "  Redwan  ",
        guests: "2",
        interests: ["design", "engineering"],
        newsletter: true,
        phone: "+880 1700 000000",
        portrait: [assetId],
        resume: [assetId],
        terms: true,
      })
    ).toMatchObject({
      about: "Student volunteer",
      attendance: "in_person",
      email: "redwan@example.test",
      full_name: "Redwan",
      guests: 2,
      // Task 2.6. This input was already here and nothing asserted what became
      // of it; the separators used to be stored verbatim.
      phone: "+8801700000000",
      terms: true,
    });

    expect(() =>
      validateFormAnswers(definition, {
        department: "cse",
        email: "redwan@example.test",
        full_name: "Redwan",
        phone: "+880 1700 000000",
        terms: false,
        unexpected: "not accepted",
      })
    ).toThrow(/consent|unexpected/i);
  });
});

/**
 * Task 3.2. A radio and a dropdown are the same stored contract, so these
 * assertions exist to prove the two cannot drift apart: any rule below that a
 * `select` would also satisfy is the point, not a coincidence.
 */
describe("single choice answers", () => {
  const definitionOf = (required: boolean) =>
    parseFormDefinition({
      fields: [
        {
          id: "attendance",
          label: "Attendance",
          options: [
            { label: "In person", value: "in_person" },
            { label: "Online", value: "online" },
          ],
          required,
          type: "radio",
        },
      ],
      payment: { enabled: false },
    });

  it("stores one option value as a string", () => {
    expect(validateFormAnswers(definitionOf(false), { attendance: "online" })).toEqual({
      attendance: "online",
    });
  });

  it("rejects a value that is not one of the options", () => {
    expect(() =>
      validateFormAnswers(definitionOf(false), { attendance: "hybrid" })
    ).toThrow(/listed options/i);
  });

  it("rejects an array, which is the multi_select shape", () => {
    // Worth pinning: the two choice controls now look similar on the page, and
    // a group posting an array under a single-choice field must not be
    // silently coerced into its first element.
    expect(() =>
      validateFormAnswers(definitionOf(false), { attendance: ["online"] })
    ).toThrow(/must be text/i);
  });

  it("omits an unanswered optional question rather than storing an empty string", () => {
    expect(validateFormAnswers(definitionOf(false), {})).toEqual({});
  });

  it("requires an answer when the question is required", () => {
    expect(() => validateFormAnswers(definitionOf(true), {})).toThrow(/required/i);
  });
});

/**
 * Task 2.6. A telephone answer had no format rule at all: the schema capped it at
 * 32 characters, so `"call me"` was valid and one person could be stored three
 * different ways depending on how they typed their own number.
 */
describe("telephone answers are stored canonically", () => {
  const definitionOf = (overrides: Record<string, unknown> = {}) =>
    parseFormDefinition({
      fields: [
        { id: "phone", label: "Phone number", required: false, type: "telephone", ...overrides },
      ],
      payment: { enabled: false },
    });

  it.each([
    "+8801712345678",
    "+880 1712 345678",
    "+880 1712-345678",
    "008801712345678",
  ])("stores %s as one canonical value", (typed) => {
    // The whole point of the task. These four are the same person, and before
    // this they were four different rows.
    expect(validateFormAnswers(definitionOf(), { phone: typed })).toEqual({
      phone: "+8801712345678",
    });
  });

  it("rejects prose, which the old 32 character cap accepted", () => {
    expect(() => validateFormAnswers(definitionOf(), { phone: "call me" })).toThrow(
      /Phone number: Enter the number with its country code/
    );
  });

  it("rejects a bare national number rather than assuming Bangladesh", () => {
    expect(() => validateFormAnswers(definitionOf(), { phone: "01712345678" })).toThrow(
      /country code/
    );
  });

  it("omits an unanswered optional number rather than storing an empty string", () => {
    expect(validateFormAnswers(definitionOf(), {})).toEqual({});
    expect(validateFormAnswers(definitionOf(), { phone: "" })).toEqual({});
  });

  it("still requires an answer when the question is required", () => {
    expect(() =>
      validateFormAnswers(definitionOf({ required: true }), { phone: "" })
    ).toThrow("Phone number is required.");
  });

  it("measures the author's cap against the canonical value, not what was typed", () => {
    // 14 characters canonical, 16 as typed. Capping the typed string would
    // reject this while accepting the identical +8801712345678.
    expect(
      validateFormAnswers(definitionOf({ maxLength: 14 }), { phone: "+880 1712-345678" })
    ).toEqual({ phone: "+8801712345678" });
  });

  it("still enforces a cap the canonical value genuinely exceeds", () => {
    expect(() =>
      validateFormAnswers(definitionOf({ maxLength: 13 }), { phone: "+8801712345678" })
    ).toThrow("Phone number: Shorten this to 13 characters or fewer.");
  });

  it("reports the format before the length", () => {
    // Thirty characters of prose should be told to include a country code, not
    // told to shorten itself.
    expect(() =>
      validateFormAnswers(definitionOf({ maxLength: 10 }), { phone: "please just email me instead" })
    ).toThrow(/country code/);
  });
});

/**
 * Task 2.3. The server enforces the shared rules, so its messages are the
 * shared sentences with the field label prefixed — a banner has no field
 * context, unlike the client, which renders beside a labelled control.
 *
 * Several of these were previously worse than the rule they enforced.
 */
describe("server messages name the field and say what to do", () => {
  const definition = parseFormDefinition({
    fields: [
      { id: "email", label: "Email address", required: true, type: "email" },
      { id: "guests", label: "Guests", max: 5, min: 1, required: false, type: "number" },
      { id: "born_on", label: "Date of birth", required: false, type: "date" },
      { id: "about", label: "About you", maxLength: 20, required: false, type: "textarea" },
    ],
    payment: { enabled: false },
  });

  const answers = (overrides: Record<string, unknown>) => ({
    email: "member@example.test",
    ...overrides,
  });

  it("reports a malformed address in words rather than as a ZodError", () => {
    // This path used to be a bare z.string().email().parse(), whose thrown
    // ZodError said "Invalid email" — the one message here not written for a
    // person to read.
    expect(() => validateFormAnswers(definition, answers({ email: "someone@localhost" }))).toThrow(
      "Email address: Enter an email address in the form name@example.com."
    );
  });

  it("names the bound rather than saying a bound exists", () => {
    // Was "Guests is below the minimum", which did not say what the minimum was.
    expect(() => validateFormAnswers(definition, answers({ guests: 0 }))).toThrow(
      "Guests: Enter 1 or more."
    );
    expect(() => validateFormAnswers(definition, answers({ guests: 6 }))).toThrow(
      "Guests: Enter 5 or less."
    );
  });

  it("still stores a number inside the range", () => {
    expect(validateFormAnswers(definition, answers({ guests: "3" })).guests).toBe(3);
  });

  it("names the length limit", () => {
    // Was "About you is too long".
    expect(() => validateFormAnswers(definition, answers({ about: "a".repeat(21) }))).toThrow(
      "About you: Shorten this to 20 characters or fewer."
    );
  });

  it("rejects a date that looks real and is not", () => {
    expect(() => validateFormAnswers(definition, answers({ born_on: "2026-02-30" }))).toThrow(
      /Date of birth: Enter a real date/
    );
  });

  it("leaves requiredness phrased as it always was", () => {
    // Requiredness is not a shared rule, so its message is unchanged and
    // deliberately reads differently from the rest.
    expect(() => validateFormAnswers(definition, { email: "" })).toThrow(
      "Email address is required."
    );
  });
});
