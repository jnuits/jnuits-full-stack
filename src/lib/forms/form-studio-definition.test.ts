import { describe, expect, it } from "vitest";

import {
  ANSWER_LENGTH_LIMITS,
  HELP_TEXT_MAX_LENGTH,
  parseFormDefinition,
  type FormField,
} from "@/lib/forms/definition";
import {
  createStudioEditorKey,
  createUniqueStudioFieldId,
  duplicateStudioField,
  formDefinitionToStudioFields,
  markStudioFieldIdsPersisted,
  STUDIO_HELP_TEXT_MAX_LENGTH,
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
  it("derives seeded starter keys deterministically across server and client renders", () => {
    expect(createStudioEditorKey("full_name")).toBe("studio-field-full_name");
    expect(createStudioEditorKey("full_name")).toBe("studio-field-full_name");
    expect(createStudioEditorKey("email")).not.toBe(
      createStudioEditorKey("full_name")
    );
  });

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
      // `maxLength` appears without ever having been written: the stored
      // definition omitted it, the schema defaulted it, and the editor now shows
      // the real cap rather than a blank box implying there is none.
      { id: "full_name", label: "Full name", maxLength: 160, optionsText: "", required: true, type: "text" },
      { id: "track", label: "Track", optionsText: "Web\nMobile", required: true, type: "select" },
      { id: "portfolio", label: "Portfolio", maxFiles: 1, optionsText: "", required: false, type: "pdf" },
    ]);
  });
});

/**
 * Task 3.1. `helpText` was in the schema and, after task 2.1, associated with
 * its control by the renderer. The Studio had no input for it, so the only way
 * to author it was to edit stored JSON by hand.
 */
describe("Form Studio help text", () => {
  it("carries authored help text into the schema, trimmed", () => {
    const definition = studioFieldsToDefinition([
      editorField({ helpText: "  Use the name printed on your student ID.  ", id: "full_name", label: "Full name", optionsText: "", required: true, type: "text" }),
    ]);

    expect(definition.fields[0].helpText).toBe("Use the name printed on your student ID.");
  });

  it("omits help text that is empty or whitespace rather than storing it", () => {
    const definition = studioFieldsToDefinition([
      editorField({ helpText: "   ", id: "full_name", label: "Full name", optionsText: "", required: true, type: "text" }),
      editorField({ helpText: "", id: "email", label: "Email address", optionsText: "", required: true, type: "email" }),
      editorField({ id: "phone", label: "Phone number", optionsText: "", required: false, type: "telephone" }),
    ]);

    // Not tidiness. `helpText: ""` parses, and the renderer then points
    // aria-describedby at an empty paragraph, so the control announces a
    // description that says nothing at all.
    expect(JSON.stringify(definition)).not.toContain("helpText");
    for (const field of definition.fields) {
      expect(field).not.toHaveProperty("helpText");
    }
  });

  it("survives every authorable field type, including ones with their own settings", () => {
    const definition = studioFieldsToDefinition([
      editorField({ helpText: "Pick every track you want.", id: "tracks", label: "Interested tracks", optionsText: "Web\nMobile", required: false, type: "multi_select" }),
      editorField({ helpText: "Pick the one you would attend.", id: "attendance", label: "Attendance", optionsText: "In person\nOnline", required: false, type: "radio" }),
      editorField({ helpText: "A photo of the card is fine.", id: "id_card", label: "Student ID card", optionsText: "", required: true, type: "image" }),
      editorField({ helpText: "Tick this to continue.", id: "consent", label: "I confirm these details are accurate", optionsText: "", required: true, type: "consent" }),
    ]);

    expect(definition.fields.map((field) => field.helpText)).toEqual([
      "Pick every track you want.",
      "Pick the one you would attend.",
      "A photo of the card is fine.",
      "Tick this to continue.",
    ]);
  });

  it("does not serialize help text newly hidden by a section conversion", () => {
    const definition = studioFieldsToDefinition([
      editorField({ helpText: "This must not become hidden guidance.", id: "personal", label: "Personal details", optionsText: "", required: false, type: "section" }),
    ]);

    expect(definition.fields[0]).not.toHaveProperty("helpText");
  });

  it("preserves legacy section help text loaded from stored data", () => {
    const stored = parseFormDefinition({
      fields: [
        { helpText: "Stored before section authoring was disabled.", id: "personal", label: "Personal details", type: "section" },
      ],
      payment: { enabled: false },
    });
    const reopened = formDefinitionToStudioFields(stored);
    const savedAgain = studioFieldsToDefinition(reopened);

    expect(savedAgain.fields[0].helpText).toBe("Stored before section authoring was disabled.");
  });

  it("reads help text back out of a stored definition", () => {
    const fields = formDefinitionToStudioFields(parseFormDefinition({
      fields: [
        { helpText: "Use the name printed on your student ID.", id: "full_name", label: "Full name", required: true, type: "text" },
        { id: "email", label: "Email address", required: true, type: "email" },
      ],
      payment: { enabled: false },
    }));

    // Opening a form and saving a new draft must not silently drop authored
    // help text, which is what a write-only conversion would do.
    expect(fields[0].helpText).toBe("Use the name printed on your student ID.");
    expect(fields[1].helpText).toBeUndefined();
  });

  it("carries help text through a duplicated question", () => {
    const source = editorField({ helpText: "Use the name printed on your student ID.", id: "full_name", label: "Full name", optionsText: "", required: true, type: "text" });
    const duplicate = duplicateStudioField(source, [source.id]);

    expect(duplicate.helpText).toBe(source.helpText);
  });

  it("advertises exactly the cap the schema enforces", () => {
    const atLimit = "a".repeat(STUDIO_HELP_TEXT_MAX_LENGTH);
    const field = (helpText: string) =>
      editorField({ helpText, id: "full_name", label: "Full name", optionsText: "", required: true, type: "text" });

    // The Studio's cap is no longer a second literal -- it is re-exported from
    // the schema's own constant, so the two cannot disagree. This is no longer
    // a drift guard; it is the narrower claim that the number the input
    // advertises is the number a save is actually checked against.
    expect(STUDIO_HELP_TEXT_MAX_LENGTH).toBe(HELP_TEXT_MAX_LENGTH);
    expect(studioFieldsToDefinition([field(atLimit)]).fields[0].helpText).toBe(atLimit);
    expect(() => studioFieldsToDefinition([field(`${atLimit}a`)])).toThrow();
  });
});

