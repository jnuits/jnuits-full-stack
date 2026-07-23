import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminApiPermission: vi.fn(),
  transitionFormLifecycle: vi.fn(),
}));

vi.mock("@/lib/admin/api-auth", () => ({
  requireAdminApiPermission: mocks.requireAdminApiPermission,
}));
vi.mock("@/lib/forms/lifecycle", () => ({
  FORM_LIFECYCLE_TARGETS: ["published", "closed", "archived"],
  transitionFormLifecycle: mocks.transitionFormLifecycle,
}));
vi.mock("@/lib/security/with-api-guard", () => ({
  withApiGuard: <T>(handler: T) => handler,
}));

import { POST } from "./route";

const formId = "11111111-1111-4111-8111-111111111111";

function request(body: unknown) {
  return new NextRequest(
    `https://jnuits.example.test/api/admin/forms/${formId}/lifecycle`,
    {
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }
  );
}

describe("admin form lifecycle route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminApiPermission.mockResolvedValue({
      auth: { user: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } },
    });
    mocks.transitionFormLifecycle.mockResolvedValue({
      currentPublishedVersionId: "22222222-2222-4222-8222-222222222222",
      formDefinitionId: formId,
      lifecycle: "closed",
    });
  });

  it("closes a form through the publish permission boundary", async () => {
    const response = await POST(request({ target: "closed" }), {
      params: Promise.resolve({ formId }),
    });

    expect(response.status).toBe(200);
    expect(mocks.requireAdminApiPermission).toHaveBeenCalledWith(
      "cms.forms.publish"
    );
    expect(mocks.transitionFormLifecycle).toHaveBeenCalledWith({
      actorUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      formDefinitionId: formId,
      target: "closed",
    });
  });

  it("rejects unsupported lifecycle values", async () => {
    const response = await POST(request({ target: "draft" }), {
      params: Promise.resolve({ formId }),
    });

    expect(response.status).toBe(422);
    expect(mocks.transitionFormLifecycle).not.toHaveBeenCalled();
  });

  it("preserves the authorization response", async () => {
    mocks.requireAdminApiPermission.mockResolvedValue({
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });

    const response = await POST(request({ target: "archived" }), {
      params: Promise.resolve({ formId }),
    });

    expect(response.status).toBe(403);
    expect(mocks.transitionFormLifecycle).not.toHaveBeenCalled();
  });
});
