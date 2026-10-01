import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  insertedRows: vi.fn(),
  requireAdminPermission: vi.fn(),
  setAdminFlash: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => { throw new Error(`redirect:${path}`); },
}));
vi.mock("@/lib/auth/session", () => ({ requireAdminPermission: mocks.requireAdminPermission }));
vi.mock("@/lib/admin/flash", () => ({ setAdminFlash: mocks.setAdminFlash }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/supabase/flexible", () => ({ asFlexibleClient: (client: unknown) => client }));
vi.mock("@/lib/admin/invitations", () => ({ issueInvitationForMember: vi.fn() }));
vi.mock("@/lib/notifications/send-email", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/notifications/preferences", () => ({ allowsOptionalEmail: vi.fn() }));
vi.mock("@/lib/security/security-events", () => ({ recordSecurityEvent: vi.fn() }));

import { createBulkOperationTemplate } from "@/lib/admin/bulk-operation-templates";
import { previewBulkOperationAction } from "./actions";

const operations = [
  "legacy_member_import", "member_invite", "alumni_invite", "lifecycle_update",
  "role_update", "alumni_conversion", "account_deletion_review",
] as const;

describe("legacy bulk-operation generated sample integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminPermission.mockResolvedValue({ user: { id: "operator-1" } });
    mocks.setAdminFlash.mockResolvedValue(undefined);
    mocks.insertedRows.mockResolvedValue({ error: null });
    mocks.createAdminClient.mockReturnValue({
      from(table: string) {
        if (table === "membership_id_sequences") {
          return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { last_serial: 0 } }) }) }) };
        }
        if (table === "members") {
          return { select: () => ({ in: async (_column: string, values: string[]) => ({
            data: values.includes("JNUITS-2099001") ? [{
              email: "existing.member@example.com", full_name: "Existing Sample Member",
              id: "member-1", is_profile_claimed: false, jnuits_id: "JNUITS-2099001", user_id: "user-1",
            }] : [],
          }) }) };
        }
        if (table === "bulk_operations") {
          return { insert: () => ({ select: () => ({ single: async () => ({ data: { id: "preview-1" }, error: null }) }) }) };
        }
        if (table === "bulk_operation_rows") return { insert: mocks.insertedRows };
        throw new Error(`Unexpected table ${table}`);
      },
      rpc: vi.fn().mockResolvedValue({ error: null }),
    });
  });

  it.each(operations)("recognizes generated %s sample fields in the real preview action", async (operationType) => {
    const template = createBulkOperationTemplate({ format: "csv", kind: "sample", operationType });
    const csv = String(template.body).replaceAll("JNUITS-2099001", operationType === "legacy_member_import" ? "JNUITS-2099003" : "JNUITS-2099001");
    const form = new FormData();
    form.set("operationType", operationType);
    form.set("legacyYearBlock", "2099");
    form.set("csvContent", csv);
    form.set("originalFilename", template.filename);

    await expect(previewBulkOperationAction(form)).rejects.toThrow("redirect:/admin/bulk-operations?operationId=preview-1");
    expect(mocks.insertedRows).toHaveBeenCalledWith([
      expect.objectContaining({
        errors: [], status: "valid", normalized_data: expect.objectContaining({ jnuitsId: expect.stringMatching(/^JNUITS-209900[123]$/) }),
      }),
    ]);
  });
});
