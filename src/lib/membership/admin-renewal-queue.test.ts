import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ guard: vi.fn(), rpc: vi.fn(), admin: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireAdminPermission: mocks.guard }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
import { loadMembershipRenewalQueue } from "./admin-renewal-queue";
beforeEach(() => {
  vi.clearAllMocks(); mocks.guard.mockResolvedValue({ user: { id: "operator" } });
  mocks.admin.mockReturnValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ data: { total: 0, rows: [] }, error: null });
});
it("authorizes before reading a bounded queue, using SQL's date default", async () => {
  await loadMembershipRenewalQueue({ renewalQueue: "departure", renewalPage: "2" });
  expect(mocks.guard).toHaveBeenCalledWith("admin.membership.manage", { fallbackPath: "/admin/dashboard" });
  expect(mocks.rpc).toHaveBeenCalledWith("get_membership_admin_queue", { p_queue: "departure", p_page: 2, p_page_size: 25 });
});
it("normalizes bad query inputs without unbounded or injected filters", async () => {
  expect(await loadMembershipRenewalQueue({ renewalQueue: "all;DROP", renewalPage: "100000000" })).toMatchObject({ queue: "overdue", page: 10000, pageSize: 25 });
  expect(mocks.rpc.mock.calls[0][1]).toEqual({ p_queue: "overdue", p_page: 10000, p_page_size: 25 });
});
it("never starts a service read for Content Admin or an unauthenticated caller", async () => {
  mocks.guard.mockRejectedValue(new Error("NEXT_REDIRECT"));
  await expect(loadMembershipRenewalQueue({})).rejects.toThrow("NEXT_REDIRECT");
  expect(mocks.admin).not.toHaveBeenCalled();
});
it("does not fabricate an empty successful queue after a read error", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { message: "PRIVATE data" } });
  const result = await loadMembershipRenewalQueue({});
  expect(result.error).toMatch(/unavailable/i); expect(result.error).not.toContain("PRIVATE");
});
