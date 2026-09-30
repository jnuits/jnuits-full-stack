import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auditInsert: vi.fn(),
  createAdminClient: vi.fn(),
  memberUpdate: vi.fn(),
  requireAdminPermission: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mocks.revalidatePath(...args),
}));
vi.mock("@/lib/auth/session", () => ({
  requireAdminPermission: (...args: unknown[]) => mocks.requireAdminPermission(...args),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mocks.createAdminClient(),
}));
vi.mock("@/lib/supabase/flexible", () => ({
  asFlexibleClient: (client: unknown) => client,
}));

import { updateMemberProfileAction } from "./profile-actions";

const memberId = "11111111-1111-4111-8111-111111111111";
const previousUpdatedAt = "2026-09-26T10:00:00.000Z";
const savedUpdatedAt = "2026-09-26T11:00:00.000Z";

describe("updateMemberProfileAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminPermission.mockResolvedValue({ user: { id: "operator-1" } });
    mocks.auditInsert.mockResolvedValue({ error: null });

    const existing = {
      batch_no: 18,
      department_code: "computer-science-engineering",
      email: "member@example.test",
      facebook_url: null,
      full_name: "Member One",
      id: memberId,
      jnuits_id: "JNUITS-2026001",
      joined_on: "2023-07-01",
      lifecycle_status: "current",
      linkedin_url: null,
      member_type: "current",
      phone: "+8801700000000",
      student_id: "2026001",
      updated_at: previousUpdatedAt,
      website_url: null,
    };
    const saved = { ...existing, full_name: "Member One Updated", updated_at: savedUpdatedAt };
    mocks.memberUpdate.mockReturnValue({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: saved, error: null }),
          })),
        })),
      })),
    });

    const membersTable = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: existing, error: null }),
        })),
      })),
      update: (...args: unknown[]) => mocks.memberUpdate(...args),
    };
    const auditTable = { insert: (...args: unknown[]) => mocks.auditInsert(...args) };
    const departmentsTable = {
      eq: vi.fn(),
      order: vi.fn(),
      select: vi.fn(),
    };
    departmentsTable.select.mockReturnValue(departmentsTable);
    departmentsTable.eq.mockReturnValue(departmentsTable);
    departmentsTable.order.mockResolvedValue({
      data: [
        {
          code: "computer-science-engineering",
          name: "Computer Science & Engineering",
          short_code: "CSE",
        },
      ],
      error: null,
    });
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "members") return membersTable;
        if (table === "audit_events") return auditTable;
        if (table === "departments") return departmentsTable;
        throw new Error(`Unexpected table: ${table}`);
      }),
    });
  });

  it("updates only canonical profile fields and audits the changed field names", async () => {
    const result = await updateMemberProfileAction({
      auditNote: "Corrected spelling from the verified roster.",
      batchNo: "",
      departmentCode: "",
      expectedUpdatedAt: previousUpdatedAt,
      facebookUrl: "",
      fullName: "Member One Updated",
      joinedOn: "2023-07-01",
      linkedinUrl: "",
      memberId,
      phone: "",
      studentId: "",
      websiteUrl: "",
    });

    expect(mocks.requireAdminPermission).toHaveBeenCalledWith(
      "admin.membership.manage",
      { fallbackPath: "/admin/membership" }
    );
    expect(mocks.memberUpdate).toHaveBeenCalledWith({ full_name: "Member One Updated" });
    const updatePayload = mocks.memberUpdate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(updatePayload).not.toHaveProperty("portal_access_status");
    expect(updatePayload).not.toHaveProperty("lifecycle_status");
    expect(updatePayload).not.toHaveProperty("member_type");
    expect(mocks.auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "member.profile_updated",
        actor_user_id: "operator-1",
        entity_id: memberId,
        metadata: expect.objectContaining({
          changedFields: ["full_name"],
          previousUpdatedAt,
          updatedAt: savedUpdatedAt,
        }),
      })
    );
    expect(result).toEqual(
      expect.objectContaining({ changedFields: ["full_name"], ok: true })
    );
  });

  it("treats blank optional fields as a no-op and writes neither member nor audit rows", async () => {
    const result = await updateMemberProfileAction({
      auditNote: "",
      batchNo: "",
      departmentCode: "",
      expectedUpdatedAt: previousUpdatedAt,
      facebookUrl: "",
      fullName: "Member One",
      joinedOn: "2023-07-01",
      linkedinUrl: "",
      memberId,
      phone: "",
      studentId: "",
      websiteUrl: "",
    });

    expect(result).toEqual(
      expect.objectContaining({ changedFields: [], message: "No profile fields changed.", ok: true })
    );
    expect(mocks.memberUpdate).not.toHaveBeenCalled();
    expect(mocks.auditInsert).not.toHaveBeenCalled();
  });

  it("uses the import normalizer for short-code department, exact two-digit batch, and joining date", async () => {
    const result = await updateMemberProfileAction({
      auditNote: "Verified against the official member register.",
      batchNo: "08",
      departmentCode: "CSE",
      expectedUpdatedAt: previousUpdatedAt,
      facebookUrl: "",
      fullName: "Member One",
      joinedOn: "2024-07-01",
      linkedinUrl: "",
      memberId,
      phone: "",
      studentId: "",
      websiteUrl: "",
    });

    expect(result.ok).toBe(true);
    expect(mocks.memberUpdate).toHaveBeenCalledWith({
      batch_no: 8,
      joined_on: "2024-07-01",
    });
  });

  it.each([
    [
      "unknown department",
      { batchNo: "18", departmentCode: "UNKNOWN", joinedOn: "2023-07-01" },
      /department code.*not recognized/i,
    ],
    [
      "one-digit batch",
      { batchNo: "8", departmentCode: "CSE", joinedOn: "2023-07-01" },
      /exactly two digits/i,
    ],
    [
      "invalid joining date",
      { batchNo: "18", departmentCode: "CSE", joinedOn: "2024\/15\/01" },
      /YYYY-MM-DD/i,
    ],
  ])("rejects %s with corrective import-parity guidance", async (_label, fields, message) => {
    const result = await updateMemberProfileAction({
      auditNote: "",
      expectedUpdatedAt: previousUpdatedAt,
      facebookUrl: "",
      fullName: "Member One",
      linkedinUrl: "",
      memberId,
      phone: "",
      studentId: "",
      websiteUrl: "",
      ...fields,
    });

    expect(result).toEqual(expect.objectContaining({ ok: false }));
    if (result.ok) throw new Error("Expected profile validation to fail.");
    expect(result.message).toMatch(message);
    expect(mocks.memberUpdate).not.toHaveBeenCalled();
  });
});
