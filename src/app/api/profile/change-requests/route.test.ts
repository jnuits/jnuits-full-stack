import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ read: vi.fn(), insert: vi.fn(), rpc: vi.fn(), stepUp: vi.fn(), auth: vi.fn() }));
vi.mock("@/lib/security/with-api-guard", () => ({ withApiGuard: (handler: (request: NextRequest) => Promise<Response>) => handler }));
vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
vi.mock("@/lib/auth/step-up", () => ({ isStepUpActiveForUser: mocks.stepUp }));
vi.mock("@/lib/departments.server", () => ({ isActiveDepartmentCode: async () => true }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mocks.auth } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc, from: (table: string) => {
  const query = { select: () => query, eq: () => query, in: () => query, order: () => query, limit: () => query,
    maybeSingle: table === "members" ? mocks.read : async () => ({ data: null, error: null }),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve),
    insert: (value: unknown) => { mocks.insert(table, value); return { select: () => ({ single: async () => ({ data: { id: "request" }, error: null }) }) }; },
  }; return query;
} }) }));
vi.mock("@/lib/supabase/flexible", () => ({ asFlexibleClient: (client: unknown) => client }));
import { GET, POST } from "./route";
const member = { id: "11111111-1111-4111-8111-111111111111", full_name: "Fictional Member", lifecycle_status: "current", portal_access_status: "active", current_membership_path_status: "open" };
const request = () => new NextRequest("http://localhost/api/profile/change-requests", { method: "POST", body: JSON.stringify({ fullName: "Updated Fictional Member" }) });
describe("profile change request membership boundary", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.stepUp.mockReturnValue(true); mocks.auth.mockResolvedValue({ data: { user: { id: "owner" } }, error: null }); mocks.read.mockResolvedValue({ data: member, error: null }); mocks.rpc.mockResolvedValue({ data: { status: "reconciled", transitioned: 0 }, error: null }); });
  it("denies missed-Cron expired members before creating a request", async () => {
    mocks.read.mockResolvedValueOnce({ data: member, error: null }).mockResolvedValue({ data: { ...member, lifecycle_status: "former" }, error: null });
    expect((await POST(request(), { params: Promise.resolve({}) })).status).toBe(423);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it.each(["departure_requested", "closed_appealable", "closed_final"])("does not return normal profile data for current/%s", async (path) => {
    mocks.read.mockResolvedValue({ data: { ...member, current_membership_path_status: path }, error: null });
    expect((await GET()).status).toBe(423);
    expect((await POST(request(), { params: Promise.resolve({}) })).status).toBe(423);
  });
  it("fails closed on reconciliation errors", async () => {
    mocks.rpc.mockRejectedValue(new Error("private transport failure"));
    expect((await POST(request(), { params: Promise.resolve({}) })).status).toBe(503);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("refuses identity requests without password unlock", async () => {
    mocks.stepUp.mockReturnValue(false);
    expect((await POST(request(), { params: Promise.resolve({}) })).status).toBe(403);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("refuses a revoked session before loading or submitting profile data", async () => {
    mocks.auth.mockResolvedValue({ data: { user: null }, error: new Error("revoked session") });
    expect((await GET()).status).toBe(401);
    expect((await POST(request(), { params: Promise.resolve({}) })).status).toBe(401);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("keeps mutable requests owned by the authenticated identity", async () => {
    expect((await POST(request(), { params: Promise.resolve({}) })).status).toBe(201);
    expect(mocks.insert).toHaveBeenCalledWith("profile_update_requests", expect.objectContaining({ member_id: member.id, request_type: "profile_change" }));
    expect((await GET()).status).toBe(200);
  });
  it("submits academic changes for review without updating the member", async () => {
    const payload = { requestType: "profile_change", studentId: "ST-NEW", batchNo: 18, graduationYear: 2027 };
    expect((await POST(new NextRequest("http://localhost/api/profile/change-requests", { method: "POST", body: JSON.stringify(payload) }), { params: Promise.resolve({}) })).status).toBe(201);
    expect(mocks.insert).toHaveBeenCalledWith("profile_update_requests", expect.objectContaining({ member_id: member.id, request_type: "profile_change", payload }));
  });
  it.each([{ phone: "01700000000" }, { currentOrganization: "Org" }, { graduationYear: 2200 }, { batchNo: "18" }, { fullName: "Valid Name", role: "super_admin" }])("rejects invalid or routine identity-request fields %j", async (payload) => {
    expect((await POST(new NextRequest("http://localhost/api/profile/change-requests", { method: "POST", body: JSON.stringify(payload) }), { params: Promise.resolve({}) })).status).toBe(400);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
