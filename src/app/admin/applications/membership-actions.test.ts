import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  flash: vi.fn(), permission: vi.fn(), rpc: vi.fn(), sendEmail: vi.fn(),
  from: vi.fn(), revalidate: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("@/lib/auth/session", () => ({ requireAdminPermission: mocks.permission }));
vi.mock("@/lib/admin/flash", () => ({ setAdminFlash: mocks.flash }));
vi.mock("@/lib/env", () => ({ getAppBaseUrl: () => "https://example.test", getPublicAppBaseUrl: () => "https://example.test" }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: mocks.from, rpc: mocks.rpc }) }));
vi.mock("@/lib/supabase/flexible", () => ({ asFlexibleClient: (client: unknown) => client }));
vi.mock("@/lib/notifications/send-email", () => ({ sendEmail: mocks.sendEmail }));
vi.mock("@/lib/members/invitation-code", () => ({
  generateInvitationCode: () => "fictional-claim", hashInvitationCode: () => "hashed-claim",
  getInvitationExpiryIso: () => "2026-10-16T00:00:00Z",
}));
import { approveMembershipApplication, requestMembershipApplicationReview } from "./membership-actions";

const applicationId = "11111111-1111-4111-8111-111111111111";
function form(joinedOn?: string) {
  const value = new FormData();
  value.set("applicationId", applicationId);
  value.set("reviewNote", "Official joining date verified.");
  if (joinedOn !== undefined) value.set("joinedOn", joinedOn);
  // An actor supplied by the browser must never override the trusted session.
  value.set("actorUserId", "untrusted-actor");
  return value;
}
describe("joining-date membership application approval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T18:30:00Z")); // October 2 in Dhaka.
    mocks.permission.mockResolvedValue({ user: { id: "trusted-operator" } });
    mocks.from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: async () => ({
      data: { name: "Fictional Applicant", email: "fictional@example.test" }, error: null,
    }) }) }) });
    mocks.rpc.mockResolvedValue({ data: [{ result_status: "approved", member_id: "member", invitation_id: "invite", jnuits_id: "JNUITS-2024001" }], error: null });
    mocks.sendEmail.mockResolvedValue({ ok: true });
  });
  afterEach(() => vi.useRealTimers());

  it("accepts a reviewed earlier date and derives the actor from the session", async () => {
    await expect(approveMembershipApplication(form("2024-07-01"))).rejects.toThrow("redirect:/admin/applications");
    expect(mocks.permission).toHaveBeenCalledWith("admin.membership.manage", { fallbackPath: "/admin/applications" });
    expect(mocks.rpc).toHaveBeenCalledWith("approve_membership_application", expect.objectContaining({
      p_actor_user_id: "trusted-operator", p_application_id: applicationId,
      p_joined_on: "2024-07-01", p_invitation_code_hash: "hashed-claim",
    }));
    expect(mocks.flash).toHaveBeenCalledWith(expect.objectContaining({ tone: "success" }));
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
  });
  it.each([undefined, ""])("leaves blank joining date to the database's Dhaka approval date", async (date) => {
    await expect(approveMembershipApplication(form(date))).rejects.toThrow("redirect:");
    expect(mocks.rpc).toHaveBeenCalledWith("approve_membership_application", expect.objectContaining({ p_joined_on: null }));
  });
  it("allows the current Dhaka date even when the UTC date is yesterday", async () => {
    await expect(approveMembershipApplication(form("2026-10-02"))).rejects.toThrow("redirect:");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it.each(["2026-10-03", "2024-02-30", "01/07/2024", "2024-7-1"])("rejects invalid/future date %s before any database write", async (date) => {
    await expect(approveMembershipApplication(form(date))).rejects.toThrow("redirect:");
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(mocks.flash).toHaveBeenCalledWith(expect.objectContaining({ tone: "error", message: expect.stringMatching(/joining date/i) }));
  });
  it("does not send another invitation for an idempotent retry", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ result_status: "already_approved", jnuits_id: "JNUITS-2024001" }], error: null });
    await expect(approveMembershipApplication(form())).rejects.toThrow("redirect:");
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
  it("does not grant a claim or reveal database details on an identity conflict", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ result_status: "identity_conflict" }], error: null });
    await expect(approveMembershipApplication(form())).rejects.toThrow("redirect:");
    expect(mocks.flash).toHaveBeenCalledWith(expect.objectContaining({ tone: "error", message: expect.stringMatching(/identity|existing member/i) }));
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
  it("still permits requesting review when the joining date needs correction", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ result_status: "updated" }], error: null });
    await expect(requestMembershipApplicationReview(form("not a date"))).rejects.toThrow("redirect:");
    expect(mocks.rpc).toHaveBeenCalledWith("review_membership_application", expect.objectContaining({ p_target_status: "needs_review" }));
  });
  it("checks authorization before reaching any database operation", async () => {
    mocks.permission.mockRejectedValue(new Error("permission denied"));
    await expect(approveMembershipApplication(form())).rejects.toThrow("permission denied");
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
