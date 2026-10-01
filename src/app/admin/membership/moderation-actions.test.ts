import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ approve: vi.fn() }));
vi.mock("@/app/admin/applications/membership-actions", () => ({ approveMembershipApplication: mocks.approve }));
vi.mock("@/lib/env", () => ({ getAppBaseUrl: () => "https://example.test" }));
vi.mock("@/lib/auth/session", () => ({ requireAdminPermission: () => { throw new Error("obsolete approval path reached"); } }));
import { approveMembershipApplication } from "./moderation-actions";
describe("legacy membership approval compatibility", () => {
  it("delegates the untouched form to the canonical transactional approval", async () => {
    const form = new FormData();
    form.set("applicationId", "fictional-application");
    form.set("joinedOn", "2024-07-01");
    mocks.approve.mockRejectedValue(new Error("canonical redirect"));
    await expect(approveMembershipApplication(form)).rejects.toThrow("canonical redirect");
    expect(mocks.approve).toHaveBeenCalledWith(form);
  });
});
