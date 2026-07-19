import { describe, expect, it } from "vitest";

import { getEventRegistrationSuccessContent } from "./event-registration-result";

describe("event registration success content", () => {
  it("distinguishes confirmed registration from a waitlist place", () => {
    expect(getEventRegistrationSuccessContent(false)).toEqual({
      heading: "Registration complete",
      message:
        "Your registration is complete. Check your email for your check-in code.",
    });
    expect(getEventRegistrationSuccessContent(true)).toEqual({
      heading: "You are on the waitlist",
      message:
        "A place is not confirmed yet. Check your email for your waitlist code and next steps.",
    });
  });
});
