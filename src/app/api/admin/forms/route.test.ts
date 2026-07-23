import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createFormDraft: vi.fn(),
  listForms: vi.fn(),
  requireAdminApiPermission: vi.fn(),
}));

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApiPermission: mocks.requireAdminApiPermission }));
vi.mock("@/lib/forms/management", () => ({ createFormDraft: mocks.createFormDraft, listForms: mocks.listForms }));
vi.mock("@/lib/security/with-api-guard", () => ({ withApiGuard: <T>(handler: T) => handler }));

import { GET, POST } from "./route";

function request(body: unknown) {
  return new NextRequest("https://jnuits.example.test/api/admin/forms", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

const membershipPayload = {
  applicationBehavior: { fieldMapping: { email: "email", fullName: "full_name" } },
  definition: {
    fields: [
      { id: "full_name", label: "Full name", required: true, type: "text" },
      { id: "email", label: "Email", required: true, type: "email" },
    ],
    payment: { enabled: false },
  },
  kind: "membership_application",
  slug: "membership-2026",
  title: "Membership application",
};

describe("admin form routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createFormDraft.mockResolvedValue({
      formDefinitionId: "11111111-1111-4111-8111-111111111111",
      formVersionId: "22222222-2222-4222-8222-222222222222",
    });
    mocks.listForms.mockResolvedValue({ items: [], totalItems: 0 });
    mocks.requireAdminApiPermission.mockResolvedValue({
      auth: { roles: ["admin"], user: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } },
    });
  });

  it("creates a validated membership form for an admin", async () => {
    const response = await POST(request(membershipPayload), { params: Promise.resolve({}) });
    expect(response.status).toBe(201);
    expect(mocks.createFormDraft).toHaveBeenCalledWith(expect.objectContaining({ kind: "membership_application" }));
  });

  it("denies content admins from creating membership forms", async () => {
    mocks.requireAdminApiPermission.mockResolvedValue({
      auth: { roles: ["content_admin"], user: { id: "content-user" } },
    });
    const response = await POST(request(membershipPayload), { params: Promise.resolve({}) });
    expect(response.status).toBe(403);
    expect(mocks.createFormDraft).not.toHaveBeenCalled();
  });

  it("scopes content-admin inventory to event forms", async () => {
    mocks.requireAdminApiPermission.mockResolvedValue({
      auth: { roles: ["content_admin"], user: { id: "content-user" } },
    });
    const response = await GET(
      new NextRequest("https://jnuits.example.test/api/admin/forms?pageSize=200"),
      { params: Promise.resolve({}) }
    );
    expect(response.status).toBe(200);
    expect(mocks.listForms).toHaveBeenCalledWith({
      kind: "event_registration",
      page: 1,
      pageSize: 100,
      query: "",
    });
  });

  it("rejects an explicit non-event inventory query from content admins", async () => {
    mocks.requireAdminApiPermission.mockResolvedValue({
      auth: { roles: ["content_admin"], user: { id: "content-user" } },
    });
    const response = await GET(
      new NextRequest("https://jnuits.example.test/api/admin/forms?kind=alumni_onboarding"),
      { params: Promise.resolve({}) }
    );
    expect(response.status).toBe(403);
    expect(mocks.listForms).not.toHaveBeenCalled();
  });
});
