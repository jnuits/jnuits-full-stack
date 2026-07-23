import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createFormDraftVersion: vi.fn(),
  loadFormEditorContext: vi.fn(),
  loadFormManagementContext: vi.fn(),
  requireAdminApiPermission: vi.fn(),
  updateFormDraftVersion: vi.fn(),
}));
vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApiPermission: mocks.requireAdminApiPermission }));
vi.mock("@/lib/forms/management", () => ({
  createFormDraftVersion: mocks.createFormDraftVersion,
  loadFormEditorContext: mocks.loadFormEditorContext,
  loadFormManagementContext: mocks.loadFormManagementContext,
  updateFormDraftVersion: mocks.updateFormDraftVersion,
}));
vi.mock("@/lib/security/with-api-guard", () => ({ withApiGuard: <T>(handler: T) => handler }));

import { GET, POST } from "./route";
const formId = "11111111-1111-4111-8111-111111111111";

function request(body: unknown) {
  return new NextRequest(`https://jnuits.test/api/admin/forms/${formId}/versions`, {
    body: JSON.stringify(body), headers: { "Content-Type": "application/json" }, method: "POST",
  });
}

const definition = {
  fields: [
    { id: "full_name", label: "Full name", required: true, type: "text" },
    { id: "email", label: "Email", required: true, type: "email" },
  ],
  payment: { enabled: false },
};

describe("form editor authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminApiPermission.mockResolvedValue({ auth: { roles: ["admin"], user: { id: "admin-user" } } });
    mocks.loadFormManagementContext.mockResolvedValue({ id: formId, kind: "membership_application", lifecycle: "published", linkedEventId: null });
    mocks.loadFormEditorContext.mockResolvedValue({ id: formId, kind: "membership_application", lifecycle: "published", version: { id: "version-1" } });
    mocks.createFormDraftVersion.mockResolvedValue("22222222-2222-4222-8222-222222222222");
  });

  it("allows admins to load membership form editors", async () => {
    const response = await GET(new NextRequest(`https://jnuits.test/api/admin/forms/${formId}/versions`), { params: Promise.resolve({ formId }) });
    expect(response.status).toBe(200);
  });

  it("denies content admins from loading membership form editors", async () => {
    mocks.requireAdminApiPermission.mockResolvedValue({ auth: { roles: ["content_admin"], user: { id: "content-user" } } });
    const response = await GET(new NextRequest(`https://jnuits.test/api/admin/forms/${formId}/versions`), { params: Promise.resolve({ formId }) });
    expect(response.status).toBe(403);
  });

  it("denies content admins before creating a membership draft version", async () => {
    mocks.requireAdminApiPermission.mockResolvedValue({ auth: { roles: ["content_admin"], user: { id: "content-user" } } });
    const response = await POST(request({ applicationBehavior: { fieldMapping: { email: "email", fullName: "full_name" } }, definition }), { params: Promise.resolve({ formId }) });
    expect(response.status).toBe(403);
    expect(mocks.createFormDraftVersion).not.toHaveBeenCalled();
  });
});
