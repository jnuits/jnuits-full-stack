import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createFormDraft: vi.fn(),
  listForms: vi.fn(),
  requireAdminApiPermission: vi.fn(),
}));

vi.mock("@/lib/admin/api-auth", () => ({
  requireAdminApiPermission: mocks.requireAdminApiPermission,
}));

vi.mock("@/lib/forms/management", () => ({
  createFormDraft: mocks.createFormDraft,
  listForms: mocks.listForms,
}));

vi.mock("@/lib/security/with-api-guard", () => ({
  withApiGuard: <T>(handler: T) => handler,
}));

import { POST } from "./route";

function request(body: unknown) {
  return new NextRequest("https://jnuits.example.test/api/admin/forms", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

describe("admin form draft route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createFormDraft.mockResolvedValue({
      formDefinitionId: "11111111-1111-4111-8111-111111111111",
      formVersionId: "22222222-2222-4222-8222-222222222222",
    });
    mocks.listForms.mockResolvedValue({ items: [], totalItems: 0 });
    mocks.requireAdminApiPermission.mockResolvedValue({
      auth: { user: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } },
    });
  });

  it("creates a validated membership form as a version-one draft", async () => {
    const response = await POST(request({
      applicationBehavior: {
        fieldMapping: { email: "email", fullName: "full_name", studentId: "student_id" },
      },
      definition: {
        fields: [
          { id: "full_name", label: "Full name", required: true, type: "text" },
          { id: "email", label: "Email", required: true, type: "email" },
          { id: "student_id", label: "Student ID", required: false, type: "text" },
        ],
        payment: { enabled: false },
      },
      description: "Student membership intake",
      kind: "membership_application",
      slug: "membership-2026",
      title: "Membership application",
    }), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      formDefinitionId: "11111111-1111-4111-8111-111111111111",
      formVersionId: "22222222-2222-4222-8222-222222222222",
    });
    expect(mocks.requireAdminApiPermission).toHaveBeenCalledWith("cms.forms.manage");
    expect(mocks.createFormDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        applicationBehavior: {
          fieldMapping: { email: "email", fullName: "full_name", studentId: "student_id" },
        },
        kind: "membership_application",
        linkedEventId: null,
        slug: "membership-2026",
      })
    );
  });

  it("does not allow a non-event form to link to an event", async () => {
    const response = await POST(request({
      applicationBehavior: { fieldMapping: { email: "email", fullName: "full_name" } },
      definition: {
        fields: [
          { id: "full_name", label: "Full name", required: true, type: "text" },
          { id: "email", label: "Email", required: true, type: "email" },
        ],
        payment: { enabled: false },
      },
      kind: "membership_application",
      linkedEventId: "11111111-1111-4111-8111-111111111111",
      slug: "membership-2026",
      title: "Membership application",
    }), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(422);
    expect(mocks.createFormDraft).not.toHaveBeenCalled();
  });

  it("returns the permission result before reading or writing the form", async () => {
    const denied = new Response(JSON.stringify({ message: "Forbidden" }), { status: 403 });
    mocks.requireAdminApiPermission.mockResolvedValue({ response: denied });

    const response = await POST(request({}), { params: Promise.resolve({}) });

    expect(response.status).toBe(403);
    expect(mocks.createFormDraft).not.toHaveBeenCalled();
  });

  it("lists forms with bounded server-side pagination", async () => {
    mocks.listForms.mockResolvedValue({
      items: [{ id: "form-1", kind: "membership_application", slug: "membership-2026" }],
      totalItems: 1,
    });

    const { GET } = await import("./route");
    const response = await GET(
      new NextRequest("https://jnuits.example.test/api/admin/forms?page=2&pageSize=200&q=member"),
      { params: Promise.resolve({}) }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ page: 2, pageSize: 100, totalItems: 1 });
    expect(mocks.listForms).toHaveBeenCalledWith({
      kind: undefined,
      page: 2,
      pageSize: 100,
      query: "member",
    });
  });
});
