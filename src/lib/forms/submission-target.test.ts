import { describe, expect, it } from "vitest";

import { resolvePublicFormSubmissionTarget } from "@/lib/forms/submission-target";

describe("public form submission target", () => {
  it("routes a linked event form through its capacity-safe event endpoint", () => {
    expect(
      resolvePublicFormSubmissionTarget({
        kind: "event_registration",
        linkedEventId: "00000000-0000-4000-8000-000000000001",
        slug: "summit-registration",
      })
    ).toEqual({
      confirmationRequired: false,
      endpoint: "/api/events/00000000-0000-4000-8000-000000000001/register",
    });
  });

  it("keeps membership forms on the email-confirmed form endpoint", () => {
    expect(
      resolvePublicFormSubmissionTarget({
        kind: "membership_application",
        linkedEventId: null,
        slug: "membership-application",
      })
    ).toEqual({
      confirmationRequired: true,
      endpoint: "/api/forms/membership-application/submit",
    });
  });
});
