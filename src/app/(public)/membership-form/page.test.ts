import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("Membership Form Page (F2)", () => {
  it("retires email-only status lookup form, inputs, and state", () => {
    const source = readFileSync(
      fileURLToPath(new URL("./page.tsx", import.meta.url)),
      "utf8"
    );

    // Legacy status check UI, state, and fetch must NOT be present
    expect(source).not.toContain("handleStatusCheck");
    expect(source).not.toContain("/api/membership-form/status");
    expect(source).not.toContain("status-check-form");
    expect(source).not.toContain("Check application status");
    expect(source).not.toContain("MembershipStatus");

    // Intake discovery, invitation registration, and support contact must remain
    expect(source).toContain("/api/forms/intake/membership");
    expect(source).toContain("/register");
    expect(source).toContain("membershipContactHref");
  });
});
