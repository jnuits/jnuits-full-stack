import { describe, expect, it } from "vitest";

import {
  FORM_CONFIRMATION_TTL_MS,
  createFormConfirmation,
  hashFormConfirmationToken,
  isFormConfirmationExpired,
} from "@/lib/forms/confirmation";

describe("form confirmation tokens", () => {
  it("returns an opaque token and stores only its deterministic hash", () => {
    const confirmation = createFormConfirmation(new Date("2026-07-16T00:00:00.000Z"));

    expect(confirmation.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(confirmation.tokenHash).toBe(hashFormConfirmationToken(confirmation.token));
    expect(confirmation.expiresAt.toISOString()).toBe("2026-07-17T00:00:00.000Z");
  });

  it("does not accept malformed confirmation tokens", () => {
    expect(() => hashFormConfirmationToken("short")).toThrow("Invalid form confirmation token.");
    expect(() => hashFormConfirmationToken("a".repeat(44))).toThrow("Invalid form confirmation token.");
  });

  it("expires confirmations exactly at the configured deadline", () => {
    const issuedAt = new Date("2026-07-16T00:00:00.000Z");
    const expiresAt = new Date(issuedAt.getTime() + FORM_CONFIRMATION_TTL_MS);

    expect(isFormConfirmationExpired(expiresAt, new Date("2026-07-16T23:59:59.999Z"))).toBe(false);
    expect(isFormConfirmationExpired(expiresAt, expiresAt)).toBe(true);
  });
});
