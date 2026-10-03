import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ authorize: vi.fn(), fetchRows: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/auth/admin-verification/guard", () => ({ authorizeAdminOperation: mocks.authorize }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: () => ({ select: () => ({ in: mocks.fetchRows }) }), rpc: mocks.rpc }) }));
import { approveMembershipRequests } from "./bulk-review";
import type { BulkReviewInput } from "./bulk-review-model";
const ids = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333"];
const requests = ids.map(requestId => ({ requestId, expectedUpdatedAt: "2026-10-02T00:00:00Z" }));
const input: BulkReviewInput = { queue: "alumni", requests, note: "Eligibility reviewed.", confirmation: "CONFIRM" };
beforeEach(() => {
  vi.clearAllMocks(); mocks.authorize.mockResolvedValue({ ok: true, value: {} });
  mocks.fetchRows.mockResolvedValue({ error: null, data: ids.map(id => ({ id, request_type: "alumni_conversion", status: "pending", payload: {} })) });
  mocks.rpc.mockImplementation(async (_name: string, args: { p_request_id: string }) => ({ error: null, data: { status: "approved", requestId: args.p_request_id } }));
});
describe("bounded authoritative membership approval", () => {
  it("rejects empty, duplicate, oversized or unconfirmed batches before writes", async () => {
    const invalid = [
      { ...input, requests: [] }, { ...input, requests: [requests[0], requests[0]] },
      { ...input, requests: Array.from({ length: 26 }, (_, index) => ({ requestId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, expectedUpdatedAt: requests[0].expectedUpdatedAt })) },
      { ...input, note: " " }, { ...input, note: "x".repeat(501) }, { ...input, confirmation: "" },
      { ...input, requests: [{ ...requests[0], expectedUpdatedAt: "not-a-date" }] },
    ];
    for (const value of invalid) expect((await approveMembershipRequests(value as BulkReviewInput)).status).toBe("error");
    expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.fetchRows).not.toHaveBeenCalled();
  });
  it("mixed_batch_writes_nothing when authoritative types differ from the selected queue", async () => {
    mocks.fetchRows.mockResolvedValue({ error: null, data: ids.map((id, index) => ({ id, request_type: index === 1 ? "membership_renewal" : "alumni_conversion", status: "pending", payload: {} })) });
    expect((await approveMembershipRequests(input)).status).toBe("error");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("permission denial precedes reads and writes", async () => {
    mocks.authorize.mockResolvedValue({ ok: false, code: "permission_denied" });
    expect((await approveMembershipRequests(input)).status).toBe("error");
    expect(mocks.fetchRows).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("reports partial results in deterministic order with each original snapshot", async () => {
    mocks.rpc.mockResolvedValueOnce({ error: null, data: { status: "approved", requestId: ids[0] } })
      .mockResolvedValueOnce({ error: { code: "40001" }, data: null })
      .mockRejectedValueOnce(new Error("private provider body"));
    const result = await approveMembershipRequests({ ...input, requests: [...requests].reverse() });
    expect(result.status).toBe("partial");
    expect(result.results).toEqual([{ requestId: ids[0], status: "approved" }, { requestId: ids[1], status: "stale" }, { requestId: ids[2], status: "failed" }]);
    expect(mocks.rpc.mock.calls.map(([, args]) => args)).toEqual(requests.map(row => ({ p_request_id: row.requestId, p_expected_updated_at: row.expectedUpdatedAt, p_decision: "approved", p_note: "Eligibility reviewed." })));
    expect(JSON.stringify(result)).not.toContain("private provider body");
  });
  it("retry_is_idempotent and rejected/withdrawn requests stay ineligible", async () => {
    mocks.fetchRows.mockResolvedValue({ error: null, data: [{ id: ids[0], request_type: "alumni_conversion", status: "approved", payload: {} }, { id: ids[1], request_type: "alumni_conversion", status: "rejected", payload: {} }, { id: ids[2], request_type: "alumni_conversion", status: "pending", payload: { withdrawn: true } }] });
    mocks.rpc.mockResolvedValue({ error: null, data: { status: "already_reviewed", requestId: ids[0] } });
    const result = await approveMembershipRequests(input);
    expect(result.status).toBe("partial");
    expect(result.results.map(row => row.status)).toEqual(["already_approved", "ineligible", "ineligible"]);
    expect(mocks.rpc).toHaveBeenCalledOnce();
  });
  it("never turns missing rows or malformed completion into an all-success result", async () => {
    mocks.fetchRows.mockResolvedValueOnce({ error: null, data: [] });
    expect((await approveMembershipRequests(input)).status).toBe("error");
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.fetchRows.mockResolvedValue({ error: null, data: [{ id: ids[0], request_type: "alumni_conversion", status: "pending", payload: {} }] });
    mocks.rpc.mockResolvedValue({ error: null, data: { status: "approved", requestId: ids[2] } });
    const result = await approveMembershipRequests({ ...input, requests: [requests[0]] });
    expect(result.results[0].status).toBe("failed"); expect(result.status).toBe("error");
  });
});
