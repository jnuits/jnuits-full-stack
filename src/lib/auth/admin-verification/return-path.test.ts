import { describe, expect, it } from "vitest";
import { safeAdminVerificationReturnPath } from "./return-path";
describe("verification return paths", () => {
  it("keeps only known operator destinations and their local draft context", () => {
    expect(safeAdminVerificationReturnPath("/admin/membership?renewalQueue=alumni#membership-renewals")).toBe("/admin/membership?renewalQueue=alumni#membership-renewals");
    for (const invalid of ["//evil.example", "https://evil.example/admin/membership", "/\\evil.example", "/admin/unknown", "/admin/mfa/setup", "/admin/membership\n", undefined, ["/admin/membership"]]) {
      expect(safeAdminVerificationReturnPath(invalid)).toBe("/admin/dashboard");
    }
  });
});
