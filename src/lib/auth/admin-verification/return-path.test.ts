import { describe, expect, it } from "vitest";
import { adminMfaRedirectPath, safeAdminVerificationReturnPath } from "./return-path";
describe("verification return paths", () => {
  it("carries the original permitted destination through both native MFA steps", () => {
    expect(adminMfaRedirectPath("/admin/mfa/challenge", "/admin/membership?queue=alumni")).toBe("/admin/mfa/challenge?next=%2Fadmin%2Fmembership%3Fqueue%3Dalumni");
    expect(adminMfaRedirectPath("/admin/mfa/setup", "/admin/settings/security")).toBe("/admin/mfa/setup?next=%2Fadmin%2Fsettings%2Fsecurity");
    expect(adminMfaRedirectPath("/admin/mfa/setup", "https://evil.example")).toBe("/admin/mfa/setup?next=%2Fadmin%2Fdashboard");
    expect(adminMfaRedirectPath("/admin/mfa/setup", "/admin/mfa/challenge")).toBe("/admin/mfa/setup?next=%2Fadmin%2Fdashboard");
  });
  it("keeps only known operator destinations and their local draft context", () => {
    expect(safeAdminVerificationReturnPath("/admin/membership?renewalQueue=alumni#membership-renewals")).toBe("/admin/membership?renewalQueue=alumni#membership-renewals");
    for (const invalid of ["//evil.example", "https://evil.example/admin/membership", "/\\evil.example", "/admin/unknown", "/admin/mfa/setup", "/admin/membership\n", undefined, ["/admin/membership"]]) {
      expect(safeAdminVerificationReturnPath(invalid)).toBe("/admin/dashboard");
    }
  });
});
