import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db/types";
import { normalizeJnuitsIdForCreation } from "@/lib/members/jnuits-id";
import { asFlexibleClient } from "@/lib/supabase/flexible";
import {
  COMMITTEE_ONBOARDING_CANONICAL_FIELDS,
  onboardingRowIssueSchema,
  parseCommitteeDraftMetadata,
  type CommitteeDraftMetadata,
  type CommitteeOnboardingColumnMapping,
  type CommitteeOnboardingOperationType,
  type CommitteeIntakeSourceKind,
} from "./contracts";
import { ONBOARDING_FIELD_CATALOG, inferColumnMapping } from "./field-catalog";
import {
  assertIntakeSourceSize,
  createIntakeTableFromRows,
  IntakeParseError,
  type IntakeRow,
  type IntakeTable,
} from "./intake-contracts";
import {
  normalizeOnboardingRow,
  type ApprovedMediaSnapshot,
  type ExistingAssignmentSnapshot,
  type ExistingDepartmentSnapshot,
  type ExistingMemberSnapshot,
  type OnboardingRowIssue,
  type PositionSnapshot,
} from "./normalize-draft";
import { parseDelimitedIntake } from "./parse-delimited";
import { parseXlsxIntake } from "./parse-xlsx";

type JsonObject = Record<string, unknown>;

export type OnboardingNormalizationContext = {
  approvedMedia: ApprovedMediaSnapshot[];
  departments: ExistingDepartmentSnapshot[];
  existingAssignments: ExistingAssignmentSnapshot[];
  existingMembers: ExistingMemberSnapshot[];
  positions: PositionSnapshot[];
  targetTermUpdatedAt: string | null;
};

export type PersistedOnboardingDraftRow = {
  errors: OnboardingRowIssue[];
  normalizedData: {
    assignment: ReturnType<typeof normalizeOnboardingRow>["assignment"];
    assignmentPatch: ReturnType<typeof normalizeOnboardingRow>["assignmentPatch"];
    identity: ReturnType<typeof normalizeOnboardingRow>["identity"];
    memberPatch: ReturnType<typeof normalizeOnboardingRow>["memberPatch"];
    normalized: Record<string, unknown>;
    operationType: CommitteeOnboardingOperationType;
    schemaVersion: 1;
    targetVersions: ReturnType<typeof normalizeOnboardingRow>["targetVersions"];
    warnings: OnboardingRowIssue[];
  };
  rawData: Record<string, string>;
  rowNumber: number;
  status: "error" | "valid";
};

export type OnboardingDraftGateway = {
  call: <T>(functionName: string, args: Record<string, unknown>) => Promise<T>;
  createOperation: (input: {
    createdByUserId: string;
    errorRows: number;
    metadata: JsonObject;
    operationType: CommitteeOnboardingOperationType;
    originalFilename: string | null;
    sourceKind: CommitteeIntakeSourceKind;
    sourceSha256: string | null;
    targetTermId: string | null;
    totalRows: number;
    validRows: number;
  }) => Promise<{ draftRevision: number; id: string }>;
  createRows: (
    operationId: string,
    rows: readonly PersistedOnboardingDraftRow[]
  ) => Promise<void>;
  deleteOperation: (operationId: string) => Promise<void>;
};

export type OnboardingSourceInspection = {
  originalFilename: string | null;
  sourceSha256: string;
  table: IntakeTable;
};

export type OnboardingDraftRecord = {
  draftRevision: number;
  id: string;
  metadata: Record<string, unknown>;
  operationType: CommitteeOnboardingOperationType;
  originalFilename: string | null;
  rows: Array<{
    errors: OnboardingRowIssue[];
    id: string;
    isExcluded: boolean;
    normalizedData: Record<string, unknown>;
    rawData: Record<string, string>;
    rowNumber: number;
    status: string;
  }>;
  sourceKind: CommitteeIntakeSourceKind;
  sourceSha256: string | null;
  status: string;
  targetTermId: string | null;
  validatedRevision: number | null;
};

export class OnboardingDraftRepositoryError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "OnboardingDraftRepositoryError";
    this.code = code;
  }
}

function safeDatabaseMessage(error: { code?: string; message?: string } | null, fallback: string) {
  switch (error?.code) {
    case "40001":
      return "The draft changed. Reload it and try again.";
    case "42501":
      return "You do not have permission to manage this onboarding draft.";
    case "23505":
      return "The draft contains a duplicate identity or appointment.";
    case "22023":
    case "55000":
    case "P0002":
      return error.message || fallback;
    default:
      return fallback;
  }
}

