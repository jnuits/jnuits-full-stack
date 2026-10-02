import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmailCodeMac, parseProofToken } from "./tokens";
import type { AdminOperationIntent, AdminVerificationActor, PreparedIntent } from "./types";
const mocks = vi.hoisted(() => ({ actor: vi.fn(), prepare: vi.fn(), beginEmail: vi.fn(), markEmailDelivery: vi.fn(), loadEmailChallenge: vi.fn(), redeemEmail: vi.fn(), sendEmail: vi.fn() }));
vi.mock("./actor", () => ({ loadAdminVerificationActor: mocks.actor }));
vi.mock("./store", () => ({ AdminVerificationStore: class { prepare = mocks.prepare; beginEmail = mocks.beginEmail; markEmailDelivery = mocks.markEmailDelivery; loadEmailChallenge = mocks.loadEmailChallenge; redeemEmail = mocks.redeemEmail; } }));
vi.mock("@/lib/notifications/send-email", () => ({ sendEmail: mocks.sendEmail }));
import { prepareAdminVerification, requestAdminEmailVerification, verifyAdminEmailCode } from "./email";

const actor: AdminVerificationActor = { userId: "11111111-1111-4111-8111-111111111111", sessionId: "22222222-2222-4222-8222-222222222222", email: "operator@example.test", emailConfirmed: true, roleVersion: 1, currentLevel: "aal1", enforced: false, enrollment: "never" };
const intent: AdminOperationIntent = { operation: "admin.security.read", payload: {} };
const id = "33333333-3333-4333-8333-333333333333";
const prepared: PreparedIntent = { id, actor, intent, targetRef: intent.operation, payloadDigest: "a".repeat(64), policyRevision: "fixture-revision" };
const expiresAt = "2026-10-02T23:05:00Z";
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("APP_MAC_SECRET", "fixture-current-key"); vi.stubEnv("SUPABASE_SECRET_KEY", "fixture-previous-key"); vi.stubEnv("RATE_LIMIT_SECRET_SALT", "fixture-ip-salt");
  mocks.actor.mockResolvedValue({ ok: true, value: actor });
  mocks.prepare.mockImplementation(async (a, i) => ({ ok: true, value: { ...prepared, actor: a, intent: i } }));
  mocks.beginEmail.mockImplementation(async (_p, input) => ({ ok: true, value: { challengeId: input.challengeId, expiresAt } }));
  mocks.markEmailDelivery.mockResolvedValue(undefined);
  mocks.sendEmail.mockResolvedValue({ success: true });
  mocks.loadEmailChallenge.mockResolvedValue({ ok: true, value: prepared });
  mocks.redeemEmail.mockResolvedValue({ ok: true, value: { proofId: id, expiresAt } });
});
afterEach(() => { vi.unstubAllEnvs(); });
describe("scoped admin email verification", () => {
  it("prepares only a permission-checked intent and does not issue a proof", async () => {
    expect(await prepareAdminVerification(intent)).toEqual({ ok: true, value: { decision: { status: "required", methods: ["totp", "email"] } } });
    expect(mocks.prepare).toHaveBeenCalledWith(actor, intent);
    expect(mocks.beginEmail).not.toHaveBeenCalled();
    mocks.prepare.mockResolvedValue({ ok: false, code: "permission_denied" });
    expect(await prepareAdminVerification(intent)).toEqual({ ok: false, code: "permission_denied" });
  });
  it("uses a six-digit random code, a confirmed server recipient and MAC-only persistence", async () => {
    const result = await requestAdminEmailVerification(intent, "192.0.2.10");
    expect(result.ok).toBe(true);
    const options = mocks.sendEmail.mock.calls[0][0];
    const code = /<code[^>]*>(\d{6})<\/code>/.exec(options.html)?.[1];
    expect(code).toMatch(/^\d{6}$/);
    expect(options).toMatchObject({ to: actor.email, subject: "Verify your JnUITS admin action", redactProviderErrors: true });
    expect(options.subject).not.toContain(code);
    const input = mocks.beginEmail.mock.calls[0][1];
    expect(input.codeMac).toBe(createEmailCodeMac(prepared, input.challengeId, code!, "fixture-current-key"));
    expect(JSON.stringify(input)).not.toContain(code);
    expect(input.ipHash).toMatch(/^[a-f0-9]{64}$/);
    expect(mocks.sendEmail.mock.invocationCallOrder[0]).toBeLessThan(mocks.markEmailDelivery.mock.invocationCallOrder[0]);
  });
  it("delivery failure leaves no usable challenge or provider error in the response", async () => {
    mocks.sendEmail.mockResolvedValue({ success: false, error: "provider response body" });
    expect(await requestAdminEmailVerification(intent, "192.0.2.10")).toEqual({ ok: false, code: "delivery_failed" });
    expect(mocks.markEmailDelivery).toHaveBeenCalledWith(expect.any(String), false);
    mocks.loadEmailChallenge.mockResolvedValue({ ok: false, code: "delivery_failed" });
    expect(await verifyAdminEmailCode(id, "123456", "192.0.2.10")).toEqual({ ok: false, code: "delivery_failed" });
    expect(mocks.redeemEmail).not.toHaveBeenCalled();
  });
  it.each(["admin.role.change", "admin.role.invite", "admin.role.remove"])("never offers email for %s", async operation => {
    const roleIntent = operation === "admin.role.invite" ? { operation, payload: { email: "invited@example.test", roleCode: "admin" } } : { operation, payload: { adminProfileId: id, confirmation: "fixture", ...(operation === "admin.role.change" ? { roleCode: "admin" } : {}) } };
    expect((await requestAdminEmailVerification(roleIntent as AdminOperationIntent, "192.0.2.10")).ok).toBe(false);
    expect(mocks.beginEmail).not.toHaveBeenCalled(); expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
  it.each([{ enforced: true }, { enrollment: "enrolled" }, { enrollment: "unknown" }, { emailConfirmed: false }])("denies ineligible actor %j", async changes => {
    mocks.actor.mockResolvedValue({ ok: true, value: { ...actor, ...changes } });
    expect((await requestAdminEmailVerification(intent, "192.0.2.10")).ok).toBe(false);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
  it("supports key rotation without persisting the code or random proof secret", async () => {
    const result = await verifyAdminEmailCode(id, "123456", "192.0.2.10");
    expect(result.ok).toBe(true);
    const input = mocks.redeemEmail.mock.calls[0][1];
    expect(input.candidateMacs).toEqual(["fixture-current-key", "fixture-previous-key"].map(key => createEmailCodeMac(prepared, id, "123456", key)));
    expect(JSON.stringify(input)).not.toContain("123456");
    if (result.ok) expect(parseProofToken(result.value.token)).toEqual({ proofId: id, tokenHash: input.tokenHash });
  });
  it.each(["rate_limited", "verification_expired", "verification_invalid", "permission_denied", "code_invalid"])("preserves durable denial %s without local fallback", async code => {
    mocks.redeemEmail.mockResolvedValue({ ok: false, code });
    expect(await verifyAdminEmailCode(id, "123456", "192.0.2.10")).toEqual({ ok: false, code });
  });
  it("never sends when durable issuance or IP hashing is unavailable", async () => {
    mocks.beginEmail.mockResolvedValue({ ok: false, code: "rate_limited" });
    expect(await requestAdminEmailVerification(intent, "192.0.2.10")).toEqual({ ok: false, code: "rate_limited" });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    vi.stubEnv("RATE_LIMIT_SECRET_SALT", "");
    expect(await requestAdminEmailVerification(intent, "192.0.2.10")).toEqual({ ok: false, code: "verification_unavailable" });
  });
  it("rejects malformed code/intent and failed delivery recording without secrets", async () => {
    expect((await verifyAdminEmailCode(id, "not-a-code", "192.0.2.10")).ok).toBe(false);
    expect(mocks.loadEmailChallenge).not.toHaveBeenCalled();
    mocks.markEmailDelivery.mockRejectedValue(new Error("private provider data"));
    expect(await requestAdminEmailVerification(intent, "192.0.2.10")).toEqual({ ok: false, code: "verification_unavailable" });
  });
});
