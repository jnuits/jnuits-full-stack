import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createBulkOperationTemplate: vi.fn(),
  requireAdminApiPermission: vi.fn(),
}));

vi.mock("@/lib/admin/api-auth", () => ({
  requireAdminApiPermission: mocks.requireAdminApiPermission,
}));
vi.mock("@/lib/admin/bulk-operation-templates", () => ({
  BULK_OPERATION_TYPES: [
    "legacy_member_import",
    "member_invite",
    "alumni_invite",
    "lifecycle_update",
    "role_update",
    "alumni_conversion",
    "account_deletion_review",
  ],
  createBulkOperationTemplate: mocks.createBulkOperationTemplate,
}));

import { GET } from "./route";

function request(query: string) {
  return new NextRequest(
    `https://jnuits.example.test/api/admin/bulk-operations/template?${query}`
  );
}

describe("admin bulk-operation template route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminApiPermission.mockResolvedValue({
      auth: { user: { id: "11111111-1111-4111-8111-111111111111" } },
    });
    mocks.createBulkOperationTemplate.mockReturnValue({
      body: "JnUITS ID,Decision\r\n",
      contentType: "text/csv; charset=utf-8",
      filename: "jnuits-account-deletion-review-blank.csv",
    });
  });

  it("uses the existing bulk-management permission and returns a private download", async () => {
    const response = await GET(
      request("operationType=account_deletion_review&kind=blank&format=csv")
    );

    expect(response.status).toBe(200);
    expect(mocks.requireAdminApiPermission).toHaveBeenCalledWith(
      "admin.bulk.manage",
      expect.objectContaining({ forbiddenMessage: expect.any(String) })
    );
    expect(mocks.createBulkOperationTemplate).toHaveBeenCalledWith({
      format: "csv",
      kind: "blank",
      operationType: "account_deletion_review",
    });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="jnuits-account-deletion-review-blank.csv"'
    );
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("rejects unsupported operation, artifact, and format values", async () => {
    const response = await GET(
      request("operationType=committee_publish&kind=production&format=pdf")
    );

    expect(response.status).toBe(400);
    expect(mocks.requireAdminApiPermission).not.toHaveBeenCalled();
    expect(mocks.createBulkOperationTemplate).not.toHaveBeenCalled();
  });

  it("does not generate a file when permission is denied", async () => {
    mocks.requireAdminApiPermission.mockResolvedValue({
      response: NextResponse.json({ message: "Forbidden." }, { status: 403 }),
    });

    const response = await GET(
      request("operationType=legacy_member_import&kind=sample&format=xlsx")
    );

    expect(response.status).toBe(403);
    expect(mocks.createBulkOperationTemplate).not.toHaveBeenCalled();
  });
});
