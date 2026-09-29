import { describe, expect, it } from "vitest";
import type { IntakeHeader, IntakeRow } from "./intake-contracts";
import { inferColumnMapping, resolveColumnMapping } from "./field-catalog";
import {
  normalizeOnboardingRow,
  type ExistingDepartmentSnapshot,
  type ExistingMemberSnapshot,
  type NormalizeOnboardingRowOptions,
} from "./normalize-draft";

const headers = (labels: string[]): IntakeHeader[] =>
  labels.map((label, columnIndex) => ({
    columnIndex,
    key: label.toLocaleLowerCase("en-US").replace(/\s+/g, "_"),
    label,
  }));

const existingMember: ExistingMemberSnapshot = {
  batchNo: "18",
  departmentCode: "computer-science-engineering",
  email: "member@example.com",
  fullName: "Existing Member",
  id: "member-1",
  jnuitsId: "JNUITS-2026001",
  joinedOn: "2024-01-15",
  lifecycleStatus: "current",
  memberType: "current",
  phone: "+8801700000000",
  studentId: "CSE-2018-001",
  updatedAt: "2026-09-20T00:00:00.000Z",
};

const departments: ExistingDepartmentSnapshot[] = [
  {
    aliases: ["Computer Science and Engineering", "Department of CSE"],
    internalCode: "computer-science-engineering",
    name: "Computer Science & Engineering",
    shortCode: "CSE",
  },
];

const baseRow: IntakeRow = {
  sourceRowNumber: 2,
  values: {
    batch_no: "18",
    classification: "current",
    department_code: "CSE",
    email: "new@example.com",
    full_name: "New Member",
    jnuits_id: "JNUITS-2026002",
    joined_on: "2024-01-15",
  },
};

const baseOptions = (
  overrides: Partial<NormalizeOnboardingRowOptions> = {}
): NormalizeOnboardingRowOptions => ({
  approvedMedia: [],
  departments,
  existingAssignments: [],
  existingMembers: [],
  mapping: {
    batchNo: "batch_no",
    classification: "classification",
    departmentCode: "department_code",
    email: "email",
    fullName: "full_name",
    jnuitsId: "jnuits_id",
    joinedOn: "joined_on",
  },
  operationType: "member_profile_import",
  positions: [],
  row: baseRow,
  targetTermId: null,
  ...overrides,
});

describe("onboarding field mapping", () => {
  it("recognizes English and Bengali aliases", () => {
    const mapping = inferColumnMapping(
      headers(["Full Name", "ইমেইল", "সদস্য আইডি", "সদস্যের ধরন", "পদবি"])
    );

    expect(mapping).toMatchObject({
      classification: "সদস্যের_ধরন",
      email: "ইমেইল",
      fullName: "full_name",
      jnuitsId: "সদস্য_আইডি",
      position: "পদবি",
    });
  });

  it("lets an explicit user mapping override inferred aliases", () => {
    const sourceHeaders = headers(["Name", "Preferred identity"]);

    expect(resolveColumnMapping(sourceHeaders, { jnuitsId: "preferred_identity" })).toMatchObject({
      fullName: "name",
      jnuitsId: "preferred_identity",
    });
  });
});

