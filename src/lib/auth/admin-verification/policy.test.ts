import { describe, expect, it } from "vitest";
import { evaluateAdminVerification } from "./policy";
import type { AdminVerificationActor, VerificationClass } from "./types";

const actor: AdminVerificationActor = {
  userId: "11111111-1111-4111-8111-111111111111", sessionId: "22222222-2222-4222-8222-222222222222",
  email: "operator@example.com", emailConfirmed: true, roleVersion: 1, currentLevel: "aal1", enforced: false, enrollment: "never",
};

describe("explicit admin verification policy", () => {
  it("allows routine off-policy reviews without an additional challenge", () => {
    expect(evaluateAdminVerification(actor, "routine")).toEqual({ status: "allowed" });
  });
  it.each(["protected_read", "protected_mutation"] as const)("offers email only to never-enrolled off-policy operators for %s", (kind) => {
    expect(evaluateAdminVerification(actor, kind)).toEqual({ status: "required", methods: ["totp", "email"] });
  });
  it.each(["enrolled", "unknown"] as const)("does not downgrade %s history to email", (enrollment) => {
    expect(evaluateAdminVerification({ ...actor, enrollment }, "protected_mutation")).toEqual({ status: "required", methods: ["totp"] });
  });
  it("does not offer email without a confirmed recipient", () => {
    expect(evaluateAdminVerification({ ...actor, emailConfirmed: false }, "protected_read")).toEqual({ status: "required", methods: ["totp"] });
  });
  it.each(["routine", "protected_read", "protected_mutation", "admin_role"] as const)("never offers email when mandatory MFA is on for %s", (kind) => {
    expect(evaluateAdminVerification({ ...actor, enforced: true }, kind)).toEqual({ status: "required", methods: ["totp"] });
  });
  it.each([false, true])("requires password after actual MFA for admin roles (mandatory %s)", (enforced) => {
    expect(evaluateAdminVerification({ ...actor, enforced, currentLevel: "aal2", enrollment: "enrolled" }, "admin_role")).toEqual({ status: "required", methods: ["password"] });
  });
  it("requires authenticator setup before password verification for an AAL1 role operation", () => {
    expect(evaluateAdminVerification(actor, "admin_role")).toEqual({ status: "required", methods: ["totp"] });
  });
  it.each(["routine", "protected_read", "protected_mutation"] as const)("allows genuinely verified MFA for %s regardless of enforcement", (kind) => {
    expect(evaluateAdminVerification({ ...actor, currentLevel: "aal2", enrollment: "enrolled" }, kind)).toEqual({ status: "allowed" });
  });
  it("rejects unknown action classes instead of using a permissive default", () => {
    expect(evaluateAdminVerification(actor, "unknown" as VerificationClass).status).toBe("denied");
  });
});
