import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listFormSubmissionsForReview: vi.fn(),
  requireAdminApiPermission: vi.fn(),
}));

vi.mock("@/lib/admin/api-auth", () => ({
  requireAdminApiPermission: mocks.requireAdminApiPermission,
}));
vi.mock("@/lib/forms/review", () => ({
  FORM_REVIEW_STATUSES: ["unreviewed", "in_review", "approved", "rejected", "withdrawn"],
  listFormSubmissionsForReview: mocks.listFormSubmissionsForReview,
}));
vi.mock("@/lib/security/with-api-guard", () => ({
  withApiGuard: <T>(handler: T) => handler,
}));

import { GET } from "./route";

const formId = "11111111-1111-4111-8111-111111111111";

describe("form submission review list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminApiPermission.mockResolvedValue({ auth: { user: { id: "user-1" } } });
    mocks.listFormSubmissionsForReview.mockResolvedValue({ items: [], totalItems: 0 });
  });

  it("uses review permission and bounded pagination", async () => {
    const response = await GET(
      new NextRequest(
        `https://jnuits.test/api/admin/forms/${formId}/submissions?page=2&pageSize=999&status=in_review&q=member`
      ),
      { params: Promise.resolve({ formId }) }
    );

    expect(response.status).toBe(200);
    expect(mocks.requireAdminApiPermission).toHaveBeenCalledWith("admin.forms.review");
    expect(mocks.listFormSubmissionsForReview).toHaveBeenCalledWith({
      formDefinitionId: formId,
      page: 2,
      pageSize: 100,
      query: "member",
      status: "in_review",
    });
  });

  it("rejects unknown review states", async () => {
    const response = await GET(
      new NextRequest(
        `https://jnuits.test/api/admin/forms/${formId}/submissions?status=deleted`
      ),
      { params: Promise.resolve({ formId }) }
    );
    expect(response.status).toBe(422);
    expect(mocks.listFormSubmissionsForReview).not.toHaveBeenCalled();
  });
});