function databaseFailure(
  error: { code?: string; message?: string } | null,
  fallback: string
): never {
  throw new OnboardingDraftRepositoryError(
    error?.code || "database_error",
    safeDatabaseMessage(error, fallback)
  );
}

export function sha256IntakeSource(source: string | Buffer | Uint8Array) {
  return createHash("sha256").update(source).digest("hex");
}

function manualTable(rows: readonly Record<string, string>[]) {
  const present = new Set(rows.flatMap((row) => Object.keys(row)));
  const fields = COMMITTEE_ONBOARDING_CANONICAL_FIELDS.filter((field) => present.has(field));

  if (fields.length === 0) {
    throw new IntakeParseError("empty_source", "At least one manual field is required.");
  }

  const labelByField = new Map(
    ONBOARDING_FIELD_CATALOG.map((definition) => [definition.field, definition.label])
  );
  return createIntakeTableFromRows([
    fields.map((field) => labelByField.get(field) || field),
    ...rows.map((row) => fields.map((field) => row[field] ?? "")),
  ]);
}

export async function inspectOnboardingSource(input: {
  bytes?: Buffer;
  manualRows?: readonly Record<string, string>[];
  originalFilename?: string | null;
  sheetName?: string;
  sourceKind: CommitteeIntakeSourceKind;
  text?: string;
}): Promise<OnboardingSourceInspection> {
  let table: IntakeTable;
  let digestInput: Buffer | string;

  if (input.sourceKind === "manual") {
    const rows = input.manualRows ?? [];
    assertIntakeSourceSize(Buffer.byteLength(JSON.stringify(rows), "utf8"));
    table = manualTable(rows);
    digestInput = JSON.stringify(rows);
  } else if (input.sourceKind === "pasted_tsv") {
    const text = input.text ?? "";
    table = parseDelimitedIntake(text, { delimiter: "\t" });
    digestInput = text;
  } else if (input.sourceKind === "csv") {
    if (!input.bytes) {
      throw new IntakeParseError("empty_source", "Choose a CSV file to continue.");
    }
    table = parseDelimitedIntake(input.bytes);
    digestInput = input.bytes;
  } else {
    if (!input.bytes) {
      throw new IntakeParseError("empty_source", "Choose an XLSX file to continue.");
    }
    table = await parseXlsxIntake(input.bytes, { sheet: input.sheetName });
    digestInput = input.bytes;
  }

  if (table.rows.length === 0) {
    throw new IntakeParseError("empty_source", "The source has headings but no data rows.");
  }

  return {
    originalFilename: input.originalFilename?.trim() || null,
    sourceSha256: sha256IntakeSource(digestInput),
    table,
  };
}

function normalizedText(value: unknown) {
  return typeof value === "string" ? value.normalize("NFKC").trim().toLocaleLowerCase("en-US") : "";
}

function addIssue(
  rows: PersistedOnboardingDraftRow[],
  indexes: readonly number[],
  issue: Omit<OnboardingRowIssue, "sourceRow">
) {
  for (const index of indexes) {
    const row = rows[index];
    if (!row || row.errors.some((candidate) => candidate.code === issue.code)) continue;
    row.errors.push({ ...issue, sourceRow: row.rowNumber });
    row.status = "error";
  }
}

function groupedIndexes(rows: readonly PersistedOnboardingDraftRow[], key: (row: PersistedOnboardingDraftRow) => string) {
  const groups = new Map<string, number[]>();
  rows.forEach((row, index) => {
    const value = key(row);
    if (!value) return;
    groups.set(value, [...(groups.get(value) ?? []), index]);
  });
  return groups;
}

