import { describe, expect, it } from "vitest";

import { parseFormDefinition } from "@/lib/forms/definition";
import {
  createStudioEditorKey,
  createUniqueStudioFieldId,
  duplicateStudioField,
  formDefinitionToStudioFields,
  markStudioFieldIdsPersisted,
  studioFieldsToDefinition,
  updateAutomaticStudioFieldLabel,
  type StudioEditorField,
} from "@/lib/forms/form-studio-definition";

function editorField(field: Omit<StudioEditorField, "editorKey">): StudioEditorField {
  return { editorKey: createStudioEditorKey(), ...field };
}

/** Editor-only property, stripped so shape assertions stay about the schema. */
function withoutEditorKey(field: StudioEditorField) {
  const { editorKey, ...rest } = field;
  void editorKey;
  return rest;
}

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
    const unsaved = [editorField({ automaticId: true, id: "new_question", label: "New question", optionsText: "", required: false, type: "text" })];
    const renamed = updateAutomaticStudioFieldLabel(unsaved, 0, "Emergency contact");
    expect(renamed[0]).toMatchObject({ id: "emergency_contact", label: "Emergency contact" });

    const persisted = markStudioFieldIdsPersisted(renamed);
    const relabeled = updateAutomaticStudioFieldLabel(persisted, 0, "Primary contact");
    expect(relabeled[0]).toMatchObject({ id: "emergency_contact", label: "Primary contact" });
  });

  it("duplicates a question with a fresh automatic ID without mutating the source", () => {
    const source = editorField({ id: "email", label: "Email", optionsText: "", required: true, type: "email" });
    const duplicate = duplicateStudioField(source, [source.id]);
    expect(withoutEditorKey(duplicate)).toEqual({ ...withoutEditorKey(source), automaticId: true, id: "email_2" });
    expect(source.id).toBe("email");
  });
});

/**
 * The editor key exists to stop the label input losing focus on every
 * keystroke. Typing regenerated the schema id, which was the React key, so
 * React unmounted and remounted the row and the caret went with it.
 */
describe("Form Studio editor row keys", () => {
  it("issues a distinct key each time", () => {
    expect(createStudioEditorKey()).not.toBe(createStudioEditorKey());
  });

  it("survives every keystroke of a rename, while the schema ID moves", () => {
    let fields = [editorField({ automaticId: true, id: "new_question", label: "New question", optionsText: "", required: false, type: "text" })];
    const originalKey = fields[0].editorKey;

    // One call per character, as the input's onChange actually fires.
    for (const label of ["B", "Ba", "Bat", "Batc", "Batch"]) {
      fields = updateAutomaticStudioFieldLabel(fields, 0, label);
    }

    expect(fields[0].editorKey).toBe(originalKey);
    expect(fields[0].id).toBe("batch");
    expect(fields[0].label).toBe("Batch");
  });

  it("survives a rename on a persisted question too", () => {
    const persisted = markStudioFieldIdsPersisted([
      editorField({ id: "batch_label", label: "Batch", optionsText: "", required: false, type: "text" }),
    ]);
    const renamed = updateAutomaticStudioFieldLabel(persisted, 0, "Batch year");

    expect(renamed[0].editorKey).toBe(persisted[0].editorKey);
    expect(renamed[0].id).toBe("batch_label");
  });

  it("gives a duplicated row its own key, so React cannot merge the two", () => {
    const source = editorField({ id: "email", label: "Email", optionsText: "", required: true, type: "email" });
    const duplicate = duplicateStudioField(source, [source.id]);

    expect(duplicate.editorKey).not.toBe(source.editorKey);
  });

  it("is preserved when identifiers are frozen after a save", () => {
    const fields = [editorField({ automaticId: true, id: "batch", label: "Batch", optionsText: "", required: false, type: "text" })];
    const persisted = markStudioFieldIdsPersisted(fields);

    expect(persisted[0].editorKey).toBe(fields[0].editorKey);
    expect(persisted[0].automaticId).toBeUndefined();
  });

  it("assigns a unique key to every row loaded from a stored definition", () => {
    const fields = formDefinitionToStudioFields(parseFormDefinition({
      fields: [
        { id: "full_name", label: "Full name", required: true, type: "text" },
        { id: "email", label: "Email address", required: true, type: "email" },
        { id: "consent", label: "I confirm", required: true, type: "consent" },
      ],
      payment: { enabled: false },
    }));
    const keys = fields.map((field) => field.editorKey);

    expect(keys.every(Boolean)).toBe(true);
    expect(new Set(keys).size).toBe(fields.length);
  });

  it("never leaks the key into a published schema", () => {
    const definition = studioFieldsToDefinition([
      editorField({ id: "full_name", label: "Full name", optionsText: "", required: true, type: "text" }),
    ]);

    expect(JSON.stringify(definition)).not.toContain("editorKey");
    expect(JSON.stringify(definition)).not.toContain("studio-field-");
  });
});

describe("Form Studio definition conversion", () => {
  it("emits valid private image and PDF field schema with a one-file default", () => {
    const definition = studioFieldsToDefinition([
      editorField({ id: "full_name", label: "Full name", optionsText: "", required: true, type: "text" }),
      editorField({ id: "student_id", label: "Student ID card", optionsText: "", required: true, type: "image" }),
      editorField({ id: "cv", label: "CV", optionsText: "", required: false, type: "pdf" }),
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
    expect(fields.map(withoutEditorKey)).toEqual([
      { id: "full_name", label: "Full name", optionsText: "", required: true, type: "text" },
      { id: "track", label: "Track", optionsText: "Web\nMobile", required: true, type: "select" },
      { id: "portfolio", label: "Portfolio", maxFiles: 1, optionsText: "", required: false, type: "pdf" },
    ]);
  });
});
