import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createCertificateImportTemplate: vi.fn(),
  requireAdminApiPermission: vi.fn(),
}));

vi.mock("@/lib/admin/api-auth", () => ({
  requireAdminApiPermission: mocks.requireAdminApiPermission,
}));
vi.mock("@/lib/certificates/admin-import", () => ({
  createCertificateImportTemplate: mocks.createCertificateImportTemplate,
}));

import { GET } from "./route";

function request(query: string) {
  return new NextRequest(
    `https://jnuits.example.test/api/admin/certificates/import-template?${query}`
  );
}

describe("admin certificate import-template route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminApiPermission.mockResolvedValue({
      auth: { user: { id: "11111111-1111-4111-8111-111111111111" } },
    });
    mocks.createCertificateImportTemplate.mockReturnValue({
      body: "Certificate ID,Full name\r\n",
      contentType: "text/csv; charset=utf-8",
      filename: "jnuits-certificate-import-blank.csv",
    });
  });

  it("uses certificate-management permission and returns a private download", async () => {
    const response = await GET(request("kind=blank&format=csv"));

    expect(response.status).toBe(200);
    expect(mocks.requireAdminApiPermission).toHaveBeenCalledWith(
      "admin.certificates.manage",
      expect.objectContaining({ forbiddenMessage: expect.any(String) })
    );
    expect(mocks.createCertificateImportTemplate).toHaveBeenCalledWith({
      format: "csv",
      kind: "blank",
    });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="jnuits-certificate-import-blank.csv"'
    );
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("rejects unsupported artifact and format values", async () => {
    const response = await GET(request("kind=combined&format=pdf"));

    expect(response.status).toBe(400);
    expect(mocks.requireAdminApiPermission).not.toHaveBeenCalled();
    expect(mocks.createCertificateImportTemplate).not.toHaveBeenCalled();
  });

  it("does not generate a file when permission is denied", async () => {
    mocks.requireAdminApiPermission.mockResolvedValue({
      response: NextResponse.json({ message: "Forbidden." }, { status: 403 }),
    });

    const response = await GET(request("kind=sample&format=xlsx"));

    expect(response.status).toBe(403);
    expect(mocks.createCertificateImportTemplate).not.toHaveBeenCalled();
  });
});
