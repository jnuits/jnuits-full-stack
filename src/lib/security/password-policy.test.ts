import { describe, expect, it } from "vitest";
import {
  getPasswordPolicyError,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from "@/lib/security/password-policy";

describe("local password policy", () => {
  it("requires the documented minimum length", () => {
    expect(getPasswordPolicyError("short-pass")).toBe(
      `Use at least ${MIN_PASSWORD_LENGTH} characters.`
    );
  });

  it("rejects predictable and repeated passwords", () => {
    expect(getPasswordPolicyError("password1234")).toBe(
      "Choose a password that is not commonly used."
    );
    expect(getPasswordPolicyError("aaaaaaaaaaaa")).toBe(
      "Choose a password with more than one repeated character."
    );
  });

  it("rejects passwords based on the account email", () => {
    expect(
      getPasswordPolicyError("member@example.com-2026", {
        email: "member@example.com",
      })
    ).toBe("Do not include your email name in the password.");
  });

  it("accepts a long unique passphrase and bounds maximum length", () => {
    expect(getPasswordPolicyError("River-telescope-pine-2026!")).toBeNull();
    expect(getPasswordPolicyError("a".repeat(MAX_PASSWORD_LENGTH + 1))).toBe(
      `Use no more than ${MAX_PASSWORD_LENGTH} characters.`
    );
  });
});