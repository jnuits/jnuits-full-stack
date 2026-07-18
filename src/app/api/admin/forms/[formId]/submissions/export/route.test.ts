import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  admin: { from: vi.fn() },
  requireAdminApiPermission: vi.fn(),
}));

vi.mock("@/lib/admin/api-auth", () => ({
  requireAdminApiPermission: mocks.requireAdminApiPermission,
}));

vi.mock("@/lib/integrations/google-drive", () => ({
  uploadGoogleSheetSnapshot: vi.fn(),
}));

vi.mock("@/lib/security/with-api-guard", () => ({
  withApiGuard: <T>(handler: T) => handler,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mocks.admin,
}));

vi.mock("@/lib/supabase/flexible", () => ({
  asFlexibleClient: <T>(client: T) => client,
}));

import { GET } from "./route";

const formId = "11111111-1111-4111-8111-111111111111";

function request() {
  return new NextRequest(
    `https://jnuits.example.test/api/admin/forms/${formId}/submissions/export?format=csv`
  );
}

describe("form submission export route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminApiPermission.mockResolvedValue({
      auth: { user: { id: "22222222-2222-4222-8222-222222222222" } },
      response: null,
    });

    const formQuery = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: formId, title: "Membership" },
        error: null,
      }),
      select: vi.fn().mockReturnThis(),
    };
    const submissionsQuery = {
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: [
          {
            answers: { full_name: "=formula" },
            confirmation_status: "confirmed",
            created_at: "2026-07-18T06:00:00.000Z",
            form_submission_assets: [],
            form_version_id: "33333333-3333-4333-8333-333333333333",
            id: "44444444-4444-4444-8444-444444444444",
            review_status: "approved",
            submitter_email: "member@example.test",
          },
        ],
        error: null,
      }),
      select: vi.fn().mockReturnThis(),
    };

    mocks.admin.from.mockImplementation((table: string) => {
      if (table === "form_definitions") return formQuery;
      if (table === "form_submissions") return submissionsQuery;
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    });
  });

  it("exports only approved submissions and records the checked export", async () => {
    const response = await GET(request(), {
      params: Promise.resolve({ formId }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Export-Row-Count")).toBe("1");
    expect(response.headers.get("Content-Type")).toContain("text/csv");
    await expect(response.text()).resolves.toContain("'=formula");
    expect(mocks.admin.from).toHaveBeenCalledWith("form_export_jobs");
    expect(mocks.admin.from).toHaveBeenCalledWith("audit_events");
  });
});