export function buildOnboardingDraftRows(input: {
  context: OnboardingNormalizationContext;
  mapping: CommitteeOnboardingColumnMapping;
  operationType: CommitteeOnboardingOperationType;
  table: IntakeTable;
  targetTermId: string | null;
}): PersistedOnboardingDraftRow[] {
  const rows = input.table.rows.map((row): PersistedOnboardingDraftRow => {
    const result = normalizeOnboardingRow({
      ...input.context,
      mapping: input.mapping,
      operationType: input.operationType,
      row,
      targetTermId: input.targetTermId,
    });

    return {
      errors: [...result.errors],
      normalizedData: {
        assignment: result.assignment,
        assignmentPatch: result.assignmentPatch,
        identity: result.identity,
        memberPatch: result.memberPatch,
        normalized: result.normalized,
        operationType: input.operationType,
        schemaVersion: 1,
        targetVersions: result.targetVersions,
        warnings: result.warnings,
      },
      rawData: { ...row.values },
      rowNumber: row.sourceRowNumber,
      status: result.errors.length > 0 ? "error" : "valid",
    };
  });

  const byId = groupedIndexes(rows, (row) => normalizedText(row.normalizedData.normalized.jnuitsId));
  const byEmail = groupedIndexes(rows, (row) => normalizedText(row.normalizedData.normalized.email));

  for (const indexes of byId.values()) {
    const emails = new Set(indexes.map((index) => normalizedText(rows[index].normalizedData.normalized.email)));
    if (emails.size > 1) {
      addIssue(rows, indexes, {
        acceptedFormat: "Pair each JnUITS ID with one email throughout the draft.",
        code: "draft_identity_conflict",
        example: "JNUITS-2099001 with sample.member@example.com",
        explanation: "The same JnUITS ID is paired with different emails in this draft.",
        field: null,
        receivedValue: "",
      });
    }
  }
  for (const indexes of byEmail.values()) {
    const ids = new Set(indexes.map((index) => normalizedText(rows[index].normalizedData.normalized.jnuitsId)));
    if (ids.size > 1) {
      addIssue(rows, indexes, {
        acceptedFormat: "Pair each email with one JnUITS ID throughout the draft.",
        code: "draft_identity_conflict",
        example: "sample.member@example.com with JNUITS-2099001",
        explanation: "The same email is paired with different JnUITS IDs in this draft.",
        field: null,
        receivedValue: "",
      });
    }
  }

  if (input.operationType === "member_profile_import") {
    const exactIdentity = groupedIndexes(
      rows,
      (row) => `${normalizedText(row.normalizedData.normalized.jnuitsId)}|${normalizedText(row.normalizedData.normalized.email)}`
    );
    for (const [identity, indexes] of exactIdentity) {
      if (!identity.startsWith("|") && !identity.endsWith("|") && indexes.length > 1) {
        addIssue(rows, indexes, {
          acceptedFormat: "Include each member identity once per profile import.",
          code: "duplicate_member_identity",
          example: "One row for JNUITS-2099001",
          explanation: "This member appears more than once in the profile import.",
          field: null,
          receivedValue: "",
        });
      }
    }
  } else {
    const appointments = groupedIndexes(rows, (row) => {
      const assignment = row.normalizedData.assignment;
      const id = normalizedText(row.normalizedData.normalized.jnuitsId);
      return assignment && id ? `${assignment.termId}|${assignment.roleId}|${id}` : "";
    });
    for (const indexes of appointments.values()) {
      if (indexes.length > 1) {
        addIssue(rows, indexes, {
          acceptedFormat: "Include each member and position pairing once per committee term.",
          code: "duplicate_committee_appointment",
          example: "One President row for JNUITS-2099001",
          explanation: "This committee appointment appears more than once in the draft.",
          field: "position",
          receivedValue: "",
        });
      }
    }
  }

  return rows;
}

export async function persistOnboardingDraft(
  gateway: OnboardingDraftGateway,
  input: {
    actorUserId: string;
    metadata: CommitteeDraftMetadata;
    rows: readonly PersistedOnboardingDraftRow[];
  }
) {
  const metadata = parseCommitteeDraftMetadata(input.metadata);
  const validRows = input.rows.filter((row) => row.status === "valid").length;
  const errorRows = input.rows.length - validRows;
  const operation = await gateway.createOperation({
    createdByUserId: input.actorUserId,
    errorRows,
    metadata: {
      columnMapping: metadata.columnMapping,
      schemaVersion: metadata.schemaVersion,
      ...(metadata.sheetName ? { sheetName: metadata.sheetName } : {}),
      ...(metadata.targetTermUpdatedAt
        ? { targetTermUpdatedAt: metadata.targetTermUpdatedAt }
        : {}),
    },
    operationType: metadata.operationType,
    originalFilename: metadata.originalFilename ?? null,
    sourceKind: metadata.sourceKind,
    sourceSha256: metadata.sourceSha256 ?? null,
    targetTermId: metadata.targetTermId,
    totalRows: input.rows.length,
    validRows,
  });

  try {
    await gateway.createRows(operation.id, input.rows);
  } catch (error) {
    await gateway.deleteOperation(operation.id).catch(() => undefined);
    throw error;
  }

  return {
    draftRevision: operation.draftRevision,
    errorRows,
    operationId: operation.id,
    totalRows: input.rows.length,
    validRows,
  };
}

