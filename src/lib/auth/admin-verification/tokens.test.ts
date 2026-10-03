import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createProofSecret, parseProofToken, createEmailCodeMac, hashVerificationIp } from "./tokens";
import type { PreparedIntent } from "./types";

const binding: PreparedIntent = {
  id: "33333333-3333-4333-8333-333333333333", targetRef: "security", payloadDigest: "d".repeat(64), policyRevision: "2026-10-02T00:00:00Z",
  actor: { userId: "11111111-1111-4111-8111-111111111111", sessionId: "22222222-2222-4222-8222-222222222222", email: "operator@example.com", emailConfirmed: true, roleVersion: 1, enforced: false, currentLevel: "aal1", enrollment: "never" },
  intent: { operation: "admin.security.read", payload: {} },
};
afterEach(() => vi.unstubAllEnvs());
describe("verification secret binding", () => {
  it("generates unguessable independent secrets and stores only a SHA256 digest", () => {
    const first = createProofSecret(); const second = createProofSecret();
    expect(first.secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.secret).not.toBe(second.secret);
    expect(first.hash).toBe(createHash("sha256").update(first.secret).digest("hex"));
    expect(parseProofToken(`${binding.id}.${first.secret}`)).toEqual({ proofId: binding.id, tokenHash: first.hash });
    expect(parseProofToken(`${binding.id}.${first.secret}.extra`)).toBeNull();
  });
  it("rejects malformed or truncated proof tokens", () => {
    expect(parseProofToken("not-a-uuid.secret")).toBeNull();
    expect(parseProofToken(`${binding.id}.short`)).toBeNull();
  });
  it("binds a code to the challenge, actor, session, operation and digest", () => {
    const mac = createEmailCodeMac(binding, binding.id, "012345", "test-only-key");
    expect(mac).toMatch(/^[a-f0-9]{64}$/);
    expect(createEmailCodeMac(binding, binding.id, "112345", "test-only-key")).not.toBe(mac);
    expect(createEmailCodeMac({ ...binding, payloadDigest: "e".repeat(64) }, binding.id, "012345", "test-only-key")).not.toBe(mac);
    expect(createEmailCodeMac({ ...binding, actor: { ...binding.actor, sessionId: binding.id } }, binding.id, "012345", "test-only-key")).not.toBe(mac);
    expect(createEmailCodeMac(binding, binding.actor.userId, "012345", "test-only-key")).not.toBe(mac);
  });
  it("does not persist raw IP identifiers and fails closed without a salt", () => {
    vi.stubEnv("RATE_LIMIT_SECRET_SALT", "test-only-salt");
    expect(hashVerificationIp("192.0.2.1")).toMatch(/^[a-f0-9]{64}$/);
    expect(hashVerificationIp("192.0.2.1")).not.toBe(hashVerificationIp("192.0.2.2"));
    vi.stubEnv("RATE_LIMIT_SECRET_SALT", "");
    expect(() => hashVerificationIp("192.0.2.1")).toThrow();
  });
});
