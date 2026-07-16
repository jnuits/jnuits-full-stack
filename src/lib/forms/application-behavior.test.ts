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

  it("rejects mappings to missing or wrong field types", () => {
    expect(() =>
      parseFormApplicationBehavior(
        "membership_application",
        { fieldMapping: { email: "student_id", fullName: "missing" } },
        definition
      )
    ).toThrow("fullName must map to a form field");

    expect(() =>
      parseFormApplicationBehavior(
        "membership_application",
        { fieldMapping: { email: "student_id", fullName: "full_name" } },
        definition
      )
    ).toThrow("email must map to an email field");
  });

  it("requires a canonical mapping for confirmation-based applications", () => {
    expect(() => parseFormApplicationBehavior("alumni_onboarding", {}, definition)).toThrow(
      "fieldMapping"
    );
  });
});