export function createSupabaseOnboardingDraftGateway(
  client: SupabaseClient<Database>
): OnboardingDraftGateway {
  const flexible = asFlexibleClient(client);
  return {
    async call<T>(functionName: string, args: Record<string, unknown>) {
      const { data, error } = await flexible.rpc(functionName, args);
      if (error) databaseFailure(error, "Unable to update the onboarding draft.");
      return data as T;
    },
    async createOperation(input) {
      const { data, error } = await flexible
        .from("bulk_operations")
        .insert({
          created_by_user_id: input.createdByUserId,
          error_rows: input.errorRows,
          metadata: input.metadata,
          operation_type: input.operationType,
          original_filename: input.originalFilename,
          source_kind: input.sourceKind,
          source_sha256: input.sourceSha256,
          status: "draft",
          target_term_id: input.targetTermId,
          total_rows: input.totalRows,
          valid_rows: input.validRows,
        })
        .select("id, draft_revision")
        .single();
      if (error || !data) databaseFailure(error, "Unable to create the onboarding draft.");
      return { draftRevision: Number(data.draft_revision), id: String(data.id) };
    },
    async createRows(operationId, rows) {
      const { error } = await flexible.from("bulk_operation_rows").insert(
        rows.map((row) => ({
          errors: row.errors,
          normalized_data: row.normalizedData,
          operation_id: operationId,
          raw_data: row.rawData,
          row_number: row.rowNumber,
          status: row.status,
        }))
      );
      if (error) databaseFailure(error, "Unable to save the onboarding draft rows.");
    },
    async deleteOperation(operationId) {
      const { error } = await flexible.from("bulk_operations").delete().eq("id", operationId);
      if (error) databaseFailure(error, "Unable to clean up the incomplete onboarding draft.");
    },
  };
}

export async function editOnboardingDraftRow(
  gateway: OnboardingDraftGateway,
  input: {
    expectedRevision: number;
    operationId: string;
    row: PersistedOnboardingDraftRow;
    rowId: string;
  }
) {
  return gateway.call<{ draftRevision: number; operationId: string }>(
    "edit_onboarding_draft_row",
    {
      p_errors: input.row.errors,
      p_expected_revision: input.expectedRevision,
      p_normalized_data: input.row.normalizedData,
      p_operation_id: input.operationId,
      p_raw_data: input.row.rawData,
      p_row_id: input.rowId,
      p_status: input.row.status,
    }
  );
}

export async function setOnboardingDraftRowExcluded(
  gateway: OnboardingDraftGateway,
  input: {
    excluded: boolean;
    expectedRevision: number;
    operationId: string;
    reason: string | null;
    rowId: string;
  }
) {
  return gateway.call<{ draftRevision: number; operationId: string }>(
    "set_onboarding_draft_row_excluded",
    {
      p_excluded: input.excluded,
      p_expected_revision: input.expectedRevision,
      p_operation_id: input.operationId,
      p_reason: input.reason,
      p_row_id: input.rowId,
    }
  );
}

export async function validateOnboardingDraft(
  gateway: OnboardingDraftGateway,
  input: { expectedRevision: number; operationId: string }
) {
  return gateway.call<{
    draftRevision: number;
    operationId: string;
    status: "previewed";
    validRows: number;
  }>("validate_onboarding_draft", {
    p_expected_revision: input.expectedRevision,
    p_operation_id: input.operationId,
  });
}

