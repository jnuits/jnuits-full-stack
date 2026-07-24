import { describe, expect, it } from "vitest";

import { parseFormDefinition } from "@/lib/forms/definition";
import {
  createUniqueStudioFieldId,
  duplicateStudioField,
  formDefinitionToStudioFields,
  markStudioFieldIdsPersisted,
  studioFieldsToDefinition,
  updateAutomaticStudioFieldLabel,
} from "@/lib/forms/form-studio-definition";

describe("Form Studio field identity", () => {
  it("generates readable IDs and deterministic collision suffixes", () => {
    expect(createUniqueStudioFieldId("Email address", [])).toBe("email_address");
    expect(createUniqueStudioFieldId("Email", ["email"])).toBe("email_2");
    expect(createUniqueStudioFieldId("Email", ["email", "email_2"])).toBe("email_3");
  });

  it("handles Bangla, punctuation-only, reserved, and empty labels safely", () => {
    expect(createUniqueStudioFieldId("আপনার নাম", [])).toMatch(/^field_[a-z0-9]+$/);
    expect(createUniqueStudioFieldId("!!!", [])).toMatch(/^field_[a-z0-9]+$/);
    expect(createUniqueStudioFieldId("constructor", [])).toMatch(/^field_[a-z0-9]+$/);
    expect(createUniqueStudioFieldId("", [])).toBe("field");
  });

  it("keeps generated IDs within the schema limit after suffixing", () => {
    const label = `a${"b".repeat(90)}`;
    const first = createUniqueStudioFieldId(label, []);
    const second = createUniqueStudioFieldId(label, [first]);
    expect(first).toHaveLength(64);
    expect(second.length).toBeLessThanOrEqual(64);
    expect(second).toMatch(/_2$/);
  });

  it("updates label-derived IDs before persistence and freezes them afterward", () => {
    const unsaved = [{ automaticId: true, id: "new_question", label: "New question", optionsText: "", required: false, type: "text" as const }];
    const renamed = updateAutomaticStudioFieldLabel(unsaved, 0, "Emergency contact");
    expect(renamed[0]).toMatchObject({ id: "emergency_contact", label: "Emergency contact" });

    const persisted = markStudioFieldIdsPersisted(renamed);
    const relabeled = updateAutomaticStudioFieldLabel(persisted, 0, "Primary contact");
    expect(relabeled[0]).toMatchObject({ id: "emergency_contact", label: "Primary contact" });
  });

  it("duplicates a question with a fresh automatic ID without mutating the source", () => {
    const source = { id: "email", label: "Email", optionsText: "", required: true, type: "email" as const };
    const duplicate = duplicateStudioField(source, [source.id]);
    expect(duplicate).toEqual({ ...source, automaticId: true, id: "email_2" });
    expect(source.id).toBe("email");
  });
});

describe("Form Studio definition conversion", () => {
  it("emits valid private image and PDF field schema with a one-file default", () => {
    const definition = studioFieldsToDefinition([
      { id: "full_name", label: "Full name", optionsText: "", required: true, type: "text" },
      { id: "student_id", label: "Student ID card", optionsText: "", required: true, type: "image" },
      { id: "cv", label: "CV", optionsText: "", required: false, type: "pdf" },
    ]);
    const parsed = parseFormDefinition(definition);
    expect(parsed.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "student_id", maxFiles: 1, type: "image" }),
      expect.objectContaining({ id: "cv", maxFiles: 1, type: "pdf" }),
    ]));
    expect(parsed.payment).toEqual({ enabled: false });
  });

  it("loads a published definition without changing historical IDs", () => {
    const fields = formDefinitionToStudioFields(parseFormDefinition({
      fields: [
        { id: "full_name", label: "Full name", required: true, type: "text" },
        { id: "track", label: "Track", options: [{ label: "Web", value: "web" }, { label: "Mobile", value: "mobile" }], required: true, type: "select" },
        { id: "portfolio", label: "Portfolio", maxFiles: 1, required: false, type: "pdf" },
      ],
      payment: { enabled: false },
    }));
    expect(fields).toEqual([
      { id: "full_name", label: "Full name", optionsText: "", required: true, type: "text" },
      { id: "track", label: "Track", optionsText: "Web\nMobile", required: true, type: "select" },
      { id: "portfolio", label: "Portfolio", maxFiles: 1, optionsText: "", required: false, type: "pdf" },
    ]);
  });
});
