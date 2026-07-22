import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getFormPublicationError: vi.fn(),
  publishFormVersion: vi.fn(),
  requireAdminApiPermission: vi.fn(),
}));

vi.mock("@/lib/admin/api-auth", () => ({
  requireAdminApiPermission: mocks.requireAdminApiPermission,
}));

vi.mock("@/lib/forms/management", () => ({
  getFormPublicationError: mocks.getFormPublicationError,
  publishFormVersion: mocks.publishFormVersion,
}));

vi.mock("@/lib/security/with-api-guard", () => ({
  withApiGuard: <T>(handler: T) => handler,
}));

import { POST } from "./route";

const formId = "11111111-1111-4111-8111-111111111111";
const versionId = "22222222-2222-4222-8222-222222222222";

function request(body: unknown) {
  return new NextRequest(`https://jnuits.example.test/api/admin/forms/${formId}/publish`, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

describe("admin form publish route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getFormPublicationError.mockResolvedValue(null);
    mocks.publishFormVersion.mockResolvedValue({
      formDefinitionId: formId,
      formVersionId: versionId,
    });
    mocks.requireAdminApiPermission.mockResolvedValue({
      auth: { user: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } },
    });
  });

  it("publishes an immutable draft version through the dedicated permission", async () => {
    const response = await POST(request({ formVersionId: versionId }), {
      params: Promise.resolve({ formId }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      formDefinitionId: formId,
      formVersionId: versionId,
      success: true,
    });
    expect(mocks.requireAdminApiPermission).toHaveBeenCalledWith("cms.forms.publish");
    expect(mocks.getFormPublicationError).toHaveBeenCalledWith(formId);
    expect(mocks.publishFormVersion).toHaveBeenCalledWith({
      actorUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      formDefinitionId: formId,
      formVersionId: versionId,
    });
  });

  it("returns a safe compatibility error before calling the publish RPC", async () => {
    mocks.getFormPublicationError.mockResolvedValue(
      "The linked event must use internal registration."
    );

    const response = await POST(request({ formVersionId: versionId }), {
      params: Promise.resolve({ formId }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "The linked event must use internal registration.",
    });
    expect(mocks.publishFormVersion).not.toHaveBeenCalled();
  });

  it("rejects malformed version identifiers before publishing", async () => {
    const response = await POST(request({ formVersionId: "not-a-uuid" }), {
      params: Promise.resolve({ formId }),
    });

    expect(response.status).toBe(422);
    expect(mocks.publishFormVersion).not.toHaveBeenCalled();
  });
});
