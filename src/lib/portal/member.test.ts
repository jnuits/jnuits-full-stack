import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ identity: vi.fn(), from: vi.fn(), rpc: vi.fn(), memberRead: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/auth/session", async (original) => ({ ...await original<typeof import("@/lib/auth/session")>(), requirePortalIdentity: mocks.identity }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: mocks.from, rpc: mocks.rpc }) }));
vi.mock("@/lib/supabase/flexible", () => ({ asFlexibleClient: (client: unknown) => client }));
import { getPortalMemberSnapshot } from "./member";

const id = "11111111-1111-4111-8111-111111111111";
const rawMember = {
  id, user_id: "owner", full_name: "Fictional Member", jnuits_id: "JNUITS-2024001",
  member_type: "current", lifecycle_status: "former", portal_access_status: "active",
  current_membership_path_status: "open", joined_on: "2024-07-01", renewal_due_on: "2025-07-01",
  membership_revision: 2, verification_code_hash: "private-hash-marker", current_organization: "Private workplace",
};
function state(overrides: Record<string, unknown> = {}) {
  return {
    memberId: id, fullName: "Fictional Member", jnuitsId: "JNUITS-2024001", avatarSecureUrl: null,
    joinedOn: "2024-07-01", renewalDueOn: "2025-07-01", graceEndsOn: "2026-01-01", renewalState: "former",
    lifecycleStatus: "former", memberType: "current", portalAccessStatus: "active", currentMembershipPathStatus: "open",
    revision: 2, currentCaseId: null, appealId: null, closedOn: null, closureReason: null,
    ...overrides,
  };
}
describe("owned portal member snapshots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.identity.mockResolvedValue({ user: { id: "owner" }, roles: ["member"] });
    mocks.memberRead.mockResolvedValue({ data: rawMember, error: null });
    mocks.rpc.mockImplementation(async (name: string) => ({ data: name === "get_member_membership_state" ? state() : { status: "reconciled", transitioned: 0 }, error: null }));
    mocks.from.mockImplementation((table: string) => {
      const query = { select: vi.fn(() => query), eq: vi.fn(() => query), in: vi.fn(() => query), order: vi.fn(() => query),
        limit: vi.fn(async () => ({ data: [], error: null })),
        maybeSingle: vi.fn(() => table === "members" ? mocks.memberRead() : Promise.resolve({ data: null, error: null })) };
      return query;
    });
  });
  it("gives a former/current member only the minimal membership DTO, never editable profile data", async () => {
    const snapshot = await getPortalMemberSnapshot("owner");
    expect(snapshot.access).toMatchObject({ mode: "restricted", canMutate: false, isRestricted: true });
    expect(snapshot.membership).toMatchObject({ joinedOn: "2024-07-01", renewalDueOn: "2025-07-01", graceEndsOn: "2026-01-01", currentMembershipPathStatus: "open" });
    expect(snapshot.member).toBeNull();
    expect(JSON.stringify(snapshot)).not.toMatch(/private-hash-marker|Private workplace/);
    expect(mocks.from).not.toHaveBeenCalledWith("portal_user_settings");
    expect(mocks.rpc).toHaveBeenCalledWith("get_member_membership_state", { p_member_id: id });
  });
  it("rejects another user's snapshot before making a privileged lookup", async () => {
    await expect(getPortalMemberSnapshot("another-user")).rejects.toThrow("own member profile");
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("never restores unknown lifecycle through member_type=current", async () => {
    mocks.rpc.mockResolvedValue({ data: state({ lifecycleStatus: null, renewalState: "unknown" }), error: null });
    const snapshot = await getPortalMemberSnapshot("owner");
    expect(snapshot.access.mode).toBe("blocked");
    expect(snapshot.member).toBeNull();
  });
  it("keeps active alumni profile access without exposing a directory-code hash", async () => {
    mocks.rpc.mockResolvedValue({ data: state({ lifecycleStatus: "alumni", memberType: "alumni", currentMembershipPathStatus: "closed_final", renewalState: "not_applicable" }), error: null });
    mocks.memberRead.mockResolvedValue({ data: { ...rawMember, lifecycle_status: "alumni", member_type: "alumni", current_membership_path_status: "closed_final" }, error: null });
    const snapshot = await getPortalMemberSnapshot("owner");
    expect(snapshot.access.mode).toBe("mutable");
    expect(snapshot.member?.full_name).toBe("Fictional Member");
    expect(snapshot.member).not.toHaveProperty("verification_code_hash");
  });
  it("fails closed on missing migrated columns instead of falling back to a permissive legacy row", async () => {
    mocks.memberRead.mockResolvedValue({ data: null, error: { code: "42703", message: "lifecycle_status missing" } });
    await expect(getPortalMemberSnapshot("owner")).rejects.toThrow("Member profile could not be loaded");
    expect(mocks.memberRead).toHaveBeenCalledTimes(1);
  });
});
