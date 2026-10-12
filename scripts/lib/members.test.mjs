import { describe, expect, it } from "vitest";
import { normalizeMemberRow, normalizeProfessionalVisibility } from "./members.mjs";
describe("member creation visibility", () => {
  it("defaults a missing visibility to public", () => {
    expect(normalizeProfessionalVisibility(undefined)).toBe("public");
    expect(normalizeProfessionalVisibility("")).toBe("public");
  });
  it("distinguishes omitted import visibility from an explicit choice", () => {
    expect(normalizeMemberRow({}).professionalVisibilityProvided).toBe(false);
    expect(normalizeMemberRow({ professionalVisibility: "private" }).professionalVisibilityProvided).toBe(true);
  });
  it("honors explicit restrictions and fails closed for invalid input", () => {
    expect(normalizeProfessionalVisibility("private")).toBe("private");
    expect(normalizeProfessionalVisibility("members-only")).toBe("members-only");
    expect(normalizeProfessionalVisibility("invalid")).toBe("members-only");
  });
});
