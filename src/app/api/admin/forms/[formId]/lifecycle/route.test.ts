import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadFormManagementContext: vi.fn(),
  requireAdminApiPermission: vi.fn(),
  transitionFormLifecycle: vi.fn(),
}));
vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApiPermission: mocks.requireAdminApiPermission }));
vi.mock("@/lib/forms/lifecycle", () => ({ FORM_LIFECYCLE_TARGETS: ["published", "closed", "archived"], transitionFormLifecycle: mocks.transitionFormLifecycle }));
vi.mock("@/lib/forms/management", () => ({ loadFormManagementContext: mocks.loadFormManagementContext }));
vi.mock("@/lib/security/with-api-guard", () => ({ withApiGuard: <T>(handler: T) => handler }));

import { POST } from "./route";
const formId = "11111111-1111-4111-8111-111111111111";
function request(target: string) {
  return new NextRequest(`https://jnuits.test/api/admin/forms/${formId}/lifecycle`, {
    body: JSON.stringify({ target }), headers: { "Content-Type": "application/json" }, method: "POST",
  });
}

describe("form lifecycle authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminApiPermission.mockResolvedValue({ auth: { roles: ["admin"], user: { id: "admin-user" } } });
    mocks.loadFormManagementContext.mockResolvedValue({ id: formId, kind: "alumni_onboarding", lifecycle: "published", linkedEventId: null });
    mocks.transitionFormLifecycle.mockResolvedValue({ formDefinitionId: formId, lifecycle: "closed" });
  });

  it("allows admins to close alumni forms", async () => {
    const response = await POST(request("closed"), { params: Promise.resolve({ formId }) });
    expect(response.status).toBe(200);
  });

  it("denies content admins from changing alumni lifecycle", async () => {
    mocks.requireAdminApiPermission.mockResolvedValue({ auth: { roles: ["content_admin"], user: { id: "content-user" } } });
    const response = await POST(request("closed"), { params: Promise.resolve({ formId }) });
    expect(response.status).toBe(403);
    expect(mocks.transitionFormLifecycle).not.toHaveBeenCalled();
  });

  it("preserves the base permission denial", async () => {
    mocks.requireAdminApiPermission.mockResolvedValue({ response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) });
    const response = await POST(request("archived"), { params: Promise.resolve({ formId }) });
    expect(response.status).toBe(403);
    expect(mocks.loadFormManagementContext).not.toHaveBeenCalled();
  });
});
