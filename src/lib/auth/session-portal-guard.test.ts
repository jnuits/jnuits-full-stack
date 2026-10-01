import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ client: vi.fn(), rpc: vi.fn(), readMember: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/supabase/flexible", () => ({ asFlexibleClient: (client: unknown) => client }));
import { requirePortalIdentity, requirePortalUser } from "./session";
const id = "11111111-1111-4111-8111-111111111111";
function configure(status = "former", security = "active", role = "member", path = "open") {
  const member = { id, lifecycle_status: status, portal_access_status: security, member_type: "current", current_membership_path_status: path };
  mocks.readMember.mockResolvedValue({ data: member, error: null });
  mocks.client.mockResolvedValue({
    auth: {
      getUser: async () => ({ data: { user: { id: "signed-in-user", email: "fictional@example.test" } } }),
      getClaims: async () => ({ data: { claims: { jnuits_admin_role: "admin", jnuits_member_id: id, jnuits_portal_role: role, jnuits_role_version: 1 } } }),
    },
    from: (table: string) => ({ select: () => ({ eq: () => ({ maybeSingle: () => table === "members" ? mocks.readMember() : Promise.resolve({ data: null, error: null }) }) }) }),
  });
}
describe("portal identity versus mutation guards", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.rpc.mockResolvedValue({ data: { status: "reconciled", transitioned: 0 }, error: null }); configure(); });
  it("preserves authenticated former identity but blocks normal mutable routes", async () => {
    await expect(requirePortalIdentity()).resolves.toMatchObject({ user: { id: "signed-in-user" } });
    await expect(requirePortalUser()).rejects.toThrow("redirect:/portal/membership");
    expect(mocks.rpc).toHaveBeenCalledWith("reconcile_membership_lifecycle", expect.objectContaining({ p_member_id: id, p_batch_size: 1 }));
  });
  it.each(["frozen", "suspended", "deactivated", "deletion_requested"])("blocks security state %s despite a current lifecycle", async (security) => {
    configure("current", security);
    await expect(requirePortalIdentity()).rejects.toThrow(`redirect:/portal/access-pending?access=${security}`);
  });
  it("does not treat deleted/active as a valid identity", async () => {
    configure("deleted");
    await expect(requirePortalIdentity()).rejects.toThrow("redirect:/portal/access-pending?access=deleted");
  });
  it.each(["current", "alumni"])("keeps normal %s access", async (state) => {
    configure(state, "active", "member", state === "alumni" ? "closed_final" : "open");
    await expect(requirePortalUser()).resolves.toMatchObject({ user: { id: "signed-in-user" } });
  });
  it("re-reads the member after database reconciliation before granting mutability", async () => {
    configure("current");
    mocks.rpc.mockImplementation(async () => {
      mocks.readMember.mockResolvedValue({ data: { id, lifecycle_status: "former", portal_access_status: "active", member_type: "current", current_membership_path_status: "open" }, error: null });
      return { data: { status: "reconciled", transitioned: 1 }, error: null };
    });
    await expect(requirePortalUser()).rejects.toThrow("redirect:/portal/membership");
    expect(mocks.readMember).toHaveBeenCalledTimes(2);
  });
  it("fails closed when reconciliation fails instead of allowing stale current access", async () => {
    configure("current");
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "private database details", code: "XX000" } });
    await expect(requirePortalUser()).rejects.toThrow("Membership status could not be verified");
  });
  it("preserves advisor-only access without enforcing member renewal status", async () => {
    configure("former", "suspended", "advisor");
    await expect(requirePortalUser()).resolves.toMatchObject({ user: { portalRole: "advisor" } });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