/**
 * Task 3.2. The conversion treats `radio` exactly as it treats `select` and
 * `multi_select`, because all three are keyed off `isChoiceFieldType` rather
 * than named individually. These assertions exist to keep that true.
 */
describe("Form Studio single choice conversion", () => {
  const optionsOf = (field: FormField) => ("options" in field ? field.options : []);

  const attendance = (type: "multi_select" | "radio" | "select") =>
    editorField({
      id: "attendance",
      label: "Attendance",
      optionsText: "In person\nOnline",
      required: true,
      type,
    });

  it("turns the choices textarea into option label and value pairs", () => {
    const definition = studioFieldsToDefinition([attendance("radio")]);

    expect(definition.fields[0]).toMatchObject({
      options: [
        { label: "In person", value: "in_person" },
        { label: "Online", value: "online" },
      ],
      required: true,
      type: "radio",
    });
  });

  it("derives the same options a dropdown and a checkbox group would", () => {
    // One branch serves all three. If a future change gives one of them its own
    // path, this is what notices.
    const asSelect = optionsOf(studioFieldsToDefinition([attendance("select")]).fields[0]);

    expect(optionsOf(studioFieldsToDefinition([attendance("radio")]).fields[0])).toEqual(asSelect);
    expect(optionsOf(studioFieldsToDefinition([attendance("multi_select")]).fields[0])).toEqual(
      asSelect
    );
    expect(asSelect).toHaveLength(2);
  });

  it("rejects a single choice question with no options rather than publishing an empty one", () => {
    expect(() =>
      studioFieldsToDefinition([
        editorField({ id: "attendance", label: "Attendance", optionsText: "", required: false, type: "radio" }),
      ])
    ).toThrow();
  });

  it("reads a stored single choice question back into the editor", () => {
    const fields = formDefinitionToStudioFields(parseFormDefinition({
      fields: [
        {
          helpText: "Pick the one you would attend.",
          id: "attendance",
          label: "Attendance",
          options: [
            { label: "In person", value: "in_person" },
            { label: "Online", value: "online" },
          ],
          required: true,
          type: "radio",
        },
      ],
      payment: { enabled: false },
    }));

    expect(withoutEditorKey(fields[0])).toEqual({
      helpText: "Pick the one you would attend.",
      id: "attendance",
      label: "Attendance",
      optionsText: "In person\nOnline",
      required: true,
      type: "radio",
    });
  });

  it("round-trips without changing the stored shape", () => {
    const original = studioFieldsToDefinition([attendance("radio")]);
    const reopened = studioFieldsToDefinition(formDefinitionToStudioFields(original));

    expect(reopened).toEqual(original);
  });

  it("duplicates a single choice question with its options intact", () => {
    const source = attendance("radio");
    const duplicate = duplicateStudioField(source, [source.id]);

    expect(duplicate.optionsText).toBe("In person\nOnline");
    expect(duplicate.type).toBe("radio");
    expect(duplicate.id).toBe("attendance_2");
  });
});

