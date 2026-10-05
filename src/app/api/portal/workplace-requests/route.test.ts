import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ read: vi.fn(), rpc: vi.fn(), cancel: vi.fn(), stepUp: vi.fn() }));
vi.mock("@/lib/security/with-api-guard", () => ({ withApiGuard: (handler: (request: NextRequest, context: { userId: string }) => Promise<Response>) => (request: NextRequest) => handler(request, { userId: "owner" }) }));
vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
vi.mock("@/lib/auth/step-up", () => ({ isStepUpActiveForUser: mocks.stepUp }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc, from: () => { const query = { select: () => query, eq: () => query, order: () => query, limit: async () => ({ data: [], error: null }), maybeSingle: mocks.read }; return query; } }) }));
vi.mock("@/lib/supabase/flexible", () => ({ asFlexibleClient: (client: unknown) => client }));
vi.mock("@/lib/admin/workplace", () => ({ cancelWorkplaceRequest: mocks.cancel }));
vi.mock("@/lib/notifications/send-email", () => ({ sendEmail: vi.fn() }));
import { GET, POST, PATCH } from "./route";
const current = { id: "11111111-1111-4111-8111-111111111111", lifecycle_status: "current", portal_access_status: "active", current_membership_path_status: "open" };
const url = "http://localhost/api/portal/workplace-requests";
describe("workplace request lifecycle boundary inside the guarded handler", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.stepUp.mockReturnValue(true); mocks.read.mockResolvedValue({ data: current, error: null }); mocks.rpc.mockResolvedValue({ data: { status: "reconciled", transitioned: 0 }, error: null }); });
  it("keeps the current/open request list accessible", async () => {
    const response = await GET(new NextRequest(url), { params: Promise.resolve({}) });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: [] });
  });
  it.each(["departure_requested", "closed_appealable", "closed_final"])("refuses GET and POST for a closed/restricted %s path", async (path) => {
    mocks.read.mockResolvedValue({ data: { ...current, current_membership_path_status: path }, error: null });
    expect((await GET(new NextRequest(url), { params: Promise.resolve({}) })).status).toBe(423);
    expect((await POST(new NextRequest(url, { method: "POST", body: JSON.stringify({ designation: "Example" }) }), { params: Promise.resolve({}) })).status).toBe(410);
  });
  it("refuses cancellation too when the member is former", async () => {
    mocks.read.mockResolvedValue({ data: { ...current, lifecycle_status: "former" }, error: null });
    const response = await PATCH(new NextRequest(url, { method: "PATCH", body: JSON.stringify({ action: "cancel", requestId: "example" }) }), { params: Promise.resolve({}) });
    expect(response.status).toBe(423);
    expect(mocks.cancel).not.toHaveBeenCalled();
  });
  it("re-reads after reconciliation before returning normal workplace data", async () => {
    mocks.read.mockResolvedValueOnce({ data: current, error: null }).mockResolvedValue({ data: { ...current, lifecycle_status: "former" }, error: null });
    expect((await GET(new NextRequest(url), { params: Promise.resolve({}) })).status).toBe(423);
  });
  it("does not fallback to active current when critical columns are missing", async () => {
    mocks.read.mockResolvedValue({ data: { id: current.id, current_membership_path_status: "open" }, error: null });
    expect((await GET(new NextRequest(url), { params: Promise.resolve({}) })).status).toBe(423);
  });
});
