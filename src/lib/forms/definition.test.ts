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
      email: "redwan@example.test",
      full_name: "Redwan",
      guests: 2,
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