describe("normalizeOnboardingRow", () => {
  it("requires full name, valid JnUITS ID, email, and explicit classification", () => {
    const result = normalizeOnboardingRow(
      baseOptions({
        row: {
          sourceRowNumber: 7,
          values: { classification: "", email: "bad", full_name: "", jnuits_id: "123" },
        },
      })
    );

    expect(result.status).toBe("invalid");
    expect(result.errors.map(({ code }) => code)).toEqual([
      "full_name_required",
      "jnuits_id_invalid",
      "email_invalid",
      "classification_required",
      "department_required",
      "batch_required",
      "joining_date_required",
    ]);
  });

  it.each([
    "CSE",
    " cse ",
    "Computer Science & Engineering",
    "computer-science-engineering",
    "Computer Science and Engineering",
  ])("resolves department input %j to its internal code", (departmentInput) => {
    const result = normalizeOnboardingRow(
      baseOptions({
        row: {
          ...baseRow,
          values: { ...baseRow.values, department_code: departmentInput },
        },
      })
    );

    expect(result.errors).toEqual([]);
    expect(result.normalized.departmentCode).toBe("computer-science-engineering");
    expect(result.memberPatch.department_code).toBe("computer-science-engineering");
  });

  it.each([
    ["07", 7],
    ["08", 8],
  ] as const)("preserves batch code %s while storing numeric batch %i", (batchCode, batchNo) => {
    const result = normalizeOnboardingRow(
      baseOptions({
        row: { ...baseRow, values: { ...baseRow.values, batch_no: batchCode } },
      })
    );

    expect(result.errors).toEqual([]);
    expect(result.normalized.batchNo).toBe(batchCode);
    expect(result.memberPatch.batch_no).toBe(batchNo);
  });

  it("returns every actionable format issue with its source row", () => {
    const result = normalizeOnboardingRow(
      baseOptions({
        row: {
          sourceRowNumber: 12,
          values: {
            ...baseRow.values,
            batch_no: "7th",
            classification: "member",
            department_code: "Computing",
            joined_on: "2024/15/01",
          },
        },
      })
    );

    expect(result.errors.map(({ code }) => code)).toEqual([
      "classification_invalid",
      "department_not_recognized",
      "batch_format_invalid",
      "joining_date_format_invalid",
    ]);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          acceptedFormat: expect.any(String),
          example: expect.any(String),
          explanation: expect.any(String),
          receivedValue: expect.any(String),
          sourceRow: 12,
        }),
      ])
    );
    for (const issue of result.errors) {
      expect(issue.acceptedFormat.length).toBeGreaterThan(0);
      expect(issue.example.length).toBeGreaterThan(0);
      expect(issue.explanation.length).toBeGreaterThan(0);
    }
  });

  it("normalizes identifiers and reuses only a mutually consistent identity", () => {
    const result = normalizeOnboardingRow(
      baseOptions({
        existingMembers: [existingMember],
        row: {
          sourceRowNumber: 2,
          values: {
            batch: "",
            classification: "Former",
            department: "",
            email: " MEMBER@EXAMPLE.COM ",
            full_name: "Existing Member Updated",
            jnuits_id: "jnuits-2026001",
            phone: "",
            student_id: "",
          },
        },
        mapping: {
          batchNo: "batch",
          classification: "classification",
          departmentCode: "department",
          email: "email",
          fullName: "full_name",
          jnuitsId: "jnuits_id",
          phone: "phone",
          studentId: "student_id",
        },
      })
    );

    expect(result.identity).toEqual({ kind: "update", memberId: "member-1" });
    expect(result.normalized).toMatchObject({
      classification: "former",
      email: "member@example.com",
      jnuitsId: "JNUITS-2026001",
    });
    expect(result.memberPatch).toEqual({
      full_name: "Existing Member Updated",
      lifecycle_status: "former",
    });
    expect(result.targetVersions.memberUpdatedAt).toBe(existingMember.updatedAt);
  });

  it("blocks a split identity when ID and email resolve to different members", () => {
    const result = normalizeOnboardingRow(
      baseOptions({
        existingMembers: [
          existingMember,
          {
            ...existingMember,
            email: "other@example.com",
            id: "member-2",
            jnuitsId: "JNUITS-2026002",
          },
        ],
        row: {
          ...baseRow,
          values: {
            ...baseRow.values,
            email: "other@example.com",
            jnuits_id: "JNUITS-2026001",
          },
        },
      })
    );

    expect(result.identity.kind).toBe("conflict");
    expect(result.errors.map(({ code }) => code)).toContain("split_identity");
    expect(JSON.stringify(result.errors)).not.toContain("member@example.com");
    expect(JSON.stringify(result.errors)).not.toContain("JNUITS-2026002");
  });

  it("blocks a one-sided match whose other identifier disagrees", () => {
    const result = normalizeOnboardingRow(
      baseOptions({
        existingMembers: [existingMember],
        row: {
          ...baseRow,
          values: {
            ...baseRow.values,
            email: "different@example.com",
            jnuits_id: existingMember.jnuitsId,
          },
        },
      })
    );

    expect(result.identity.kind).toBe("conflict");
    expect(result.errors.map(({ code }) => code)).toContain("identity_mismatch");
  });

  it("never matches by name", () => {
    const result = normalizeOnboardingRow(
      baseOptions({
        existingMembers: [existingMember],
        row: {
          ...baseRow,
          values: { ...baseRow.values, full_name: existingMember.fullName },
        },
      })
    );

    expect(result.identity).toEqual({ kind: "create", memberId: null });
  });

  it("treats blank optional intake cells as no change for an existing member", () => {
    const result = normalizeOnboardingRow(
      baseOptions({
        existingMembers: [existingMember],
        row: {
          sourceRowNumber: 8,
          values: {
            batch_no: "",
            classification: "current",
            department_code: "",
            email: existingMember.email!,
            full_name: existingMember.fullName,
            jnuits_id: existingMember.jnuitsId,
            joined_on: "",
          },
        },
      })
    );

    expect(result.errors).toEqual([]);
    expect(result.identity).toEqual({ kind: "update", memberId: existingMember.id });
    expect(result.memberPatch).toEqual({});
    expect(result.status).toBe("noop");
  });

  it("treats an identical member import row as a no-op", () => {
    const result = normalizeOnboardingRow(
      baseOptions({
        existingMembers: [existingMember],
        row: {
          sourceRowNumber: 9,
          values: {
            batch_no: "18",
            classification: "current",
            department_code: "Computer Science and Engineering",
            email: existingMember.email!,
            full_name: existingMember.fullName,
            jnuits_id: existingMember.jnuitsId,
            joined_on: existingMember.joinedOn!,
          },
        },
      })
    );

    expect(result.errors).toEqual([]);
    expect(result.memberPatch).toEqual({});
    expect(result.status).toBe("noop");
  });

  it.each([
    ["current", { lifecycle_status: "current", member_type: "current" }],
    ["সাবেক", { lifecycle_status: "former", member_type: "current" }],
    ["alumni", { lifecycle_status: "alumni", member_type: "alumni" }],
  ] as const)("maps explicit classification %s", (classification, expected) => {
    const result = normalizeOnboardingRow(
      baseOptions({ row: { ...baseRow, values: { ...baseRow.values, classification } } })
    );

    expect(result.memberPatch).toMatchObject(expected);
  });

  it("accepts only an approved, public, undeleted image reference", () => {
    const rejected = normalizeOnboardingRow(
      baseOptions({
        mapping: { ...baseOptions().mapping, avatarMediaId: "photo" },
        row: { ...baseRow, values: { ...baseRow.values, photo: "media-1" } },
      })
    );
    const accepted = normalizeOnboardingRow(
      baseOptions({
        approvedMedia: [
          {
            bytes: 1234,
            deletedAt: null,
            format: "webp",
            height: 512,
            id: "media-1",
            isPublic: true,
            mediaKind: "image",
            publicId: "jnuits/members/media-1",
            secureUrl: "https://cdn.example.test/media-1.webp",
            width: 512,
          },
        ],
        mapping: { ...baseOptions().mapping, avatarMediaId: "photo" },
        row: { ...baseRow, values: { ...baseRow.values, photo: "media-1" } },
      })
    );

    expect(rejected.errors.map(({ code }) => code)).toContain("media_not_approved");
    expect(accepted.normalized.avatarMediaId).toBe("media-1");
    expect(accepted.memberPatch).toMatchObject({
      avatar_bytes: 1234,
      avatar_format: "webp",
      avatar_height: 512,
      avatar_public_id: "jnuits/members/media-1",
      avatar_secure_url: "https://cdn.example.test/media-1.webp",
      avatar_width: 512,
    });
  });

  it("requires a selected committee term and known visible position for roster rows", () => {
    const result = normalizeOnboardingRow(
      baseOptions({
        operationType: "committee_roster_import",
        mapping: { ...baseOptions().mapping, position: "position" },
        row: { ...baseRow, values: { ...baseRow.values, position: "President" } },
      })
    );

    expect(result.errors.map(({ code }) => code)).toContain("committee_term_required");
    expect(result.errors.map(({ code }) => code)).toContain("position_unknown");
  });

  it("treats an identical existing appointment as a no-op", () => {
    const result = normalizeOnboardingRow(
      baseOptions({
        existingAssignments: [
          {
            endsOn: null,
            id: "assignment-1",
            isPublic: true,
            memberId: existingMember.id,
            roleId: "role-president",
            sortOrder: 1,
            startsOn: "2026-01-01",
            status: "active",
            termId: "term-6",
            updatedAt: "2026-09-21T00:00:00.000Z",
          },
        ],
        existingMembers: [existingMember],
        mapping: {
          ...baseOptions().mapping,
          isPublic: "public",
          position: "position",
          sortOrder: "order",
          startsOn: "starts",
        },
        operationType: "committee_roster_import",
        positions: [
          {
            code: "president",
            isVisible: true,
            roleId: "role-president",
            termId: "term-6",
            title: "President",
            titleBn: "সভাপতি",
            updatedAt: "2026-09-19T00:00:00.000Z",
          },
        ],
        row: {
          sourceRowNumber: 2,
          values: {
            classification: "current",
            email: existingMember.email!,
            full_name: existingMember.fullName,
            jnuits_id: existingMember.jnuitsId,
            order: "1",
            position: "সভাপতি",
            public: "yes",
            starts: "2026-01-01",
          },
        },
        targetTermId: "term-6",
      })
    );

    expect(result.status).toBe("noop");
    expect(result.assignment).toEqual({
      action: "noop",
      assignmentId: "assignment-1",
      roleId: "role-president",
      termId: "term-6",
    });
    expect(result.targetVersions).toMatchObject({
      assignmentUpdatedAt: "2026-09-21T00:00:00.000Z",
      positionUpdatedAt: "2026-09-19T00:00:00.000Z",
    });
  });
});
