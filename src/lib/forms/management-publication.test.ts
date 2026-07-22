import { describe, expect, it } from "vitest";

import * as management from "./management";

type PublicationContext = {
  event: null | { registrationMode: string; status: string };
  kind: "alumni_onboarding" | "event_registration" | "membership_application";
  linkedEventId: null | string;
};

type CompatibilityCheck = (context: PublicationContext) => null | string;

function compatibilityCheck() {
  return (management as typeof management & {
    getFormPublicationCompatibilityError?: CompatibilityCheck;
  }).getFormPublicationCompatibilityError;
}

describe("form publication compatibility", () => {
  it("allows non-event forms without a linked event", () => {
    const check = compatibilityCheck();
    expect(check).toBeTypeOf("function");
    expect(check?.({ event: null, kind: "membership_application", linkedEventId: null })).toBeNull();
  });

  it("requires event forms to identify an existing linked event", () => {
    const check = compatibilityCheck();
    expect(check).toBeTypeOf("function");
    expect(check?.({ event: null, kind: "event_registration", linkedEventId: null })).toBe(
      "Link this form to an event before publishing."
    );
    expect(check?.({
      event: null,
      kind: "event_registration",
      linkedEventId: "11111111-1111-4111-8111-111111111111",
    })).toBe("The linked event no longer exists.");
  });

  it("requires internal registration and a non-archived event", () => {
    const check = compatibilityCheck();
    const linkedEventId = "11111111-1111-4111-8111-111111111111";
    expect(check).toBeTypeOf("function");
    expect(check?.({
      event: { registrationMode: "external", status: "published" },
      kind: "event_registration",
      linkedEventId,
    })).toBe("The linked event must use internal registration.");
    expect(check?.({
      event: { registrationMode: "internal", status: "archived" },
      kind: "event_registration",
      linkedEventId,
    })).toBe("Archived events cannot accept a published registration form.");
  });

  it("allows draft and published internal events", () => {
    const check = compatibilityCheck();
    const linkedEventId = "11111111-1111-4111-8111-111111111111";
    expect(check).toBeTypeOf("function");
    expect(check?.({
      event: { registrationMode: "internal", status: "draft" },
      kind: "event_registration",
      linkedEventId,
    })).toBeNull();
    expect(check?.({
      event: { registrationMode: "internal", status: "published" },
      kind: "event_registration",
      linkedEventId,
    })).toBeNull();
  });
});
