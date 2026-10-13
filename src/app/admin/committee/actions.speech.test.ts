import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ permission: vi.fn(), client: vi.fn(), save: vi.fn(), audit: vi.fn(), flash: vi.fn(), revalidate: vi.fn(), roleCode: "president" }));
vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => mocks.revalidate(...args) }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error("redirect:" + url); } }));
vi.mock("@/lib/admin/flash", () => ({ setAdminFlash: (...args: unknown[]) => mocks.flash(...args) }));
vi.mock("@/lib/auth/session", () => ({ requireAdminPermission: (...args: unknown[]) => mocks.permission(...args) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => mocks.client() }));
import { archiveAdvisorProfile, saveAdvisorProfile, saveCommitteeAssignment } from "./actions";
function form(speech: string, editing = false) {
  const data = new FormData();
  Object.entries({ termId: "term-7", roleId: "role-leader", memberId: "member-1", isPublic: "true", status: "active", sortOrder: "100", speech, ...(editing ? { assignmentId: "appointment-1" } : {}) }).forEach(([key,value]) => data.set(key,value));
  return data;
}
beforeEach(() => {
    vi.clearAllMocks(); mocks.roleCode="president";
    mocks.permission.mockResolvedValue({ user: { id: "operator-1" } });
    mocks.flash.mockResolvedValue(undefined); mocks.audit.mockResolvedValue({ error: null });
    const saved = { select: () => ({ single: async () => ({ data: { id: "appointment-1" }, error: null }) }), eq: () => saved };
    mocks.save.mockReturnValue(saved);
    mocks.client.mockReturnValue({ from: (table: string) => {
      if(table === "committee_assignments") return { insert: mocks.save, update: mocks.save };
      if(table === "advisor_profiles") return { insert: mocks.save, update: mocks.save };
      if(table === "audit_events") return { insert: mocks.audit };
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: table === "committee_roles" ? { id: "role-leader", code: mocks.roleCode, role_group: "executive", title: "Leader" } : { id: "term-7", term_kind: "executive", title: "Current committee" }, error: null }) }) }) };
    } });
  });
describe("committee leadership speech", () => {
  it.each(["president", "general-secretary"])("persists a trimmed public quote for %s, audits and refreshes", async (role) => {
    mocks.roleCode=role;
    await expect(saveCommitteeAssignment(form("  Serve with integrity.  "))).rejects.toThrow("redirect:/admin/committee");
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ speech: "Serve with integrity.", member_id: "member-1", term_id: "term-7" }));
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "committee.assignment_created", actor_user_id: "operator-1" }));
    expect(mocks.revalidate).toHaveBeenCalledWith("/committee");
  });
  it("preserves a quote when an older form omits the new field", async () => { const data=form("",true); data.delete("speech"); await expect(saveCommitteeAssignment(data)).rejects.toThrow("redirect:/admin/committee"); expect(mocks.save.mock.calls[0]?.[0]).not.toHaveProperty("speech"); });
  it("accepts 160 characters and permits clearing an existing quote", async () => {
    await expect(saveCommitteeAssignment(form("a".repeat(160), true))).rejects.toThrow("redirect:/admin/committee");
    expect(mocks.save).toHaveBeenLastCalledWith(expect.objectContaining({ speech: "a".repeat(160) }));
    await expect(saveCommitteeAssignment(form("", true))).rejects.toThrow("redirect:/admin/committee");
    expect(mocks.save).toHaveBeenLastCalledWith(expect.objectContaining({ speech: null }));
  });
  it("rejects excessive quotes before any privileged write", async () => {
    await expect(saveCommitteeAssignment(form("a".repeat(161)))).rejects.toThrow("redirect:/admin/committee");
    expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("does not accept a quote for a forged non-spokesperson role", async () => {
    mocks.roleCode="vice-president";
    await expect(saveCommitteeAssignment(form("A quote"))).rejects.toThrow("redirect:/admin/committee");
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("preserves normal non-spokesperson edits with no quote", async () => {
    mocks.roleCode="treasurer";
    await expect(saveCommitteeAssignment(form(""))).rejects.toThrow("redirect:/admin/committee");
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ speech: null }));
  });
  it("denies an unauthorized operator before opening the privileged client", async () => {
    mocks.permission.mockRejectedValue(new Error("denied"));
    await expect(saveCommitteeAssignment(form("quote"))).rejects.toThrow("denied");
    expect(mocks.client).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled();
  });
});

describe("advisor board archive", () => {
  it("archives visibility/current status, preserves identity, audits and revalidates", async () => {
    const data=new FormData(); data.set("advisorId","aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    await expect(archiveAdvisorProfile(data)).rejects.toThrow("redirect:/admin/committee");
    expect(mocks.save).toHaveBeenCalledWith({ is_current:false, is_public:false });
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({action:"committee.advisor_archived",actor_user_id:"operator-1"}));
    expect(mocks.revalidate).toHaveBeenCalledWith("/committee");
  });
  it("rejects an invalid advisor identifier before opening the service client", async () => {
    const data=new FormData(); data.set("advisorId","invalid");
    await expect(archiveAdvisorProfile(data)).rejects.toThrow("redirect:/admin/committee");
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("denies unauthorized archive before opening the privileged client", async () => {
    mocks.permission.mockRejectedValueOnce(new Error("denied"));
    await expect(archiveAdvisorProfile(new FormData())).rejects.toThrow("denied");
    expect(mocks.client).not.toHaveBeenCalled();
  });
});

describe("advisor management fields", () => {
  it.each(["main_advisor", "moderator_mentor", "honorable_advisor"])("saves all card fields and zero sort order for %s", async (advisorType) => {
    const data = new FormData();
    Object.entries({ advisorId: "advisor-1", advisorJnuitsId: "JNUITS-CA0001", advisorType,
      fullName: "Fixture Faculty", title: "Professor", designation: "Chairman", department: "CSE",
      bio: "Public responsibility", speech: "Public welcome", statusNote: "Current faculty advisor",
      joinedOn: "2025-01-01", leftOn: "", isCurrent: "true", isPublic: "true", dateConfidence: "verified",
      jnuProfileUrl: "https://jnu.ac.bd/faculty/example", avatarSecureUrl: "https://example.test/portrait.png",
      sortOrder: "0", tenureDisplay: "Serving since 2025", userId: "linked-user" }).forEach(([k,v]) => data.set(k,v));
    await expect(saveAdvisorProfile(data)).rejects.toThrow("redirect:/admin/committee");
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ advisor_type: advisorType,
      full_name: "Fixture Faculty", title: "Professor", designation: "Chairman", department: "CSE",
      bio: "Public responsibility", speech: "Public welcome", status_note: "Current faculty advisor",
      joined_on: "2025-01-01", left_on: null, is_current: true, is_public: true, sort_order: 0,
      jnu_profile_url: "https://jnu.ac.bd/faculty/example", avatar_secure_url: "https://example.test/portrait.png",
      tenure_display: "Serving since 2025" }));
    expect(mocks.save.mock.calls[0][0]).not.toHaveProperty("user_id");
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "committee.advisor_updated" }));
    expect(mocks.revalidate).toHaveBeenCalledWith("/committee");
  });
});
