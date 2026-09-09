import { describe, expect, it } from "vitest";

import { normalizeRoleVersionClaim } from "./role-version";

describe("normalizeRoleVersionClaim", () => {
  it("accepts numeric JWT and database values", () => {
    expect(normalizeRoleVersionClaim(7)).toBe(7);
    expect(normalizeRoleVersionClaim("7")).toBe(7);
  });

  it("rejects empty, non-numeric, fractional, and negative values", () => {
    expect(normalizeRoleVersionClaim(null)).toBeNull();
    expect(normalizeRoleVersionClaim("")).toBeNull();
    expect(normalizeRoleVersionClaim("7x")).toBeNull();
    expect(normalizeRoleVersionClaim(1.5)).toBeNull();
    expect(normalizeRoleVersionClaim(-1)).toBeNull();
  });
});
