import { describe, expect, it } from "vitest";

import {
  extractApplicationIdentity,
  parseFormApplicationBehavior,
} from "@/lib/forms/application-behavior";
import { parseFormDefinition, validateFormAnswers } from "@/lib/forms/definition";

const definition = parseFormDefinition({
  fields: [
    { id: "full_name", label: "Full name", required: true, type: "text" },
    { id: "email", label: "Email", required: true, type: "email" },
    { id: "student_id", label: "Student ID", required: false, type: "text" },
  ],
  payment: { enabled: false },
});

describe("form application behavior", () => {
  it("maps a membership form to canonical review fields", () => {
    const behavior = parseFormApplicationBehavior(
      "membership_application",
      { fieldMapping: { email: "email", fullName: "full_name", studentId: "student_id" } },
      definition
    );
    const answers = validateFormAnswers(definition, {
      email: "Applicant@Example.Test",
      full_name: "Applicant Name",
      student_id: "20201234",
    });

    expect(extractApplicationIdentity(behavior, answers)).toEqual({
      email: "applicant@example.test",
      fullName: "Applicant Name",
      studentId: "20201234",
    });
  });

  it("maps an event form to canonical registration identity fields", () => {
    const behavior = parseFormApplicationBehavior(
      "event_registration",
      { fieldMapping: { email: "email", fullName: "full_name" } },
      definition
    );
    const answers = validateFormAnswers(definition, {
      email: "Attendee@Example.Test",
      full_name: "Event Attendee",
    });

    expect(extractApplicationIdentity(behavior, answers)).toEqual({
      email: "attendee@example.test",
      fullName: "Event Attendee",
    });
  });

  // One defect per fixture. These previously shared a fixture that supplied a
  // bad email AND a missing fullName; assertFieldMapping validates email
  // first, so the fullName assertion could never have been reached whatever it
  // asserted.
  //
  // The fragments matter, not the full sentences. This is operator-facing copy
  // and will be reworded; what must survive rewording is that the error names
  // the Application details label and the offending question rather than the
  // internal camelCase key.
  it("rejects a mapping to a question that does not exist", () => {
    expect(() =>
      parseFormApplicationBehavior(
        "membership_application",
        { fieldMapping: { email: "email", fullName: "missing" } },
        definition
      )
    ).toThrow(/Full name is mapped to a question that no longer exists/);
  });

  it("rejects an email mapped to a non-email question, naming that question", () => {
    // Only the `email` field type is run through z.string().email() and
    // lowercased by validateFormAnswers, and the address backs confirmation
    // tokens and deduplication. A text question would let an unvalidated
    // string become the applicant's identity.
    expect(() =>
      parseFormApplicationBehavior(
        "membership_application",
        { fieldMapping: { email: "student_id", fullName: "full_name" } },
        definition
      )
    ).toThrow(/Email address must map to an email question/);

    expect(() =>
      parseFormApplicationBehavior(
        "membership_application",
        { fieldMapping: { email: "student_id", fullName: "full_name" } },
        definition
      )
    ).toThrow(/"Student ID" is a text question/);
  });

  it("requires a canonical mapping for confirmation-based applications", () => {
    expect(() => parseFormApplicationBehavior("alumni_onboarding", {}, definition)).toThrow(
      "fieldMapping"
    );
  });
});
