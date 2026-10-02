import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ guard: vi.fn(), rpc: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/auth/admin-verification/guard", () => ({ authorizeAdminOperation: mocks.guard, adminVerificationFailureMessage: (code: string) => code }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: mocks.rpc }) }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { confirmRenewalAction, reviewMembershipRequestAction } from "./renewal-actions";

const memberId = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";
const initial = { status: "idle" as const, message: "" };
function form(values: Record<string, string>) {
  const result = new FormData();
  for (const [key, value] of Object.entries(values)) result.set(key, value);
  return result;
}
const renewal = () => form({ memberId, expectedDueOn: "2025-09-01", resolution: "paid", reference: "OFFICE-42", note: "Fee verified at office.", confirmation: "CONFIRM" });
const review = (decision = "approved") => form({ requestId, expectedUpdatedAt: "2026-10-01T00:00:00.000Z", decision, note: "Verified with member.", confirmation: "CONFIRM" });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.guard.mockResolvedValue({ ok: true, value: { auth: { user: { id: "operator", aal: "aal1" } } } });
  mocks.rpc.mockResolvedValue({ data: { status: "confirmed", nextDueOn: "2026-09-01", lifecycleStatus: "former" }, error: null });
});

describe("administrative renewal confirmation", () => {
  it("requires exact-operation verification and forwards exactly one expected anniversary", async () => {
    const input = renewal(); input.set("actorUserId", "forged"); input.set("portalAccessStatus", "active"); input.set("cardNumber", "forbidden");
    const result = await confirmRenewalAction(initial, input);
    expect(mocks.guard).toHaveBeenCalledWith({ operation: "membership.renewal.confirm", payload: { memberId, expectedDueOn: "2025-09-01", resolution: "paid", reference: "OFFICE-42", note: "Fee verified at office.", confirmation: "CONFIRM" } }, undefined);
    expect(mocks.rpc).toHaveBeenCalledWith("confirm_membership_renewal", {
      p_member_id: memberId, p_expected_due_on: "2025-09-01", p_resolution: "paid", p_reference: "OFFICE-42", p_note: "Fee verified at office.",
    });
    expect(result).toMatchObject({ status: "success", message: expect.stringMatching(/one anniversary.*still former/i) });
  });
  it("fails before renewal side effects without verification", async () => {
    mocks.guard.mockResolvedValue({ ok: false, code: "verification_required" });
    expect(await confirmRenewalAction(initial, renewal())).toMatchObject({ status: "error", code: "verification_required" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("forwards a bound proof for atomic renewal consumption", async () => {
    const input = renewal(); input.set("verificationProof", "bound-proof");
    await confirmRenewalAction(initial, input);
    expect(mocks.rpc.mock.calls[0][1].p_proof).toBe("bound-proof");
  });
  it("cannot be used by an unauthorized operator / Content Admin", async () => {
    mocks.guard.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(confirmRenewalAction(initial, renewal())).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each(["paid", "waived"])("accepts the audited %s resolution without inventing payment processing", async (resolution) => {
    const input = renewal(); input.set("resolution", resolution);
    mocks.rpc.mockResolvedValue({ data: { status: "confirmed", nextDueOn: "2027-09-01", lifecycleStatus: "current" }, error: null });
    const result = await confirmRenewalAction(initial, input);
    expect(mocks.rpc.mock.calls[0][1].p_resolution).toBe(resolution);
    expect(result.message).toMatch(/current.*security restrictions.*unchanged/i);
    expect(result.message).not.toMatch(/payment processed/i);
    expect(mocks.revalidate).toHaveBeenCalledWith("/portal/membership");
  });
  it("reports idempotent retries without implying another period was advanced", async () => {
    mocks.rpc.mockResolvedValue({ data: { status: "already_confirmed", nextDueOn: "2026-09-01", lifecycleStatus: "former" }, error: null });
    expect(await confirmRenewalAction(initial, renewal())).toMatchObject({ status: "success", message: expect.stringMatching(/already confirmed.*no additional/i) });
  });
  it.each([
    ["resolution", "pending"], ["expectedDueOn", "2025-02-30"], ["memberId", "not-a-uuid"],
    ["reference", "secret@payment.test"], ["reference", "x".repeat(97)], ["note", ""],
    ["note", "x".repeat(501)], ["confirmation", ""],
  ])("rejects invalid %s before a write", async (field, value) => {
    const input = renewal(); input.set(field, value);
    expect(await confirmRenewalAction(initial, input)).toMatchObject({ status: "error", code: "invalid_input" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([
    ["40001", "stale"], ["22023", "invalid_transition"], ["42501", "permission_denied"], ["XX000", "database_error"],
  ])("maps %s safely", async (code, expected) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code, message: "PRIVATE database material" } });
    const result = await confirmRenewalAction(initial, renewal());
    expect(result).toMatchObject({ status: "error", code: expected });
    expect(result.message).not.toContain("PRIVATE");
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("handles transport failures without exposing internals", async () => {
    mocks.rpc.mockRejectedValue(new Error("PRIVATE transport"));
    expect(await confirmRenewalAction(initial, renewal())).toMatchObject({ status: "error", code: "database_error" });
  });
});

describe("departure, appeal and alumni review", () => {
  it("permits an authorized routine AAL1 review without a payment/MFA proof", async () => {
    mocks.rpc.mockResolvedValue({ data: { status: "approved", requestId }, error: null });
    expect(await reviewMembershipRequestAction(initial, review())).toMatchObject({ status: "success" });
    expect(mocks.guard).toHaveBeenCalledWith({ operation: "membership.request.review", payload: { requestId, expectedUpdatedAt: "2026-10-01T00:00:00.000Z", decision: "approved", note: "Verified with member.", confirmation: "CONFIRM" } });
  });
  it("does not review when current permission or mandatory verification fails", async () => {
    mocks.guard.mockResolvedValue({ ok: false, code: "permission_denied" });
    expect(await reviewMembershipRequestAction(initial, review())).toMatchObject({ status: "error", code: "permission_denied" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each(["approved", "rejected"])("uses the transactional %s review, not a security-status rewrite", async (decision) => {
    mocks.rpc.mockResolvedValue({ data: { status: decision, requestId, pathStatus: decision === "approved" ? "open" : "closed_final" }, error: null });
    const result = await reviewMembershipRequestAction(initial, review(decision));
    expect(mocks.rpc).toHaveBeenCalledWith("review_membership_request", { p_request_id: requestId, p_expected_updated_at: "2026-10-01T00:00:00.000Z", p_decision: decision, p_note: "Verified with member." });
    expect(result).toMatchObject({ status: "success", message: expect.stringMatching(/security restrictions.*unchanged/i) });
  });
  it("refuses a stale request without refreshing success state", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "40001" } });
    expect(await reviewMembershipRequestAction(initial, review())).toMatchObject({ status: "error", code: "stale" });
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it.each([["note", ""], ["expectedUpdatedAt", "today"], ["decision", "withdrawn"], ["confirmation", ""]])("validates review %s", async (field, value) => {
    const input = review(); input.set(field, value);
    expect(await reviewMembershipRequestAction(initial, input)).toMatchObject({ status: "error", code: "invalid_input" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
