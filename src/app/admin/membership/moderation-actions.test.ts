import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ approve: vi.fn(), review: vi.fn(), permission: vi.fn(), flash: vi.fn(), projection: vi.fn() }));
vi.mock("@/app/admin/applications/membership-actions", () => ({ approveMembershipApplication: mocks.approve }));
vi.mock("@/lib/env", () => ({ getAppBaseUrl: () => "https://example.test" }));
vi.mock("@/lib/auth/session", () => ({ requireAdminPermission: mocks.permission }));
vi.mock("@/lib/admin/workplace", () => ({ reviewWorkplaceRequest: mocks.review }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ fixture: true }) }));
vi.mock("@/lib/admin/flash", () => ({ setAdminFlash: mocks.flash }));
vi.mock("@/lib/committee/revalidation", () => ({ revalidatePublicCommitteeProjection: mocks.projection }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect ${path}`); } }));
import { approveMembershipApplication, approveWorkplaceUpdateRequest, rejectWorkplaceUpdateRequest } from "./moderation-actions";
describe("legacy membership approval compatibility", () => {
  it("delegates the untouched form to the canonical transactional approval", async () => {
    const form = new FormData();
    form.set("applicationId", "fictional-application");
    form.set("joinedOn", "2024-07-01");
    mocks.approve.mockRejectedValue(new Error("canonical redirect"));
    await expect(approveMembershipApplication(form)).rejects.toThrow("canonical redirect");
    expect(mocks.approve).toHaveBeenCalledWith(form);
    expect(mocks.permission).not.toHaveBeenCalled();
  });
});

describe("legacy workplace review integration", () => {
  it.each([[approveWorkplaceUpdateRequest, "approved"], [rejectWorkplaceUpdateRequest, "rejected"]] as const)("delegates a %s decision to the canonical transaction", async (action, decision) => {
    vi.clearAllMocks();
    mocks.permission.mockResolvedValue({ user: { id: "fictional-reviewer" } });
    mocks.review.mockResolvedValue({ memberName: "Fictional Alumni", memberId: "fictional-member" });
    const form = new FormData(); form.set("requestId", "fictional-request"); form.set("reviewNote", "Verified fictional request.");
    await expect(action(form)).rejects.toThrow("redirect /admin/workplace");
    expect(mocks.permission).toHaveBeenCalledWith("admin.membership.manage", { fallbackPath: "/admin/workplace" });
    expect(mocks.review).toHaveBeenCalledWith({ admin: { fixture: true }, actorUserId: "fictional-reviewer", decision, requestId: "fictional-request", reviewNote: "Verified fictional request." });
    expect(mocks.projection).toHaveBeenCalledOnce();
    expect(mocks.flash).toHaveBeenCalledWith(expect.objectContaining({ tone: "success" }));
  });
});
