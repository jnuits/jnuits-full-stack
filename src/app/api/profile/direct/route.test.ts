import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn(), rpc: vi.fn(), stepUp: vi.fn() }));
vi.mock("@/lib/security/with-api-guard", () => ({ withApiGuard: (handler: (request: NextRequest, context: { userId: string }) => Promise<Response>) => (request: NextRequest) => handler(request, { userId: "owner" }) }));
vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/step-up", () => ({ isStepUpActiveForUser: mocks.stepUp }));
vi.mock("@/lib/committee/revalidation", () => ({ revalidatePublicCommitteeProjection: vi.fn() }));
vi.mock("@/lib/departments.server", () => ({ isActiveDepartmentCode: async () => true }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc, from: () => {
  const query = { select: () => query, eq: () => query, maybeSingle: mocks.read, update: (data: unknown) => { mocks.write(data); return { eq: async () => ({ error: null }) }; }, insert: async () => ({ error: null }) }; return query;
} }) }));
vi.mock("@/lib/supabase/flexible", () => ({ asFlexibleClient: (client: unknown) => client }));
import { POST } from "./route";
const member = { id: "11111111-1111-4111-8111-111111111111", full_name: "Fictional Member", lifecycle_status: "current", portal_access_status: "active", current_membership_path_status: "open" };
const request = () => new NextRequest("http://localhost/api/profile/direct", { method: "POST", body: JSON.stringify({ phone: "+8801700000001" }) });

describe("approved self-service field policy", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.stepUp.mockReturnValue(true); mocks.read.mockResolvedValue({ data: { ...member, lifecycle_status: "alumni" }, error: null }); mocks.rpc.mockResolvedValue({ data: { id: member.id, changedFields: ["phone"] }, error: null }); });
  const post = (body: object) => POST(new NextRequest("http://localhost/api/profile/direct", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({}) });
  it.each(["fullName", "jnuitsId", "email", "studentId", "departmentCode", "batchNo", "graduationYear", "lifecycleStatus", "portalAccessStatus", "memberId"])("rejects %s even alongside a permitted change", async (field) => {
    expect((await post({ phone: "+8801700000000", [field]: field === "graduationYear" ? 2027 : "forged" })).status).toBe(400);
    expect(mocks.write).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("saves workplace details immediately for an unlocked alumni profile", async () => {
    const response = await post({ currentOrganization: "Fictional Org", designation: "Engineer", workLocation: "Dhaka", professionalVisibility: "private" });
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("apply_member_self_profile_update", { p_user_id: "owner", p_patch: { currentOrganization: "Fictional Org", designation: "Engineer", workLocation: "Dhaka", professionalVisibility: "private" } });
  });
});
describe("direct profile membership boundary", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.stepUp.mockReturnValue(true); mocks.read.mockResolvedValue({ data: member, error: null }); mocks.rpc.mockImplementation(async (name: string) => ({ data: name === "reconcile_membership_lifecycle" ? { status: "reconciled", transitioned: 0 } : { id: member.id, changedFields: ["phone"] }, error: null })); });
  it("blocks an expired stored-current member after owned reconciliation", async () => {
    mocks.read.mockResolvedValueOnce({ data: member, error: null }).mockResolvedValue({ data: { ...member, lifecycle_status: "former" }, error: null });
    expect((await POST(request(), { params: Promise.resolve({}) })).status).toBe(423);
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it.each(["departure_requested", "closed_appealable", "closed_final"])("blocks normal edits for a current/%s row", async (path) => {
    mocks.read.mockResolvedValue({ data: { ...member, current_membership_path_status: path }, error: null });
    expect((await POST(request(), { params: Promise.resolve({}) })).status).toBe(423);
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("fails safely when reconciliation is unavailable", async () => {
    mocks.rpc.mockRejectedValue(new Error("private transport failure"));
    const response = await POST(request(), { params: Promise.resolve({}) });
    expect(response.status).toBe(503); expect(await response.text()).not.toContain("private transport");
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("preserves paid/grace edits and step-up protection", async () => {
    expect((await POST(request(), { params: Promise.resolve({}) })).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("apply_member_self_profile_update", { p_user_id: "owner", p_patch: { phone: "+8801700000001" } });
    mocks.write.mockClear(); mocks.stepUp.mockReturnValue(false);
    expect((await POST(request(), { params: Promise.resolve({}) })).status).toBe(403);
    expect(mocks.write).not.toHaveBeenCalled();
  });
});
