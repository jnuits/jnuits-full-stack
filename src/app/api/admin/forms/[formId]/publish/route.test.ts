import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getFormPublicationError: vi.fn(),
  loadFormManagementContext: vi.fn(),
  publishFormVersion: vi.fn(),
  requireAdminApiPermission: vi.fn(),
}));
vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApiPermission: mocks.requireAdminApiPermission }));
vi.mock("@/lib/forms/management", () => ({
  getFormPublicationError: mocks.getFormPublicationError,
  loadFormManagementContext: mocks.loadFormManagementContext,
  publishFormVersion: mocks.publishFormVersion,
}));
vi.mock("@/lib/security/with-api-guard", () => ({ withApiGuard: <T>(handler: T) => handler }));

import { POST } from "./route";
const formId = "11111111-1111-4111-8111-111111111111";
const versionId = "22222222-2222-4222-8222-222222222222";
function request() {
  return new NextRequest(`https://jnuits.test/api/admin/forms/${formId}/publish`, {
    body: JSON.stringify({ formVersionId: versionId }), headers: { "Content-Type": "application/json" }, method: "POST",
  });
}

describe("form publication authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminApiPermission.mockResolvedValue({ auth: { roles: ["admin"], user: { id: "admin-user" } } });
    mocks.loadFormManagementContext.mockResolvedValue({ id: formId, kind: "membership_application", lifecycle: "draft", linkedEventId: null });
    mocks.getFormPublicationError.mockResolvedValue(null);
    mocks.publishFormVersion.mockResolvedValue({ formDefinitionId: formId, formVersionId: versionId });
  });

  it("publishes membership forms for admins", async () => {
    const response = await POST(request(), { params: Promise.resolve({ formId }) });
    expect(response.status).toBe(200);
    expect(mocks.publishFormVersion).toHaveBeenCalled();
  });

  it("denies content admins from publishing membership forms", async () => {
    mocks.requireAdminApiPermission.mockResolvedValue({ auth: { roles: ["content_admin"], user: { id: "content-user" } } });
    const response = await POST(request(), { params: Promise.resolve({ formId }) });
    expect(response.status).toBe(403);
    expect(mocks.getFormPublicationError).not.toHaveBeenCalled();
    expect(mocks.publishFormVersion).not.toHaveBeenCalled();
  });
});
