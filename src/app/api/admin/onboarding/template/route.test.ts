import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createOnboardingTemplate: vi.fn(),
  getActiveDepartmentCatalog: vi.fn(),
  requireAdminApiPermission: vi.fn(),
}));

vi.mock("@/lib/admin/api-auth", () => ({
  requireAdminApiPermission: mocks.requireAdminApiPermission,
}));
vi.mock("@/lib/committee/onboarding/templates", () => ({
  createOnboardingTemplate: mocks.createOnboardingTemplate,
}));
vi.mock("@/lib/membership/department-catalog", () => ({
  getActiveDepartmentCatalog: mocks.getActiveDepartmentCatalog,
}));

import { GET } from "./route";

function request(query: string) {
  return new NextRequest(`https://jnuits.example.test/api/admin/onboarding/template?${query}`);
}

describe("admin onboarding template route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminApiPermission.mockResolvedValue({
      auth: { user: { id: "11111111-1111-4111-8111-111111111111" } },
    });
    mocks.getActiveDepartmentCatalog.mockResolvedValue([
      { name: "Computer Science & Engineering", shortCode: "CSE" },
    ]);
    mocks.createOnboardingTemplate.mockReturnValue({
      body: "Full name,JnUITS ID\r\n",
      contentType: "text/csv; charset=utf-8",
      filename: "jnuits-committee-roster-import-blank.csv",
    });
  });

  it("uses the fixed committee permission and serves a private download", async () => {
    const response = await GET(
      request("operationType=committee_roster_import&format=csv&permission=admin.membership.manage")
    );

    expect(response.status).toBe(200);
    expect(mocks.requireAdminApiPermission).toHaveBeenCalledWith(
      "admin.committee.manage",
      expect.objectContaining({ forbiddenMessage: expect.any(String) })
    );
    expect(mocks.createOnboardingTemplate).toHaveBeenCalledWith(
      {
        departments: [],
        format: "csv",
        kind: "blank",
        operationType: "committee_roster_import",
      }
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="jnuits-committee-roster-import-blank.csv"'
    );
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(await response.text()).toBe("Full name,JnUITS ID\r\n");
  });

  it("uses membership management permission for member-profile templates", async () => {
    await GET(request("operationType=member_profile_import&format=xlsx"));

    expect(mocks.requireAdminApiPermission).toHaveBeenCalledWith(
      "admin.membership.manage",
      expect.any(Object)
    );
    expect(mocks.createOnboardingTemplate).toHaveBeenCalledWith({
      departments: [],
      format: "xlsx",
      kind: "blank",
      operationType: "member_profile_import",
    });
  });

  it.each(["sample", "department-codes"])(
    "loads the active catalog for %s downloads",
    async (kind) => {
      await GET(
        request(`operationType=member_profile_import&format=xlsx&kind=${kind}`)
      );

      expect(mocks.getActiveDepartmentCatalog).toHaveBeenCalledTimes(1);
      expect(mocks.createOnboardingTemplate).toHaveBeenCalledWith({
        departments: [
          { name: "Computer Science & Engineering", shortCode: "CSE" },
        ],
        format: "xlsx",
        kind,
        operationType: "member_profile_import",
      });
    }
  );

  it("does not query the department catalog for a blank template", async () => {
    await GET(
      request("operationType=member_profile_import&format=csv&kind=blank")
    );

    expect(mocks.getActiveDepartmentCatalog).not.toHaveBeenCalled();
  });

  it("rejects invalid query values without generating a template", async () => {
    const response = await GET(request("operationType=unknown&format=pdf&kind=unsafe"));

    expect(response.status).toBe(400);
    expect(mocks.createOnboardingTemplate).not.toHaveBeenCalled();
  });

  it("short-circuits denied requests before generating a template", async () => {
    mocks.requireAdminApiPermission.mockResolvedValue({
      response: NextResponse.json({ message: "Forbidden." }, { status: 403 }),
    });

    const response = await GET(request("operationType=committee_roster_import&format=csv"));

    expect(response.status).toBe(403);
    expect(mocks.getActiveDepartmentCatalog).not.toHaveBeenCalled();
    expect(mocks.createOnboardingTemplate).not.toHaveBeenCalled();
  });
});
