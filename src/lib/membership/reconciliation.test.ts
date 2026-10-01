import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }));
import { reconcileMembershipLifecycle } from "./reconciliation";
describe("server-only lifecycle reconciliation wrapper", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.rpc.mockResolvedValue({ data: { status: "reconciled", transitioned: 0 }, error: null }); });
  it("delegates member-scoped reconciliation to the database with one-row bound", async () => {
    await expect(reconcileMembershipLifecycle({ memberId: "11111111-1111-4111-8111-111111111111" })).resolves.toEqual({ status: "reconciled", transitioned: 0 });
    expect(mocks.rpc).toHaveBeenCalledWith("reconcile_membership_lifecycle", { p_member_id: "11111111-1111-4111-8111-111111111111", p_batch_size: 1 });
  });
  it("uses a bounded queue call and explicit date only when supplied", async () => {
    await reconcileMembershipLifecycle({ batchSize: 200, effectiveDate: "2026-10-01" });
    expect(mocks.rpc).toHaveBeenCalledWith("reconcile_membership_lifecycle", { p_batch_size: 200, p_effective_date: "2026-10-01" });
  });
  it.each([{ batchSize: 1001 }, { batchSize: 0 }, { effectiveDate: "2026-02-30" }, { effectiveDate: "01/10/2026" }, { memberId: "not-a-uuid" }])("rejects malformed scope/date/bound %j before RPC", async (options) => {
    await expect(reconcileMembershipLifecycle(options)).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("does not expose raw database errors or silently bypass a failed reconciliation", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "secret database detail" } });
    await expect(reconcileMembershipLifecycle()).rejects.toThrow("Membership status could not be verified");
  });
  it("sanitizes rejected transport errors as well as returned database errors", async () => {
    mocks.rpc.mockRejectedValue(new Error("private network token"));
    await expect(reconcileMembershipLifecycle()).rejects.toThrow("Membership status could not be verified");
  });
  it("uses the SQL date default and a 500-row bound for a normal queue fallback", async () => {
    await reconcileMembershipLifecycle();
    expect(mocks.rpc).toHaveBeenCalledWith("reconcile_membership_lifecycle", { p_batch_size: 500 });
  });
});
