import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminVerificationActor } from "./types";

const mocks = vi.hoisted(() => ({ actor: vi.fn(), auth: vi.fn(), permission: vi.fn(), rpc: vi.fn() }));
vi.mock("./actor", async original => ({ ...await original<object>(), loadAdminVerificationActor: mocks.actor }));
vi.mock("@/lib/auth/session", () => ({ getAuthContext: mocks.auth, hasPermission: mocks.permission }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }));
import * as guard from "./guard";

const actor: AdminVerificationActor = { userId: "11111111-1111-4111-8111-111111111111", sessionId: "22222222-2222-4222-8222-222222222222", email: "operator@example.com", emailConfirmed: true, roleVersion: 1, currentLevel: "aal1", enforced: false, enrollment: "never" };
const review = { operation: "membership.request.review" as const, payload: { requestId: "33333333-3333-4333-8333-333333333333", expectedUpdatedAt: "2026-10-01T00:00:00Z", decision: "approved", note: "Reviewed.", confirmation: "CONFIRM" } };
const renewal = { operation: "membership.renewal.confirm" as const, payload: { memberId: "33333333-3333-4333-8333-333333333333", expectedDueOn: "2026-07-01", resolution: "paid", reference: "", note: "Reviewed.", confirmation: "CONFIRM" } };
const role = { operation: "admin.role.change" as const, payload: { adminProfileId: "33333333-3333-4333-8333-333333333333", roleCode: "content_admin", confirmation: "JNUITS-ADMIN-FIXTURE" } };
const proof = "44444444-4444-4444-8444-444444444444." + "x".repeat(43);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.actor.mockResolvedValue({ ok: true, value: actor });
  mocks.auth.mockResolvedValue({ user: { id: actor.userId }, roles: ["admin"] });
  mocks.permission.mockResolvedValue(true);
  mocks.rpc.mockImplementation(async (name, args) => name === "admin_verification_prepare"
    ? { error: null, data: { ok: true, value: { id: "55555555-5555-4555-8555-555555555555", actor, intent: args.p_input.intent, targetRef: "fixture", payloadDigest: "a".repeat(64), policyRevision: "fixture" } } }
    : { error: null, data: { ok: true, value: null } });
});

describe("operation authorization preflight", () => {
  it("allows routine AAL1 review when enforcement is off", async () => {
    expect(await guard.authorizeAdminOperation(review)).toMatchObject({ ok: true });
  });
  it("requires MFA for routine AAL1 review under mandatory enforcement", async () => {
    mocks.actor.mockResolvedValue({ ok: true, value: { ...actor, enforced: true } });
    expect(await guard.authorizeAdminOperation(review)).toEqual({ ok: false, code: "verification_required" });
  });
  it("denies a protected renewal without proof", async () => {
    expect(await guard.authorizeAdminOperation(renewal)).toEqual({ ok: false, code: "verification_required" });
  });
  it("cannot use email or profile-cookie syntax for an admin-role change", async () => {
    expect(await guard.authorizeAdminOperation(role, proof)).toEqual({ ok: false, code: "verification_required" });
    mocks.actor.mockResolvedValue({ ok: true, value: { ...actor, currentLevel: "aal2", enrollment: "enrolled" } });
    expect(await guard.authorizeAdminOperation(role, "profile-cookie")).toEqual({ ok: false, code: "verification_invalid" });
    expect(await guard.authorizeAdminOperation(role)).toEqual({ ok: false, code: "verification_required" });
  });
  it("checks exact mutation proof without reserving or consuming it", async () => {
    expect(await guard.authorizeAdminOperation(renewal, proof)).toMatchObject({ ok: true });
    expect(mocks.rpc).toHaveBeenCalledWith("admin_verification_check_write", { p_input: { actor, intent: renewal, proofId: "44444444-4444-4444-8444-444444444444", tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/) } });
    expect(mocks.rpc.mock.calls.some(([name]) => name === "admin_verification_reserve")).toBe(false);
  });
  it("uses read scope only for named protected reads", async () => {
    expect(await guard.authorizeAdminOperation({ operation: "admin.retention.read", payload: {} }, proof)).toMatchObject({ ok: true });
    expect(mocks.rpc.mock.calls.some(([name]) => name === "admin_verification_check_read")).toBe(true);
  });
  it.each(["permission_denied", "session_invalid", "role_version_stale", "verification_unavailable"])("preserves fresh actor denial %s", async code => {
    mocks.actor.mockResolvedValue({ ok: false, code });
    expect(await guard.authorizeAdminOperation(review)).toEqual({ ok: false, code });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("denies a user/permission mismatch before preparing an intent", async () => {
    mocks.permission.mockResolvedValue(false);
    expect(await guard.authorizeAdminOperation(review)).toEqual({ ok: false, code: "permission_denied" });
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.permission.mockResolvedValue(true);
    mocks.auth.mockResolvedValue({ user: { id: "other-user" }, roles: ["admin"] });
    expect(await guard.authorizeAdminOperation(review)).toEqual({ ok: false, code: "session_invalid" });
  });
  it("denies stale/reused proof from the durable boundary", async () => {
    mocks.rpc.mockResolvedValue({ error: null, data: { ok: false, code: "verification_invalid" } });
    expect(await guard.authorizeAdminOperation(renewal, proof)).toEqual({ ok: false, code: "verification_invalid" });
  });
});
