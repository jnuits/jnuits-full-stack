import { createClient as createSdkClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => mocks.createClient() }));
import { hasPermission } from "@/lib/auth/session";

function boundary(replies: Array<{ status?: number; body?: unknown; error?: Error }>) {
  const calls: Array<{ method: string; permission: string }> = [];
  const client = createSdkClient("https://permission-fixture.invalid", "fixture-publishable", {
    accessToken: async () => "fixture-user",
    global: { fetch: async (_input, init) => {
      const body = JSON.parse(String(init?.body));
      calls.push({ method: init?.method || "", permission: body.requested_permission });
      const reply = replies[Math.min(calls.length - 1, replies.length - 1)];
      if (reply.error) throw reply.error;
      return new Response(JSON.stringify(reply.body), { status: reply.status ?? 200, headers: { "Content-Type": "application/json" } });
    } },
  });
  mocks.createClient.mockResolvedValue(client);
  return calls;
}

beforeEach(() => vi.clearAllMocks());
describe("authoritative permission read transport", () => {
  it.each([502, 503, 504])("recovers from one gateway %s without treating the failed response as a grant", async status => {
    const calls = boundary([{ status, body: { message: "Synthetic gateway failure" } }, { status: 200, body: true }]);
    await expect(hasPermission("admin.membership.manage")).resolves.toBe(true);
    expect(calls).toEqual([{ method: "POST", permission: "admin.membership.manage" }, { method: "POST", permission: "admin.membership.manage" }]);
  });
  it("bounds a persistent gateway failure at two attempts and denies", async () => {
    const calls = boundary([{ status: 502, body: { message: "Synthetic persistent gateway failure" } }]);
    await expect(hasPermission("admin.membership.manage")).resolves.toBe(false);
    expect(calls).toHaveLength(2);
  });
  it.each([400, 401, 403, 429, 500])("does not retry or authorize HTTP %s", async status => {
    const calls = boundary([{ status, body: { code: "FIXTURE_DENIAL", message: "Synthetic denial" } }]);
    await expect(hasPermission("admin.membership.manage")).resolves.toBe(false);
    expect(calls).toHaveLength(1);
  });
  it.each([new DOMException("Synthetic cancellation", "AbortError"), new TypeError("Synthetic fetch failed")])("denies cancelled/unavailable transports without retrying", async error => {
    const calls = boundary([{ error }]);
    await expect(hasPermission("admin.membership.manage")).resolves.toBe(false);
    expect(calls).toHaveLength(1);
  });
  it("does not retry an actual permission denial", async () => {
    const calls = boundary([{ status: 200, body: false }]);
    await expect(hasPermission("admin.membership.manage")).resolves.toBe(false);
    expect(calls).toHaveLength(1);
  });
  it.each(["false", { allowed: true }, null])("rejects malformed successful permission data %j", async body => {
    const calls = boundary([{ status: 200, body }]);
    await expect(hasPermission("admin.membership.manage")).resolves.toBe(false);
    expect(calls).toHaveLength(1);
  });
  it("keeps any-permission semantics and does not reuse a prior successful grant", async () => {
    const calls = boundary([{ status: 200, body: false }, { status: 200, body: true }, { status: 200, body: false }]);
    await expect(hasPermission(["admin.membership.manage", "admin.audit.read"])).resolves.toBe(true);
    await expect(hasPermission("admin.audit.read")).resolves.toBe(false);
    expect(calls.map(call => call.permission)).toEqual(["admin.membership.manage", "admin.audit.read", "admin.audit.read"]);
  });
});
