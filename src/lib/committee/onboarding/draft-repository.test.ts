import { describe, expect, it, vi } from "vitest";

import type { IntakeTable } from "./intake-contracts";
import {
  buildOnboardingDraftRows,
  createSupabaseOnboardingDraftGateway,
  editOnboardingDraftRow,
  getMemberSearchWindow,
  inspectOnboardingSource,
  loadOnboardingNormalizationContext,
  persistOnboardingDraft,
  publishOnboardingDraft,
  searchOnboardingMembers,
  setOnboardingDraftRowExcluded,
  sha256IntakeSource,
  validateOnboardingDraft,
  type OnboardingDraftGateway,
} from "./draft-repository";

const operationId = "11111111-1111-4111-8111-111111111111";
const actorUserId = "22222222-2222-4222-8222-222222222222";

function createGateway(overrides: Partial<OnboardingDraftGateway> = {}): OnboardingDraftGateway {
  return {
    call: vi.fn().mockResolvedValue({}),
    createOperation: vi.fn().mockResolvedValue({ draftRevision: 1, id: operationId }),
    createRows: vi.fn().mockResolvedValue(undefined),
    deleteOperation: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("committee onboarding draft repository", () => {
  it("hashes source bytes with a stable lowercase SHA-256 digest", () => {
    expect(sha256IntakeSource("hello")).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
    );
  });

  it("creates equivalent normalized decisions from uploaded CSV, pasted rows, and fetched sheet bytes", async () => {
    const csv = Buffer.from(
      "Full name,JnUITS ID,Email,Classification\nMember One,JNUITS-2026001,one@example.com,current\n"
    );
    const pasted =
      "Full name\tJnUITS ID\tEmail\tClassification\nMember One\tJNUITS-2026001\tone@example.com\tcurrent\n";
    const provenance = {
      documentId: "test-sheet-document-123",
      fetchedAt: "2026-09-30T04:00:00.000Z",
      sheetId: "42",
    };
    const [uploaded, pastedRows, sheet] = await Promise.all([
      inspectOnboardingSource({ bytes: csv, sourceKind: "csv" }),
      inspectOnboardingSource({ sourceKind: "pasted_tsv", text: pasted }),
      inspectOnboardingSource({
        bytes: csv,
        googleSheet: provenance,
        sourceKind: "google_sheet",
      }),
    ]);
    const context = {
      approvedMedia: [],
      departments: [],
      existingAssignments: [],
      existingMembers: [],
      positions: [],
      targetTermUpdatedAt: null,
    };
    const mapping = {
      classification: "classification",
      email: "email",
      fullName: "full_name",
      jnuitsId: "jnuits_id",
    } as const;
    const decisions = [uploaded, pastedRows, sheet].map(({ table }) =>
      buildOnboardingDraftRows({
        context,
        mapping,
        operationType: "member_profile_import",
        table,
        targetTermId: null,
      })
    );

    expect(decisions[1]).toEqual(decisions[0]);
    expect(decisions[2]).toEqual(decisions[0]);
    expect(sheet.sourceSha256).toBe(uploaded.sourceSha256);
    expect(sheet.googleSheet).toEqual(provenance);
  });

  it("marks every side of a cross-row identity conflict as an error", () => {
    const table: IntakeTable = {
      availableSheets: [],
      headers: [
        { columnIndex: 0, key: "full_name", label: "Full name" },
        { columnIndex: 1, key: "jnuits_id", label: "JnUITS ID" },
        { columnIndex: 2, key: "email", label: "Email" },
        { columnIndex: 3, key: "classification", label: "Classification" },
      ],
      rows: [
        {
          sourceRowNumber: 2,
          values: {
            classification: "current",
            email: "one@example.com",
            full_name: "Member One",
            jnuits_id: "JNUITS-2026001",
          },
        },
        {
          sourceRowNumber: 3,
          values: {
            classification: "current",
            email: "two@example.com",
            full_name: "Member Two",
            jnuits_id: "JNUITS-2026001",
          },
        },
      ],
      selectedSheet: null,
    };

    const rows = buildOnboardingDraftRows({
      context: {
        approvedMedia: [],
        departments: [],
        existingAssignments: [],
        existingMembers: [],
        positions: [],
        targetTermUpdatedAt: null,
      },
      mapping: {
        classification: "classification",
        email: "email",
        fullName: "full_name",
        jnuitsId: "jnuits_id",
      },
      operationType: "member_profile_import",
      table,
      targetTermId: null,
    });

    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.status === "error")).toBe(true);
    expect(
      rows.every((row) => row.errors.some((issue) => issue.code === "draft_identity_conflict"))
    ).toBe(true);
    expect(
      rows.map((row) => row.errors.find((issue) => issue.code === "draft_identity_conflict"))
    ).toEqual([
      expect.objectContaining({
        acceptedFormat: expect.any(String),
        example: expect.any(String),
        explanation: expect.any(String),
        receivedValue: "",
        sourceRow: 2,
      }),
      expect.objectContaining({
        acceptedFormat: expect.any(String),
        example: expect.any(String),
        explanation: expect.any(String),
        receivedValue: "",
        sourceRow: 3,
      }),
    ]);
  });

  it("persists only metadata, normalized decisions, and rows, never source bytes", async () => {
    const gateway = createGateway();
    const rows = [
      {
        errors: [],
        normalizedData: {
          assignment: null,
          assignmentPatch: null,
          identity: { kind: "create" as const, memberId: null },
          memberPatch: { full_name: "Member One" },
          normalized: { fullName: "Member One" },
          operationType: "member_profile_import" as const,
          schemaVersion: 1 as const,
          targetVersions: {
            assignmentUpdatedAt: null,
            memberUpdatedAt: null,
            positionUpdatedAt: null,
          },
          warnings: [],
        },
        rawData: { full_name: "Member One" },
        rowNumber: 2,
        status: "valid" as const,
      },
    ];

    const result = await persistOnboardingDraft(gateway, {
      actorUserId,
      metadata: {
        columnMapping: { fullName: "full_name" },
        operationType: "member_profile_import",
        originalFilename: "members.csv",
        schemaVersion: 1,
        sourceKind: "csv",
        sourceSha256: "a".repeat(64),
        targetTermId: null,
        targetTermUpdatedAt: null,
      },
      rows,
    });

    expect(result).toEqual({
      draftRevision: 1,
      errorRows: 0,
      operationId,
      totalRows: 1,
      validRows: 1,
    });
    expect(gateway.createOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        createdByUserId: actorUserId,
        metadata: {
          columnMapping: { fullName: "full_name" },
          schemaVersion: 1,
        },
        sourceSha256: "a".repeat(64),
      })
    );
    expect(JSON.stringify(vi.mocked(gateway.createOperation).mock.calls[0])).not.toContain(
      "sourceBytes"
    );
    expect(gateway.createRows).toHaveBeenCalledWith(operationId, rows);
  });

  it("persists sanitized Google Sheet provenance without the source URL or bytes", async () => {
    const gateway = createGateway();
    const provenance = {
      documentId: "test-sheet-document-123",
      fetchedAt: "2026-09-30T04:00:00.000Z",
      sheetId: "42",
    };

    await persistOnboardingDraft(gateway, {
      actorUserId,
      metadata: {
        columnMapping: {},
        googleSheet: provenance,
        operationType: "member_profile_import",
        schemaVersion: 1,
        sourceKind: "google_sheet",
        sourceSha256: "a".repeat(64),
        targetTermId: null,
        targetTermUpdatedAt: null,
      },
      rows: [],
    });

    expect(gateway.createOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ googleSheet: provenance }),
        sourceKind: "google_sheet",
      })
    );
    expect(JSON.stringify(vi.mocked(gateway.createOperation).mock.calls)).not.toMatch(
      /docs\.google\.com|sourceUrl|sourceBytes/
    );
  });

  it("removes the parent draft when row persistence fails", async () => {
    const gateway = createGateway({
      createRows: vi.fn().mockRejectedValue(new Error("row insert failed")),
    });

    await expect(
      persistOnboardingDraft(gateway, {
        actorUserId,
        metadata: {
          columnMapping: {},
          operationType: "member_profile_import",
          schemaVersion: 1,
          sourceKind: "manual",
          targetTermId: null,
          targetTermUpdatedAt: null,
        },
        rows: [],
      })
    ).rejects.toThrow("row insert failed");

    expect(gateway.deleteOperation).toHaveBeenCalledWith(operationId);
  });

  it("persists the target term concurrency token for committee drafts", async () => {
    const gateway = createGateway();

    await persistOnboardingDraft(gateway, {
      actorUserId,
      metadata: {
        columnMapping: {},
        operationType: "committee_roster_import",
        schemaVersion: 1,
        sourceKind: "manual",
        targetTermId: "a53b45fc-c338-42a5-adec-db5350f580a3",
        targetTermUpdatedAt: "2026-09-26T05:49:27.000Z",
      },
      rows: [],
    });

    expect(gateway.createOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          targetTermUpdatedAt: "2026-09-26T05:49:27.000Z",
        }),
      })
    );
  });

  it("loads the authoritative target term revision for committee drafts", async () => {
    const departmentQuery = {
      eq: vi.fn(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            code: "computer-science-engineering",
            name: "Computer Science & Engineering",
            short_code: "CSE",
          },
        ],
        error: null,
      }),
      select: vi.fn(),
    };
    departmentQuery.select.mockReturnValue(departmentQuery);
    departmentQuery.eq.mockReturnValue(departmentQuery);
    const aliasQuery = {
      eq: vi.fn(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            alias: "Computer Science and Engineering",
            department_code: "computer-science-engineering",
          },
        ],
        error: null,
      }),
      select: vi.fn(),
    };
    aliasQuery.select.mockReturnValue(aliasQuery);
    aliasQuery.eq.mockReturnValue(aliasQuery);
    const termQuery = {
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "a53b45fc-c338-42a5-adec-db5350f580a3",
          term_kind: "executive",
          updated_at: "2026-09-26T05:49:27.123456+00:00",
        },
        error: null,
      }),
      select: vi.fn(),
    };
    termQuery.select.mockReturnValue(termQuery);
    termQuery.eq.mockReturnValue(termQuery);
    const positionQuery = {
      eq: vi.fn(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      select: vi.fn(),
    };
    positionQuery.select.mockReturnValue(positionQuery);
    positionQuery.eq.mockReturnValue(positionQuery);
    const client = {
      from: vi.fn((table: string) => {
        if (table === "departments") return departmentQuery;
        if (table === "department_aliases") return aliasQuery;
        if (table === "committee_terms") return termQuery;
        if (table === "committee_term_positions") return positionQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    const context = await loadOnboardingNormalizationContext(client as never, {
      mapping: {},
      table: {
        availableSheets: [],
        headers: [],
        rows: [],
        selectedSheet: null,
      },
      targetTermId: "a53b45fc-c338-42a5-adec-db5350f580a3",
    });

    expect(context.targetTermUpdatedAt).toBe("2026-09-26T05:49:27.123456+00:00");
    expect(context.departments).toEqual([
      {
        aliases: ["Computer Science and Engineering"],
        internalCode: "computer-science-engineering",
        name: "Computer Science & Engineering",
        shortCode: "CSE",
      },
    ]);
    expect(client.from.mock.calls.filter(([table]) => table === "departments")).toHaveLength(1);
    expect(
      client.from.mock.calls.filter(([table]) => table === "department_aliases")
    ).toHaveLength(1);
  });

  it("passes optimistic revisions to edit, exclusion, validation, and publish RPCs", async () => {
    const call = vi.fn()
      .mockResolvedValueOnce({ draftRevision: 7, operationId })
      .mockResolvedValueOnce({ draftRevision: 8, operationId })
      .mockResolvedValueOnce({ draftRevision: 8, operationId, status: "previewed" })
      .mockResolvedValueOnce({ operationId, status: "committed" });
    const gateway = createGateway({ call });

    await editOnboardingDraftRow(gateway, {
      expectedRevision: 6,
      operationId,
      row: {
        errors: [],
        normalizedData: {
          assignment: null,
          assignmentPatch: null,
          identity: { kind: "create", memberId: null },
          memberPatch: {},
          normalized: {},
          operationType: "member_profile_import",
          schemaVersion: 1,
          targetVersions: {
            assignmentUpdatedAt: null,
            memberUpdatedAt: null,
            positionUpdatedAt: null,
          },
          warnings: [],
        },
        rawData: {},
        rowNumber: 2,
        status: "valid",
      },
      rowId: "33333333-3333-4333-8333-333333333333",
    });
    await setOnboardingDraftRowExcluded(gateway, {
      excluded: true,
      expectedRevision: 7,
      operationId,
      reason: "Duplicate roster line",
      rowId: "33333333-3333-4333-8333-333333333333",
    });
    await validateOnboardingDraft(gateway, { expectedRevision: 8, operationId });
    await publishOnboardingDraft(gateway, {
      expectedRevision: 8,
      makeCurrent: true,
      operationId,
    });

    expect(call).toHaveBeenNthCalledWith(1, "edit_onboarding_draft_row", {
      p_errors: [],
      p_expected_revision: 6,
      p_normalized_data: expect.objectContaining({ schemaVersion: 1 }),
      p_operation_id: operationId,
      p_raw_data: {},
      p_row_id: "33333333-3333-4333-8333-333333333333",
      p_status: "valid",
    });
    expect(call).toHaveBeenNthCalledWith(2, "set_onboarding_draft_row_excluded", {
      p_excluded: true,
      p_expected_revision: 7,
      p_operation_id: operationId,
      p_reason: "Duplicate roster line",
      p_row_id: "33333333-3333-4333-8333-333333333333",
    });
    expect(call).toHaveBeenNthCalledWith(3, "validate_onboarding_draft", {
      p_expected_revision: 8,
      p_operation_id: operationId,
    });
    expect(call).toHaveBeenNthCalledWith(4, "commit_onboarding_draft", {
      p_expected_revision: 8,
      p_make_current: true,
      p_operation_id: operationId,
    });
  });

  it("calculates stable one-based member-search pagination windows", () => {
    expect(getMemberSearchWindow({ page: 1, pageSize: 20 })).toEqual({ from: 0, to: 19 });
    expect(getMemberSearchWindow({ page: 3, pageSize: 20 })).toEqual({ from: 40, to: 59 });
  });

  it("surfaces a stale publish as a reloadable optimistic-concurrency conflict", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "40001", message: "raw database detail" },
    });
    const gateway = createSupabaseOnboardingDraftGateway({ rpc } as never);

    await expect(
      publishOnboardingDraft(gateway, {
        expectedRevision: 3,
        makeCurrent: false,
        operationId,
      })
    ).rejects.toMatchObject({
      code: "40001",
      message: "The draft changed. Reload it and try again.",
    });
  });

  it("applies the calculated range to paginated member searches", async () => {
    const range = vi.fn().mockResolvedValue({ count: 45, data: [], error: null });
    const builder = {
      neq: vi.fn(),
      order: vi.fn(),
      range,
      select: vi.fn(),
    };
    builder.select.mockReturnValue(builder);
    builder.neq.mockReturnValue(builder);
    builder.order.mockReturnValue(builder);
    const client = { from: vi.fn().mockReturnValue(builder) };

    const result = await searchOnboardingMembers(client as never, {
      page: 3,
      pageSize: 20,
      query: "",
    });

    expect(range).toHaveBeenCalledWith(40, 59);
    expect(result).toEqual({ members: [], page: 3, pageSize: 20, total: 45 });
  });
});
