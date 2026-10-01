import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ identity: vi.fn(), snapshot: vi.fn(), rpc: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requirePortalIdentity: mocks.identity }));
vi.mock("@/lib/portal/member", () => ({ getPortalMemberSnapshot: mocks.snapshot }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: mocks.rpc }) }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.refresh }));
import { requestMembershipAction } from "./actions";
const initial = { status: "idle" as const, message: "" };
const member = { memberId: "11111111-1111-4111-8111-111111111111", lifecycleStatus: "former", portalAccessStatus: "active", currentMembershipPathStatus: "open", renewalDueOn: "2025-07-01", revision: 2, currentCaseId: null, appealId: null };
function form(action: string, extra: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ action, revision: "2", ...extra })) data.set(key, value);
  return data;
}
function configure(overrides: Record<string, unknown> = {}) {
  mocks.snapshot.mockResolvedValue({ access: { mode: "restricted" }, membership: { ...member, ...overrides } });
}
describe("authenticated membership requests", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.identity.mockResolvedValue({ user: { id: "owner" } }); configure(); mocks.rpc.mockResolvedValue({ data: { status: "requested", requestId: "22222222-2222-4222-8222-222222222222" }, error: null }); });
  it("derives ownership from the session and asks for renewal, never confirms payment", async () => {
    const result = await requestMembershipAction(initial, form("renewal", { memberId: "victim", actorUserId: "victim", resolution: "paid" }));
    expect(result).toMatchObject({ status: "success", code: "requested" });
    expect(result.message).toMatch(/administrator.*confirm/i);
    expect(mocks.snapshot).toHaveBeenCalledWith("owner");
    expect(mocks.rpc).toHaveBeenCalledWith("request_membership_transition", { p_action: "renewal", p_expected_revision: 2 });
    expect(mocks.refresh).toHaveBeenCalledWith("/portal/membership");
  });
  it.each(["confirm", "paid", "review", "delete"])("rejects unsupported client action %s", async (action) => {
    expect(await requestMembershipAction(initial, form(action))).toMatchObject({ status: "error", code: "invalid_input" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each(["", "-1", "2.5", "9007199254740992"])("rejects malformed revision %s", async (revision) => {
    expect(await requestMembershipAction(initial, form("renewal", { revision }))).toMatchObject({ code: "invalid_input" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("refuses a stale form rather than substituting a fresh revision", async () => {
    configure({ revision: 3 });
    expect(await requestMembershipAction(initial, form("departure", { confirmation: "LEAVE JNUITS" }))).toMatchObject({ code: "stale" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("requires explicit LEAVE JNUITS confirmation before creating a departure case", async () => {
    expect(await requestMembershipAction(initial, form("departure"))).toMatchObject({ code: "confirmation_required" });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(await requestMembershipAction(initial, form("departure", { confirmation: "LEAVE JNUITS" }))).toMatchObject({ status: "success" });
  });
  it("permits withdrawal only while the departure is pending", async () => {
    expect(await requestMembershipAction(initial, form("withdraw_departure"))).toMatchObject({ code: "invalid_transition" });
    configure({ currentMembershipPathStatus: "departure_requested", currentCaseId: "case" });
    expect(await requestMembershipAction(initial, form("withdraw_departure"))).toMatchObject({ status: "success" });
  });
  it("permits one reasoned appeal from an appealable case and never a second", async () => {
    configure({ currentMembershipPathStatus: "closed_appealable", currentCaseId: "case" });
    expect(await requestMembershipAction(initial, form("appeal"))).toMatchObject({ code: "reason_required" });
    expect(await requestMembershipAction(initial, form("appeal", { note: "I chose leave by mistake." }))).toMatchObject({ status: "success" });
    configure({ currentMembershipPathStatus: "closed_appealable", currentCaseId: "case", appealId: "existing" });
    expect(await requestMembershipAction(initial, form("appeal", { note: "Again" }))).toMatchObject({ code: "invalid_transition" });
  });
  it.each(["departure_requested", "closed_appealable", "closed_final"])("blocks renewal through %s", async (path) => {
    configure({ currentMembershipPathStatus: path });
    expect(await requestMembershipAction(initial, form("renewal"))).toMatchObject({ code: "invalid_transition" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each(["open", "departure_requested", "closed_appealable", "closed_final"])("preserves future alumni eligibility from former path %s", async (path) => {
    configure({ currentMembershipPathStatus: path });
    expect(await requestMembershipAction(initial, form("alumni"))).toMatchObject({ status: "success" });
  });
  it("rejects a security-blocked member before invoking the transition RPC", async () => {
    configure({ portalAccessStatus: "suspended" });
    expect(await requestMembershipAction(initial, form("alumni"))).toMatchObject({ code: "not_eligible" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("refuses fabricated success and hides private database errors", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "private SQL detail" } });
    const result = await requestMembershipAction(initial, form("renewal"));
    expect(result).toMatchObject({ code: "database_error", status: "error" });
    expect(result.message).not.toContain("private SQL detail");
    mocks.rpc.mockResolvedValue({ data: { status: "paid" }, error: null });
    expect(await requestMembershipAction(initial, form("renewal"))).toMatchObject({ code: "database_error" });
  });
  it("reports transactional revision conflicts with a refresh instruction", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "40001", message: "internal stale details" } });
    expect(await requestMembershipAction(initial, form("renewal"))).toMatchObject({ code: "stale", message: expect.stringMatching(/refresh/i) });
  });
  it("returns a safe retryable error if the database transport rejects", async () => {
    mocks.rpc.mockRejectedValue(new Error("private transport details"));
    expect(await requestMembershipAction(initial, form("renewal"))).toMatchObject({ code: "database_error", status: "error" });
  });
});
