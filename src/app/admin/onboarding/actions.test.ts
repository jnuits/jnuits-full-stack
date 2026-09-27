import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildOnboardingDraftRows: vi.fn(),
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
  inspectOnboardingSource: vi.fn(),
  loadOnboardingNormalizationContext: vi.fn(),
  loadOnboardingDraft: vi.fn(),
  persistOnboardingDraft: vi.fn(),
  publishOnboardingDraft: vi.fn(),
  requireAdminPermission: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mocks.revalidatePath(...args),
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));

vi.mock("@/lib/auth/session", () => ({
  requireAdminPermission: (...args: unknown[]) => mocks.requireAdminPermission(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mocks.createAdminClient(),
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: () => mocks.createClient(),
}));

vi.mock("@/lib/committee/onboarding/draft-repository", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/committee/onboarding/draft-repository")
  >();
  return {
    ...actual,
    buildOnboardingDraftRows: (...args: unknown[]) => mocks.buildOnboardingDraftRows(...args),
    createSupabaseOnboardingDraftGateway: vi.fn(() => ({ call: vi.fn() })),
    inspectOnboardingSource: (...args: unknown[]) => mocks.inspectOnboardingSource(...args),
    loadOnboardingNormalizationContext: (...args: unknown[]) =>
      mocks.loadOnboardingNormalizationContext(...args),
    loadOnboardingDraft: (...args: unknown[]) => mocks.loadOnboardingDraft(...args),
    persistOnboardingDraft: (...args: unknown[]) => mocks.persistOnboardingDraft(...args),
    publishOnboardingDraft: (...args: unknown[]) => mocks.publishOnboardingDraft(...args),
  };
});

import {
  createOnboardingDraftAction,
  inspectOnboardingSourceAction,
  publishOnboardingDraftAction,
} from "@/app/admin/onboarding/actions";

const operationId = "11111111-1111-4111-8111-111111111111";

function sourceForm(operationType: string) {
  const formData = new FormData();
  formData.set("operationType", operationType);
  formData.set("sourceKind", "pasted_tsv");
  formData.set(
    "sourceText",
    "Full name\tJnUITS ID\tEmail\tClassification\nMember One\tJNUITS-2026001\tone@example.com\tcurrent"
  );
  return formData;
}

describe("committee onboarding Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminPermission.mockResolvedValue({ user: { id: "operator-1" } });
    mocks.createClient.mockResolvedValue({ session: true });
    mocks.createAdminClient.mockReturnValue({ admin: true });
    mocks.buildOnboardingDraftRows.mockReturnValue([]);
    mocks.loadOnboardingNormalizationContext.mockResolvedValue({
      approvedMedia: [],
      existingAssignments: [],
      existingMembers: [],
      positions: [],
      targetTermUpdatedAt: "2026-09-26T05:49:27.000Z",
    });
    mocks.persistOnboardingDraft.mockResolvedValue({
      draftRevision: 1,
      errorRows: 0,
      operationId,
      totalRows: 0,
      validRows: 0,
    });
    mocks.inspectOnboardingSource.mockResolvedValue({
      originalFilename: null,
      sourceSha256: "a".repeat(64),
      table: {
        availableSheets: [],
        headers: [{ columnIndex: 0, key: "full_name", label: "Full name" }],
        rows: [{ sourceRowNumber: 2, values: { full_name: "Member One" } }],
        selectedSheet: null,
      },
    });
  });

  it.each([
    ["committee_roster_import", "admin.committee.manage"],
    ["member_profile_import", "admin.membership.manage"],
  ])("routes %s to its fixed server-side permission", async (operationType, permission) => {
    const result = await inspectOnboardingSourceAction(sourceForm(operationType));

    expect(result.ok).toBe(true);
    expect(mocks.requireAdminPermission).toHaveBeenCalledWith(permission, {
      fallbackPath: "/admin/onboarding",
    });
  });

  it("rejects malformed operation types before reading a source", async () => {
    const result = await inspectOnboardingSourceAction(sourceForm("admin.bulk.manage"));

    expect(result).toEqual(
      expect.objectContaining({ ok: false, message: expect.any(String) })
    );
    expect(mocks.inspectOnboardingSource).not.toHaveBeenCalled();
    expect(mocks.requireAdminPermission).not.toHaveBeenCalled();
  });

  it("returns a bounded preview and digest without returning source bytes", async () => {
    const result = await inspectOnboardingSourceAction(
      sourceForm("member_profile_import")
    );

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        data: expect.objectContaining({
          rowCount: 1,
          sourceSha256: "a".repeat(64),
        }),
      })
    );
    expect(JSON.stringify(result)).not.toContain("sourceBytes");
  });

  it("persists the target term concurrency token on committee drafts", async () => {
    const formData = sourceForm("committee_roster_import");
    formData.set("targetTermId", "a53b45fc-c338-42a5-adec-db5350f580a3");

    const result = await createOnboardingDraftAction(formData);

    expect(result.ok).toBe(true);
    expect(mocks.persistOnboardingDraft).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        metadata: expect.objectContaining({
          targetTermId: "a53b45fc-c338-42a5-adec-db5350f580a3",
          targetTermUpdatedAt: "2026-09-26T05:49:27.000Z",
        }),
      })
    );
  });

  it("derives an existing draft's permission from the stored operation before publish", async () => {
    mocks.loadOnboardingDraft.mockResolvedValue({
      draftRevision: 4,
      operationType: "committee_roster_import",
      rows: [],
    });
    mocks.publishOnboardingDraft.mockResolvedValue({ operationId, status: "committed" });

    const result = await publishOnboardingDraftAction({
      expectedRevision: 4,
      makeCurrent: true,
      operationId,
    });

    expect(result.ok).toBe(true);
    expect(mocks.requireAdminPermission).toHaveBeenNthCalledWith(
      1,
      ["admin.committee.manage", "admin.membership.manage"],
      { fallbackPath: "/admin/onboarding" }
    );
    expect(mocks.requireAdminPermission).toHaveBeenNthCalledWith(
      2,
      "admin.committee.manage",
      { fallbackPath: "/admin/onboarding" }
    );
    expect(mocks.publishOnboardingDraft).toHaveBeenCalledWith(
      expect.anything(),
      { expectedRevision: 4, makeCurrent: true, operationId }
    );
  });
});
