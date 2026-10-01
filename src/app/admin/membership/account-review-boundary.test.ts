import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), query: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireAdminPermission: async () => ({ user: { id: "operator" } }) }));
vi.mock("@/lib/env", () => ({ getAppBaseUrl: () => "https://example.test" }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: mocks.query, rpc: mocks.rpc }) }));
vi.mock("@/lib/security/security-events", () => ({ recordSecurityEvent: vi.fn() }));
vi.mock("@/lib/notifications/send-email", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/committee/revalidation", () => ({ revalidatePublicCommitteeProjection: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { bulkReviewMemberAccountRequestsAction, updateMemberLifecycle } from "./actions";
beforeEach(() => {
  vi.clearAllMocks();
  const chain = { select: vi.fn(), eq: vi.fn(), update: vi.fn(), maybeSingle: vi.fn() };
  chain.select.mockReturnValue(chain); chain.eq.mockReturnValue(chain); chain.update.mockReturnValue(chain);
  chain.maybeSingle.mockResolvedValue({ data: { id: "request", member_id: "member", request_type: "alumni_conversion", status: "pending" }, error: null });
  mocks.query.mockReturnValue(chain); mocks.rpc.mockResolvedValue({ error: null });
});
it("refuses alumni requests in the legacy service-role account reviewer", async () => {
  await expect(bulkReviewMemberAccountRequestsAction({ requestIds: ["request"], decision: "approved", reviewNote: "Verified." })).rejects.toThrow(/renewal.*membership.*queue/i);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("directs refused legacy reactivation to the renewal decisions queue", async () => {
  mocks.rpc.mockResolvedValue({ error: { code: "22023", message: "Internal eligibility detail" } });
  await expect(updateMemberLifecycle("member", "current", "active", "Reviewed status"))
    .rejects.toThrow(/renewal and membership decisions queue/i);
});