export async function publishOnboardingDraft(
  gateway: OnboardingDraftGateway,
  input: { expectedRevision: number; makeCurrent: boolean; operationId: string }
) {
  return gateway.call<Record<string, unknown>>("commit_onboarding_draft", {
    p_expected_revision: input.expectedRevision,
    p_make_current: input.makeCurrent,
    p_operation_id: input.operationId,
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asIssueArray(value: unknown, sourceRow: number): OnboardingRowIssue[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((issue) => {
    const parsed = onboardingRowIssueSchema.safeParse(issue);
    if (parsed.success) return [parsed.data];

    const legacy = asRecord(issue);
    if (typeof legacy.code !== "string" || typeof legacy.message !== "string") return [];
    const field =
      typeof legacy.field === "string" &&
      COMMITTEE_ONBOARDING_CANONICAL_FIELDS.includes(
        legacy.field as (typeof COMMITTEE_ONBOARDING_CANONICAL_FIELDS)[number]
      )
        ? (legacy.field as (typeof COMMITTEE_ONBOARDING_CANONICAL_FIELDS)[number])
        : null;
    const definition = field
      ? ONBOARDING_FIELD_CATALOG.find((candidate) => candidate.field === field)
      : null;
    return [
      {
        acceptedFormat:
          definition?.acceptedFormat ?? "Correct the row so its identity is internally consistent.",
        code: legacy.code.slice(0, 100),
        example: definition?.example ?? "One member per row",
        explanation: legacy.message.slice(0, 1_000),
        field,
        receivedValue: "",
        sourceRow,
      },
    ];
  });
}

export async function loadOnboardingDraft(
  client: SupabaseClient<Database>,
  operationId: string
): Promise<OnboardingDraftRecord> {
  const flexible = asFlexibleClient(client);
  const { data: operation, error } = await flexible
    .from("bulk_operations")
    .select(
      "id, operation_type, status, original_filename, metadata, source_kind, source_sha256, target_term_id, draft_revision, validated_revision"
    )
    .eq("id", operationId)
    .maybeSingle();
  if (error) databaseFailure(error, "Unable to load the onboarding draft.");
  if (!operation) {
    throw new OnboardingDraftRepositoryError("not_found", "Onboarding draft not found.");
  }

  const { data: rowData, error: rowError } = await flexible
    .from("bulk_operation_rows")
    .select("id, row_number, raw_data, normalized_data, status, errors, is_excluded")
    .eq("operation_id", operationId)
    .order("row_number", { ascending: true });
  if (rowError) databaseFailure(rowError, "Unable to load the onboarding draft rows.");

  return {
    draftRevision: Number(operation.draft_revision),
    id: String(operation.id),
    metadata: asRecord(operation.metadata),
    operationType: String(operation.operation_type) as CommitteeOnboardingOperationType,
    originalFilename:
      typeof operation.original_filename === "string" ? operation.original_filename : null,
    rows: (rowData ?? []).map((row: Record<string, unknown>) => ({
      errors: asIssueArray(row.errors, Number(row.row_number)),
      id: String(row.id),
      isExcluded: Boolean(row.is_excluded),
      normalizedData: asRecord(row.normalized_data),
      rawData: Object.fromEntries(
        Object.entries(asRecord(row.raw_data)).map(([key, value]) => [key, String(value ?? "")])
      ),
      rowNumber: Number(row.row_number),
      status: String(row.status),
    })),
    sourceKind: String(operation.source_kind) as CommitteeIntakeSourceKind,
    sourceSha256:
      typeof operation.source_sha256 === "string" ? operation.source_sha256 : null,
    status: String(operation.status),
    targetTermId:
      typeof operation.target_term_id === "string" ? operation.target_term_id : null,
    validatedRevision:
      operation.validated_revision === null ? null : Number(operation.validated_revision),
  };
}

function chunks<T>(values: readonly T[], size = 100): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

async function selectInChunks(
  client: ReturnType<typeof asFlexibleClient>,
  table: string,
  select: string,
  column: string,
  values: readonly string[],
  apply?: (query: ReturnType<ReturnType<typeof asFlexibleClient>["from"]>) => unknown
) {
  const records: Record<string, unknown>[] = [];
  for (const group of chunks([...new Set(values)].filter(Boolean))) {
    let query = client.from(table).select(select).in(column, group);
    if (apply) query = apply(query) as typeof query;
    const { data, error } = await query;
    if (error) databaseFailure(error, "Unable to load onboarding validation data.");
    records.push(...((data ?? []) as Record<string, unknown>[]));
  }
  return records;
}

function valueFromRow(row: IntakeRow, mapping: CommitteeOnboardingColumnMapping, field: keyof CommitteeOnboardingColumnMapping) {
  const key = mapping[field];
  return key ? (row.values[key] ?? "").trim() : "";
}

export async function loadOnboardingNormalizationContext(
  client: SupabaseClient<Database>,
  input: {
    mapping: CommitteeOnboardingColumnMapping;
    table: IntakeTable;
    targetTermId: string | null;
  }
): Promise<OnboardingNormalizationContext> {
  const flexible = asFlexibleClient(client);
  const [departmentResult, aliasResult] = await Promise.all([
    flexible
      .from("departments")
      .select("code, name, short_code")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    flexible
      .from("department_aliases")
      .select("department_code, alias")
      .eq("is_active", true)
      .order("normalized_alias", { ascending: true }),
  ]);
  if (departmentResult.error || aliasResult.error) {
    databaseFailure(
      departmentResult.error ?? aliasResult.error,
      "Unable to load the active department catalog."
    );
  }
  const aliasesByDepartment = new Map<string, string[]>();
  for (const alias of (aliasResult.data ?? []) as Record<string, unknown>[]) {
    const departmentCode = String(alias.department_code);
    aliasesByDepartment.set(departmentCode, [
      ...(aliasesByDepartment.get(departmentCode) ?? []),
      String(alias.alias),
    ]);
  }
  const departments: ExistingDepartmentSnapshot[] = (
    (departmentResult.data ?? []) as Record<string, unknown>[]
  ).map((department) => ({
    aliases: aliasesByDepartment.get(String(department.code)) ?? [],
    internalCode: String(department.code),
    name: String(department.name),
    shortCode: String(department.short_code),
  }));
  const jnuitsIds = input.table.rows
    .map((row) => normalizeJnuitsIdForCreation(valueFromRow(row, input.mapping, "jnuitsId")))
    .filter(Boolean);
  const emails = input.table.rows
    .map((row) => valueFromRow(row, input.mapping, "email").toLocaleLowerCase("en-US"))
    .filter(Boolean);
  const memberSelect =
    "id, jnuits_id, email, full_name, lifecycle_status, member_type, department_code, batch_no, joined_on, phone, student_id, facebook_url, linkedin_url, website_url, updated_at";
  const [membersById, membersByEmail] = await Promise.all([
    selectInChunks(flexible, "members", memberSelect, "jnuits_id", jnuitsIds),
    selectInChunks(flexible, "members", memberSelect, "email", emails),
  ]);
  const members = new Map<string, Record<string, unknown>>();
  for (const member of [...membersById, ...membersByEmail]) members.set(String(member.id), member);
  const existingMembers: ExistingMemberSnapshot[] = [...members.values()].map((member) => ({
    batchNo: member.batch_no as number | null,
    departmentCode: member.department_code as string | null,
    email: member.email as string | null,
    facebookUrl: member.facebook_url as string | null,
    fullName: String(member.full_name),
    id: String(member.id),
    jnuitsId: String(member.jnuits_id),
    joinedOn: member.joined_on as string | null,
    lifecycleStatus: String(member.lifecycle_status),
    linkedinUrl: member.linkedin_url as string | null,
    memberType: String(member.member_type),
    phone: member.phone as string | null,
    studentId: member.student_id as string | null,
    updatedAt: String(member.updated_at),
    websiteUrl: member.website_url as string | null,
  }));

  let positions: PositionSnapshot[] = [];
  let existingAssignments: ExistingAssignmentSnapshot[] = [];
  let targetTermUpdatedAt: string | null = null;
  if (input.targetTermId) {
    const { data: targetTerm, error: targetTermError } = await flexible
      .from("committee_terms")
      .select("id, term_kind, updated_at")
      .eq("id", input.targetTermId)
      .maybeSingle();
    if (targetTermError) {
      databaseFailure(targetTermError, "Unable to load the target committee term.");
    }
    if (!targetTerm || String(targetTerm.term_kind) !== "executive") {
      throw new OnboardingDraftRepositoryError(
        "invalid_target_term",
        "Choose a valid executive committee term."
      );
    }
    targetTermUpdatedAt = String(targetTerm.updated_at);

    const { data: positionData, error: positionError } = await flexible
      .from("committee_term_positions")
      .select(
        "term_id, role_id, priority, is_public, public_label, public_label_bn, updated_at, committee_roles!inner(code, title, title_bn)"
      )
      .eq("term_id", input.targetTermId)
      .order("priority", { ascending: true });
    if (positionError) databaseFailure(positionError, "Unable to load committee positions.");
    positions = (positionData ?? []).map((position: Record<string, unknown>) => {
      const related = Array.isArray(position.committee_roles)
        ? asRecord(position.committee_roles[0])
        : asRecord(position.committee_roles);
      return {
        code: String(related.code ?? position.role_id),
        isVisible: Boolean(position.is_public),
        priority: Number(position.priority),
        roleId: String(position.role_id),
        termId: String(position.term_id),
        title: String(position.public_label ?? related.title ?? ""),
        titleBn:
          typeof position.public_label_bn === "string"
            ? position.public_label_bn
            : typeof related.title_bn === "string"
              ? related.title_bn
              : null,
        updatedAt: String(position.updated_at),
      };
    });

    const memberIds = existingMembers.map(({ id }) => id);
    const assignments = await selectInChunks(
      flexible,
      "committee_assignments",
      "id, term_id, role_id, member_id, starts_on, ends_on, sort_order, is_public, status, updated_at",
      "member_id",
      memberIds,
      (query) => query.eq("term_id", input.targetTermId)
    );
    existingAssignments = assignments.map((assignment) => ({
      endsOn: assignment.ends_on as string | null,
      id: String(assignment.id),
      isPublic: Boolean(assignment.is_public),
      memberId: String(assignment.member_id),
      roleId: String(assignment.role_id),
      sortOrder: Number(assignment.sort_order),
      startsOn: assignment.starts_on as string | null,
      status: String(assignment.status) as ExistingAssignmentSnapshot["status"],
      termId: String(assignment.term_id),
      updatedAt: String(assignment.updated_at),
    }));
  }

  const mediaIds = input.table.rows
    .map((row) => valueFromRow(row, input.mapping, "avatarMediaId"))
    .filter((value) => /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value));
  const media = await selectInChunks(
    flexible,
    "media_assets",
    "id, public_id, secure_url, media_kind, is_public, deleted_at, bytes, format, width, height",
    "id",
    mediaIds
  );
  const approvedMedia: ApprovedMediaSnapshot[] = media.map((asset) => ({
    bytes: asset.bytes as number | null,
    deletedAt: asset.deleted_at as string | null,
    format: asset.format as string | null,
    height: asset.height as number | null,
    id: String(asset.id),
    isPublic: Boolean(asset.is_public),
    mediaKind: String(asset.media_kind),
    publicId: asset.public_id as string | null,
    secureUrl: asset.secure_url as string | null,
    width: asset.width as number | null,
  }));

  return {
    approvedMedia,
    departments,
    existingAssignments,
    existingMembers,
    positions,
    targetTermUpdatedAt,
  };
}

export function getMemberSearchWindow(input: { page: number; pageSize: number }) {
  const from = (input.page - 1) * input.pageSize;
  return { from, to: from + input.pageSize - 1 };
}

export async function searchOnboardingMembers(
  client: SupabaseClient<Database>,
  input: { page: number; pageSize: number; query: string }
) {
  const flexible = asFlexibleClient(client);
  const { from, to } = getMemberSearchWindow(input);
  const safeQuery = input.query.normalize("NFKC").trim().replace(/[,()%]/g, " ").slice(0, 100);
  let request = flexible
    .from("members")
    .select("id, jnuits_id, email, full_name, lifecycle_status, member_type", { count: "exact" })
    .neq("lifecycle_status", "deleted");
  if (safeQuery) {
    const pattern = `%${safeQuery}%`;
    request = request.or(
      `full_name.ilike.${pattern},jnuits_id.ilike.${pattern},email.ilike.${pattern}`
    );
  }
  const { data, error, count } = await request
    .order("full_name", { ascending: true })
    .order("id", { ascending: true })
    .range(from, to);
  if (error) databaseFailure(error, "Unable to search members.");
  return {
    members: (data ?? []).map((member: Record<string, unknown>) => ({
      email: typeof member.email === "string" ? member.email : null,
      fullName: String(member.full_name),
      id: String(member.id),
      jnuitsId: typeof member.jnuits_id === "string" ? member.jnuits_id : null,
      lifecycleStatus: String(member.lifecycle_status),
      memberType: String(member.member_type),
    })),
    page: input.page,
    pageSize: input.pageSize,
    total: count ?? 0,
  };
}

export function draftRowsAsTable(rows: readonly OnboardingDraftRecord["rows"][number][]): IntakeTable {
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row.rawData)))];
  return {
    availableSheets: [],
    headers: headers.map((key, columnIndex) => ({ columnIndex, key, label: key })),
    rows: rows.map((row) => ({ sourceRowNumber: row.rowNumber, values: row.rawData })),
    selectedSheet: null,
  };
}

export function inferredMappingForTable(table: IntakeTable) {
  return inferColumnMapping(table.headers);
}
