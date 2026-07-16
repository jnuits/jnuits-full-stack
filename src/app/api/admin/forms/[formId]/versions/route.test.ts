import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createFormDraftVersion: vi.fn(),
  loadFormManagementContext: vi.fn(),
  requireAdminApiPermission: vi.fn(),
}));

vi.mock("@/lib/admin/api-auth", () => ({
  requireAdminApiPermission: mocks.requireAdminApiPermission,
}));

vi.mock("@/lib/forms/management", () => ({
  createFormDraftVersion: mocks.createFormDraftVersion,
  loadFormManagementContext: mocks.loadFormManagementContext,
}));

vi.mock("@/lib/security/with-api-guard", () => ({
  withApiGuard: <T>(handler: T) => handler,
}));

import { POST } from "./route";

const formId = "11111111-1111-4111-8111-111111111111";

function request(body: unknown) {
  return new NextRequest(`https://jnuits.example.test/api/admin/forms/${formId}/versions`, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

describe("admin form draft version route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createFormDraftVersion.mockResolvedValue("22222222-2222-4222-8222-222222222222");
    mocks.loadFormManagementContext.mockResolvedValue({
      id: formId,
      kind: "membership_application",
      lifecycle: "published",
      linkedEventId: null,
    });
    mocks.requireAdminApiPermission.mockResolvedValue({
      auth: { user: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } },
    });
  });

  it("creates a new validated draft version instead of mutating a published version", async () => {
    const response = await POST(request({
      applicationBehavior: { fieldMapping: { email: "email", fullName: "full_name" } },
      definition: {
        fields: [
          { id: "full_name", label: "Full name", required: true, type: "text" },
          { id: "email", label: "Email", required: true, type: "email" },
        ],
        payment: { enabled: false },
      },
    }), {
      params: Promise.resolve({ formId }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      formVersionId: "22222222-2222-4222-8222-222222222222",
    });
    expect(mocks.createFormDraftVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        formDefinitionId: formId,
      })
    );
  });

  it("does not create a draft for archived or missing forms", async () => {
    mocks.loadFormManagementContext.mockResolvedValue(null);

    const response = await POST(request({}), {
      params: Promise.resolve({ formId }),
    });

    expect(response.status).toBe(404);
    expect(mocks.createFormDraftVersion).not.toHaveBeenCalled();
  });
});
