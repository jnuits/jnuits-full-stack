import { describe, expect, it } from "vitest";
import { adminOperationRegistry, parseAdminOperationIntent } from "./operations";

const id = "11111111-1111-4111-8111-111111111111";
describe("admin operation validation and classification", () => {
  it("rejects unknown operation and browser actor/recipient overrides", () => {
    expect(parseAdminOperationIntent({ operation: "unknown", payload: {} }).ok).toBe(false);
    expect(parseAdminOperationIntent({ operation: "admin.security.read", payload: {}, actorId: id }).ok).toBe(false);
    expect(parseAdminOperationIntent({ operation: "admin.security.read", payload: { recipient: "attacker@example.com" } }).ok).toBe(false);
  });
  it("separates routine reviews from verified payment confirmation and admin roles", () => {
    expect(adminOperationRegistry["membership.request.review"]).toMatchObject({ kind: "routine", permission: "admin.membership.manage" });
    expect(adminOperationRegistry["membership.renewal.confirm"].kind).toBe("protected_mutation");
    expect(adminOperationRegistry["admin.role.invite"].kind).toBe("admin_role");
    expect(adminOperationRegistry["admin.role.remove"].kind).toBe("admin_role");
    expect(adminOperationRegistry["admin.lifecycle.freeze"].kind).toBe("protected_mutation");
  });
  it("retains the required review confirmation and bounded note", () => {
    const payload = { requestId: id, expectedUpdatedAt: "2026-10-02T00:00:00.000Z", decision: "approved", note: "Valid claim", confirmation: "CONFIRM" };
    expect(parseAdminOperationIntent({ operation: "membership.request.review", payload })).toMatchObject({ ok: true, value: { payload } });
    expect(parseAdminOperationIntent({ operation: "membership.request.review", payload: { ...payload, note: "x".repeat(501) } }).ok).toBe(false);
    expect(parseAdminOperationIntent({ operation: "membership.request.review", payload: { ...payload, confirmation: "" } }).ok).toBe(false);
  });
  it("binds role changes to the exact target, chosen role and existing confirmation", () => {
    expect(parseAdminOperationIntent({ operation: "admin.role.change", payload: { adminProfileId: id, roleCode: "content_admin", confirmation: "ADMIN-CODE" } }).ok).toBe(true);
    expect(parseAdminOperationIntent({ operation: "admin.role.change", payload: { adminProfileId: id, roleCode: "member", confirmation: "ADMIN-CODE" } }).ok).toBe(false);
  });
  it("normalizes admin-invite email while preserving member-invite support", () => {
    expect(parseAdminOperationIntent({ operation: "admin.role.invite", payload: { inviteMode: "email", email: "Operator@Example.com", roleCode: "admin" } })).toMatchObject({ ok: true, value: { payload: { email: "operator@example.com" } } });
    expect(parseAdminOperationIntent({ operation: "admin.role.invite", payload: { inviteMode: "member", memberId: id, roleCode: "admin" } }).ok).toBe(true);
    expect(parseAdminOperationIntent({ operation: "admin.role.invite", payload: { inviteMode: "email", email: "not-email", roleCode: "admin" } }).ok).toBe(false);
  });
  it("does not accept read scopes as write authorization or drop purge confirmation", () => {
    expect(parseAdminOperationIntent({ operation: "admin.retention.read", payload: { jobId: id } }).ok).toBe(false);
    expect(parseAdminOperationIntent({ operation: "admin.retention.purge", payload: { jobId: id, scope: "form" } }).ok).toBe(false);
    expect(parseAdminOperationIntent({ operation: "admin.retention.purge", payload: { jobId: id, scope: "form", confirmation: "PURGE" } }).ok).toBe(true);
  });
});