/**
 * Task 2.4. `maxLength` was in the schema from the beginning and unauthorable
 * the whole time, so every short answer silently carried 160 characters and
 * every paragraph 4 000 whether the author wanted a cap or not.
 */
describe("Form Studio answer length", () => {
  const question = (type: "telephone" | "text" | "textarea", maxLength?: number) =>
    editorField({ id: "about", label: "About you", maxLength, optionsText: "", required: false, type });

  it("carries an authored cap into the schema", () => {
    expect(studioFieldsToDefinition([question("textarea", 500)]).fields[0]).toMatchObject({
      maxLength: 500,
      type: "textarea",
    });
  });

  it.each([
    ["telephone", 32],
    ["text", 160],
    ["textarea", 4_000],
  ] as const)("states the default cap for an unauthored %s", (type, expected) => {
    // Stated rather than omitted. A published definition that says nothing about
    // its cap reads back into a blank input, and a blank input reads as "no
    // limit" to an operator who never set one.
    expect(studioFieldsToDefinition([question(type)]).fields[0]).toMatchObject({
      maxLength: expected,
    });
  });

  it("matches the schema's own table rather than restating it", () => {
    for (const [type, limits] of Object.entries(ANSWER_LENGTH_LIMITS)) {
      const parsed = studioFieldsToDefinition([
        question(type as "telephone" | "text" | "textarea"),
      ]).fields[0];

      expect(parsed).toMatchObject({ maxLength: limits.defaultValue });
    }
  });

  it.each([
    ["text", 2_001],
    ["textarea", 10_001],
    ["telephone", 41],
  ] as const)("rejects a %s cap above the schema's ceiling", (type, tooLarge) => {
    expect(() => studioFieldsToDefinition([question(type, tooLarge)])).toThrow();
  });

  it("rejects a telephone cap below the floor, which no reachable number clears", () => {
    expect(() => studioFieldsToDefinition([question("telephone", 6)])).toThrow();
  });

  it("adds no cap to a type that has none", () => {
    const definition = studioFieldsToDefinition([
      editorField({ id: "email", label: "Email address", optionsText: "", required: true, type: "email" }),
    ]);

    expect(definition.fields[0]).not.toHaveProperty("maxLength");
  });

  it("reads an authored cap back into the editor", () => {
    const fields = formDefinitionToStudioFields(parseFormDefinition({
      fields: [{ id: "about", label: "About you", maxLength: 500, required: false, type: "textarea" }],
      payment: { enabled: false },
    }));

    expect(fields[0].maxLength).toBe(500);
  });

  it("round-trips an authored cap unchanged", () => {
    const original = studioFieldsToDefinition([question("textarea", 500)]);

    expect(studioFieldsToDefinition(formDefinitionToStudioFields(original))).toEqual(original);
  });

  it("carries the cap through a duplicated question", () => {
    const source = question("textarea", 500);

    expect(duplicateStudioField(source, [source.id]).maxLength).toBe(500);
  });
});
