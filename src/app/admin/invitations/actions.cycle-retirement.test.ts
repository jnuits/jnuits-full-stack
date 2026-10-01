import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ permission: vi.fn(), from: vi.fn(), insert: vi.fn(), issue: vi.fn(), audit: vi.fn(), sync: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireAdminPermission: mocks.permission }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: mocks.from }) }));
vi.mock("@/lib/supabase/flexible", () => ({ asFlexibleClient: (client: unknown) => client }));
vi.mock("@/lib/admin/invitations", () => ({
  issueInvitationForMember: mocks.issue, persistInvitationAudit: mocks.audit,
  revokeInvitationRecord: vi.fn(), syncInvitationBatchMetrics: mocks.sync,
}));
import { createInvitationBatchAction, issueInvitationsFromBatchAction } from "./actions";
const person = { id: "member-1", jnuits_id: "JNUITS-2024001", full_name: "Fictional Member", email: "fictional@example.test", is_profile_claimed: false, lifecycle_status: "current", member_type: "current", portal_access_status: "active" };
describe("cycle-free invitation outreach", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.permission.mockResolvedValue({ user: { id: "trusted-operator" } });
    mocks.insert.mockReturnValue({ select: () => ({ single: async () => ({ data: { id: "batch-1" }, error: null }) }) });
    mocks.issue.mockResolvedValue({ deliveryStatus: "sent", invitationId: "invite-1" });
    mocks.sync.mockResolvedValue({ failedCount: 0, issuedCount: 1 });
    mocks.from.mockImplementation((table: string) => {
      if (table === "invitation_batches") return {
        insert: mocks.insert,
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "batch-1", label: "Fictional outreach" }, error: null }) }) }),
        update: () => ({ eq: async () => ({ error: null }) }),
      };
      if (table === "members") return { select: () => ({ in: async () => ({ data: [person], error: null }) }) };
      if (table === "member_invitations") {
        const query = { eq: vi.fn(), gt: vi.fn(), is: vi.fn(), order: vi.fn(), limit: vi.fn(), maybeSingle: vi.fn() };
        query.eq.mockReturnValue(query); query.gt.mockReturnValue(query); query.is.mockReturnValue(query); query.order.mockReturnValue(query);
        query.maybeSingle.mockResolvedValue({ data: null, error: null });
        query.limit.mockReturnValue(query);
        return { select: () => query };
      }
      throw new Error(`Unexpected table ${table}`);
    });
  });
  it("creates an unbound batch even if a stale browser supplies a cycle ID", async () => {
    const result = await createInvitationBatchAction({ label: "Fictional outreach", cycleId: "retired-cycle" });
    expect(result.ok).toBe(true);
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ cycle_id: null }));
  });
  it("uses explicit canonical member IDs, not old cycle enrollment rows", async () => {
    const result = await issueInvitationsFromBatchAction({ batchId: "batch-1", memberIds: ["JnUITS-2024001"] });
    expect(result.ok).toBe(true);
    expect(mocks.issue).toHaveBeenCalledWith(expect.objectContaining({ member: person, batchId: "batch-1", actorUserId: "trusted-operator", invitationType: "member_claim" }));
    expect(mocks.from).not.toHaveBeenCalledWith("membership_cycle_memberships");
  });
  it("rejects an empty recipient list instead of inviting every member", async () => {
    const result = await issueInvitationsFromBatchAction({ batchId: "batch-1", memberIds: [] });
    expect(result.ok).toBe(false);
    expect(mocks.issue).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("does not issue any invitation if a requested identity is missing", async () => {
    const result = await issueInvitationsFromBatchAction({ batchId: "batch-1", memberIds: ["JNUITS-2024001", "JNUITS-2024002"] });
    expect(result.ok).toBe(false);
    expect(mocks.issue).not.toHaveBeenCalled();
  });
});
