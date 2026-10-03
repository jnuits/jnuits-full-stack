import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ approve: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/membership/bulk-review", () => ({ approveMembershipRequests: mocks.approve }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.refresh }));
import { bulkApproveMembershipRequestsAction } from "./bulk-review-actions";
const initial = { status: "idle" as const, message: "", results: [] };
const requests = [{ requestId: "11111111-1111-4111-8111-111111111111", expectedUpdatedAt: "2026-10-02T00:00:00Z" }];
function form() { const data = new FormData(); data.set("queue", "alumni"); data.set("requests", JSON.stringify(requests)); data.set("note", "Reviewed eligibility."); data.set("confirmation", "CONFIRM"); return data; }
beforeEach(() => { vi.clearAllMocks(); });
describe("bulk review action", () => {
  it("rejects malformed payload before reaching the approval service", async () => {
    const data = form(); data.set("requests", "malformed-json");
    expect((await bulkApproveMembershipRequestsAction(initial, data)).status).toBe("error");
    expect(mocks.approve).not.toHaveBeenCalled();
  });
  it("retains partial results and refreshes membership views without inverse transitions", async () => {
    const result = { status: "partial", message: "One approved; one stale.", results: [{ requestId: requests[0].requestId, status: "approved" }] };
    mocks.approve.mockResolvedValue(result);
    expect(await bulkApproveMembershipRequestsAction(initial, form())).toEqual(result);
    expect(mocks.approve).toHaveBeenCalledWith({ queue: "alumni", requests, note: "Reviewed eligibility.", confirmation: "CONFIRM" });
    expect(mocks.refresh.mock.calls.map(([path]) => path)).toEqual(["/admin/membership", "/portal", "/portal/membership", "/portal/profile"]);
  });
});
