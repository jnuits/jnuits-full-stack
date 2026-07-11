import { describe, expect, it } from "vitest";
import { getSafeAuthErrorMessage } from "@/lib/auth/safe-auth-error";

describe("getSafeAuthErrorMessage", () => {
  it("maps known authentication failures to safe user-facing copy", () => {
    expect(
      getSafeAuthErrorMessage(
        new Error("Invalid login credentials"),
        "Unable to sign in. Try again."
      )
    ).toBe("Invalid email or password.");
    expect(
      getSafeAuthErrorMessage(
        new Error("captcha_token is missing"),
        "Unable to sign in. Try again."
      )
    ).toBe("Complete the verification challenge and try again.");
  });

  it("does not expose unexpected provider errors", () => {
    expect(
      getSafeAuthErrorMessage(
        new Error("upstream host internal diagnostic"),
        "Unable to sign in. Try again."
      )
    ).toBe("Unable to sign in. Try again.");
  });
});