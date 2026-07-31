import { describe, expect, it } from "vitest";

import { parseFormDefinition, type FormFieldType } from "@/lib/forms/definition";
import {
  extractApplicationIdentity,
  parseFormApplicationBehavior,
} from "@/lib/forms/application-behavior";

/**
 * A membership form whose Batch question can be swapped to any type, because
 * that swap is what produced "batchLabel must map to a compatible form field."
 */
function membershipDefinition(batchType: FormFieldType) {
  const batch =
    batchType === "select" || batchType === "multi_select" || batchType === "radio"
      ? {
          id: "batch_label",
          label: "Batch",
          options: [
            { label: "16th", value: "16th" },
            { label: "17th", value: "17th" },
          ],
          required: false,
          type: batchType,
        }
      : batchType === "image" || batchType === "pdf"
        ? { id: "batch_label", label: "Batch", maxFiles: 1, required: false, type: batchType }
        : batchType === "consent"
          ? { id: "batch_label", label: "Batch", required: true, type: batchType }
          : { id: "batch_label", label: "Batch", required: false, type: batchType };

  return parseFormDefinition({
    fields: [
      { id: "full_name", label: "Full name", required: true, type: "text" },
      { id: "email", label: "Email address", required: true, type: "email" },
      batch,
    ],
    payment: { enabled: false },
  });
}

function behaviorFor(batchType: FormFieldType) {
  return parseFormApplicationBehavior(
    "membership_application",
    { fieldMapping: { batchLabel: "batch_label", email: "email", fullName: "full_name" } },
    membershipDefinition(batchType)
  );
}

describe("application detail mapping accepts any text-producing question", () => {
  // The reported defect: a Batch dropdown was rejected while a Department
  // dropdown was accepted, with no runtime difference between them.
  const compatible: FormFieldType[] = [
    "date",
    "email",
    "radio",
    "select",
    "telephone",
    "text",
    "textarea",
  ];

  for (const type of compatible) {
    it(`accepts a ${type} question`, () => {
      expect(behaviorFor(type).fieldMapping.batchLabel).toBe("batch_label");
    });
  }

  it("accepts the dropdown that previously failed, by name", () => {
    expect(() => behaviorFor("select")).not.toThrow();
  });

  it("accepts a single choice question on the same grounds as a dropdown", () => {
    // Task 3.2. `radio` is here because `validateFormAnswers` runs it through
    // `parseChoice` exactly as it does `select`, not because someone remembered
    // to add it. Excluding a new string-producing type would recreate the drift
    // STRING_ANSWER_FIELD_TYPES was written to end.
    expect(() => behaviorFor("radio")).not.toThrow();
  });
});

describe("application detail mapping still rejects non-text answers", () => {
  // These are rejected because of what they produce, not because of a list
  // someone forgot to extend. readMappedString requires a string.
  const incompatible: FormFieldType[] = [
    "checkbox",
    "consent",
    "image",
    "multi_select",
    "number",
    "pdf",
  ];

  for (const type of incompatible) {
    it(`rejects a ${type} question`, () => {
      expect(() => behaviorFor(type)).toThrow(/text answer/);
    });
  }

  it("names the operator-facing label, the question, and what to choose", () => {
    // The old message said "batchLabel must map to a compatible form field",
    // naming an internal key the operator never sees anywhere in the UI.
    expect(() => behaviorFor("number")).toThrow(/^Batch must map to/);
    expect(() => behaviorFor("number")).toThrow(/"Batch" is a number question/);
    expect(() => behaviorFor("number")).toThrow(/short answer, paragraph, email, telephone, date, dropdown, or single choice/);
  });

  it("names the guidance in the Studio's own words, not the schema's", () => {
    // "Single choice" is what the question type dropdown says. Naming the
    // schema's `radio` would send an operator hunting for an option that is not
    // written anywhere on the screen.
    expect(() => behaviorFor("number")).toThrow(/single choice question\.$/);
  });

  it("reports a multi-word question type readably", () => {
    expect(() => behaviorFor("multi_select")).toThrow(/is a multi select question/);
  });
});

describe("the email mapping stays strict", () => {
  function withEmailMappedTo(fieldId: string) {
    return parseFormApplicationBehavior(
      "membership_application",
      { fieldMapping: { email: fieldId, fullName: "full_name" } },
      parseFormDefinition({
        fields: [
          { id: "full_name", label: "Full name", required: true, type: "text" },
          { id: "email", label: "Email address", required: true, type: "email" },
          { id: "contact", label: "Contact", required: true, type: "text" },
        ],
        payment: { enabled: false },
      })
    );
  }

  it("accepts an email question", () => {
    expect(withEmailMappedTo("email").fieldMapping.email).toBe("email");
  });

  it("rejects a plain text question, which is never validated or lowercased", () => {
    // The address becomes the applicant's identity for confirmation tokens and
    // deduplication, so it cannot come from an unvalidated field.
    expect(() => withEmailMappedTo("contact")).toThrow(/must map to an email question/);
  });
});

describe("mapping failures that are not about type", () => {
  const definition = parseFormDefinition({
    fields: [
      { id: "details", label: "Your details", type: "section" },
      { id: "full_name", label: "Full name", required: true, type: "text" },
      { id: "email", label: "Email address", required: true, type: "email" },
    ],
    payment: { enabled: false },
  });

  it("explains a mapping pointing at a deleted question", () => {
    expect(() =>
      parseFormApplicationBehavior(
        "membership_application",
        { fieldMapping: { email: "email", fullName: "full_name", studentId: "removed_field" } },
        definition
      )
    ).toThrow(/Student ID is mapped to a question that no longer exists/);
  });

  it("explains a mapping pointing at a section heading", () => {
    expect(() =>
      parseFormApplicationBehavior(
        "membership_application",
        { fieldMapping: { email: "email", fullName: "full_name", studentId: "details" } },
        definition
      )
    ).toThrow(/section heading, which collects no answer/);
  });
});

describe("a choice answer survives identity extraction", () => {
  it("reads the selected option value as the batch label", () => {
    // Publish-time acceptance is only half the contract; the value has to
    // arrive intact at review time too.
    const identity = extractApplicationIdentity(behaviorFor("select"), {
      batch_label: "17th",
      email: "member@example.test",
      full_name: "Test Member",
    });

    expect(identity.batchLabel).toBe("17th");
    expect(identity.email).toBe("member@example.test");
  });

  it("reads a single choice answer identically", () => {
    const identity = extractApplicationIdentity(behaviorFor("radio"), {
      batch_label: "17th",
      email: "member@example.test",
      full_name: "Test Member",
    });

    expect(identity.batchLabel).toBe("17th");
  });
});
