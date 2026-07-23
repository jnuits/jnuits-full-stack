import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listFormSubmissionsForReview: vi.fn(),
  loadFormManagementContext: vi.fn(),
  requireAdminApiPermission: vi.fn(),
}));
vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApiPermission: mocks.requireAdminApiPermission }));
vi.mock("@/lib/forms/management", () => ({ loadFormManagementContext: mocks.loadFormManagementContext }));
vi.mock("@/lib/forms/review", () => ({
  FORM_REVIEW_STATUSES: ["unreviewed", "in_review", "approved", "rejected", "withdrawn"],
  listFormSubmissionsForReview: mocks.listFormSubmissionsForReview,
}));
vi.mock("@/lib/security/with-api-guard", () => ({ withApiGuard: <T>(handler: T) => handler }));

import { GET } from "./route";
const formId = "11111111-1111-4111-8111-111111111111";
function request(query = "") {
  return new NextRequest(`https://jnuits.test/api/admin/forms/${formId}/submissions${query}`);
}

describe("form submission PII authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminApiPermission.mockResolvedValue({ auth: { roles: ["admin"], user: { id: "admin-user" } } });
    mocks.loadFormManagementContext.mockResolvedValue({ id: formId, kind: "membership_application", lifecycle: "published", linkedEventId: null });
    mocks.listFormSubmissionsForReview.mockResolvedValue({ items: [], totalItems: 0 });
  });

  it("uses bounded review queries for admins", async () => {
    const response = await GET(request("?page=2&pageSize=999&status=in_review&q=member"), { params: Promise.resolve({ formId }) });
    expect(response.status).toBe(200);
    expect(mocks.requireAdminApiPermission).toHaveBeenCalledWith("cms.forms.manage");
    expect(mocks.listFormSubmissionsForReview).toHaveBeenCalledWith({
      formDefinitionId: formId, page: 2, pageSize: 100, query: "member", status: "in_review",
    });
  });

  it("denies content admins membership submission PII", async () => {
    mocks.requireAdminApiPermission.mockResolvedValue({ auth: { roles: ["content_admin"], user: { id: "content-user" } } });
    const response = await GET(request(), { params: Promise.resolve({ formId }) });
    expect(response.status).toBe(403);
    expect(mocks.listFormSubmissionsForReview).not.toHaveBeenCalled();
  });

  it("allows content admins to review event submissions", async () => {
    mocks.requireAdminApiPermission.mockResolvedValue({ auth: { roles: ["content_admin"], user: { id: "content-user" } } });
    mocks.loadFormManagementContext.mockResolvedValue({ id: formId, kind: "event_registration", lifecycle: "published", linkedEventId: "event-1" });
    const response = await GET(request(), { params: Promise.resolve({ formId }) });
    expect(response.status).toBe(200);
  });

  it("never loads form context or PII after base permission denial", async () => {
    mocks.requireAdminApiPermission.mockResolvedValue({ response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) });
    const response = await GET(request(), { params: Promise.resolve({ formId }) });
    expect(response.status).toBe(403);
    expect(mocks.loadFormManagementContext).not.toHaveBeenCalled();
    expect(mocks.listFormSubmissionsForReview).not.toHaveBeenCalled();
  });
});
