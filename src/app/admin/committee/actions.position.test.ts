import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auditInsert: vi.fn(),
  createAdminClient: vi.fn(),
  positionInsert: vi.fn(),
  requireAdminPermission: vi.fn(),
  revalidatePath: vi.fn(),
  setAdminFlash: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mocks.revalidatePath(...args),
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));

vi.mock("@/lib/admin/flash", () => ({
  setAdminFlash: (...args: unknown[]) => mocks.setAdminFlash(...args),
}));

vi.mock("@/lib/auth/session", () => ({
  requireAdminPermission: (...args: unknown[]) => mocks.requireAdminPermission(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mocks.createAdminClient(),
}));

import { saveCommitteeTermPosition } from "./actions";

const termId = "33333333-3333-4333-8333-333333333333";
const roleId = "11111111-1111-4111-8111-111111111111";
const positionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function formData() {
  const value = new FormData();
  value.set("termId", termId);
  value.set("roleId", roleId);
  value.set("publicLabel", "Chair");
  value.set("publicLabelBn", "সভাপতি");
  value.set("roleGroup", "executive");
  value.set("priority", "5");
  value.set("isPublic", "true");
  value.set("minSlots", "1");
  value.set("targetSlots", "1");
  value.set("maxSlots", "1");
  return value;
}

describe("saveCommitteeTermPosition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminPermission.mockResolvedValue({ user: { id: "operator-1" } });
    mocks.setAdminFlash.mockResolvedValue(undefined);
    mocks.auditInsert.mockResolvedValue({ error: null });

    const saved = {
      id: positionId,
      is_public: true,
      max_slots: 1,
      min_slots: 1,
      priority: 5,
      public_label: "Chair",
      public_label_bn: "সভাপতি",
      role_group: "executive",
      role_id: roleId,
      target_slots: 1,
      term_id: termId,
    };
    mocks.positionInsert.mockReturnValue({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({ data: saved, error: null }),
      })),
    });

    const termTable = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: termId, term_kind: "executive", title: "6th Executive Committee" },
            error: null,
          }),
        })),
      })),
    };
    const roleTable = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: roleId, title: "President" },
            error: null,
          }),
        })),
      })),
    };
    const positionTable = {
      insert: (...args: unknown[]) => mocks.positionInsert(...args),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
      })),
    };
    const auditTable = {
      insert: (...args: unknown[]) => mocks.auditInsert(...args),
    };

    mocks.createAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "committee_terms") return termTable;
        if (table === "committee_roles") return roleTable;
        if (table === "committee_term_positions") return positionTable;
        if (table === "audit_events") return auditTable;
        throw new Error(`Unexpected table: ${table}`);
      }),
    });
  });

  it("creates a validated term-scoped position and writes an audit event", async () => {
    await expect(saveCommitteeTermPosition(formData())).rejects.toThrow(
      "redirect:/admin/committee"
    );

    expect(mocks.requireAdminPermission).toHaveBeenCalledWith(
      "admin.committee.manage",
      { fallbackPath: "/admin/committee" }
    );
    expect(mocks.positionInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        created_by_user_id: "operator-1",
        is_public: true,
        public_label: "Chair",
        role_id: roleId,
        target_slots: 1,
        term_id: termId,
        updated_by_user_id: "operator-1",
      })
    );
    expect(mocks.auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "committee.term_position_created",
        actor_user_id: "operator-1",
        entity_id: positionId,
        entity_type: "committee_term_position",
        metadata: expect.objectContaining({ before: null, roleId, termId }),
      })
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/committee");
  });
});
