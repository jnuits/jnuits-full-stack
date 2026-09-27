"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSafeAdminActionErrorMessage } from "@/lib/admin/action-error";
import { requireAdminPermission } from "@/lib/auth/session";
import {
  COMMITTEE_INTAKE_SOURCE_KINDS,
  COMMITTEE_ONBOARDING_CANONICAL_FIELDS,
  COMMITTEE_ONBOARDING_OPERATION_TYPES,
  parseCommitteeDraftMetadata,
  type CommitteeOnboardingColumnMapping,
  type CommitteeOnboardingOperationType,
} from "@/lib/committee/onboarding/contracts";
import {
  buildOnboardingDraftRows,
  createSupabaseOnboardingDraftGateway,
  draftRowsAsTable,
  editOnboardingDraftRow,
  inspectOnboardingSource,
  loadOnboardingDraft,
  loadOnboardingNormalizationContext,
  OnboardingDraftRepositoryError,
  persistOnboardingDraft,
  publishOnboardingDraft,
  searchOnboardingMembers,
  setOnboardingDraftRowExcluded,
  validateOnboardingDraft,
} from "@/lib/committee/onboarding/draft-repository";
import { resolveColumnMapping } from "@/lib/committee/onboarding/field-catalog";
import {
  assertIntakeSourceSize,
  IntakeParseError,
} from "@/lib/committee/onboarding/intake-contracts";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/utils/supabase/server";

const ONBOARDING_PATH = "/admin/onboarding";
const ONBOARDING_PERMISSIONS = [
  "admin.committee.manage",
  "admin.membership.manage",
] as const;

type ActionResult<T> =
  | { data: T; message: string; ok: true }
  | { message: string; ok: false };

const operationTypeSchema = z.enum(COMMITTEE_ONBOARDING_OPERATION_TYPES);
const sourceKindSchema = z.enum(COMMITTEE_INTAKE_SOURCE_KINDS);
const uuidSchema = z.string().uuid();
const revisionSchema = z.number().int().positive();
const sourceRequestSchema = z.object({
  operationType: operationTypeSchema,
  sheetName: z.string().trim().min(1).max(120).optional(),
  sourceKind: sourceKindSchema,
});
const canonicalFieldSet = new Set<string>(COMMITTEE_ONBOARDING_CANONICAL_FIELDS);
const scalarSchema = z.union([z.string().max(2_000), z.number(), z.boolean(), z.null()]);
const manualRowsSchema = z
  .array(z.record(z.string(), scalarSchema))
  .min(1, "Add at least one manual member.")
  .max(1_000)
  .superRefine((rows, context) => {
    rows.forEach((row, rowIndex) => {
      for (const key of Object.keys(row)) {
        if (!canonicalFieldSet.has(key)) {
          context.addIssue({
            code: "custom",
            message: `Manual row ${rowIndex + 1} contains an unsupported field.`,
            path: [rowIndex, key],
          });
        }
      }
    });
  });
const columnMappingSchema = z
  .record(z.string(), z.string().trim().min(1).max(160))
  .superRefine((mapping, context) => {
    for (const key of Object.keys(mapping)) {
      if (!canonicalFieldSet.has(key)) {
        context.addIssue({
          code: "custom",
          message: "Column mapping contains an unsupported destination field.",
          path: [key],
        });
      }
    }
  });
const existingDraftSchema = z.object({ operationId: uuidSchema });
const exclusionSchema = z
  .object({
    excluded: z.boolean(),
    expectedRevision: revisionSchema,
    operationId: uuidSchema,
    reason: z.string().trim().max(500).nullable().default(null),
    rowId: uuidSchema,
  })
  .superRefine((value, context) => {
    if (value.excluded && !value.reason) {
      context.addIssue({
        code: "custom",
        message: "Explain why this row is excluded.",
        path: ["reason"],
      });
    }
  });
const editRowSchema = z.object({
  expectedRevision: revisionSchema,
  operationId: uuidSchema,
  rawData: z.record(z.string().max(160), z.string().max(2_000)),
  rowId: uuidSchema,
});
const validateSchema = z.object({
  expectedRevision: revisionSchema,
  operationId: uuidSchema,
});
const publishSchema = validateSchema.extend({ makeCurrent: z.boolean().default(false) });
const searchSchema = z.object({
  operationType: operationTypeSchema,
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(1).max(50).default(20),
  query: z
    .string()
    .trim()
    .max(100)
    .regex(/^[\p{L}\p{M}\p{N}@._+\-\s]*$/u, "Search contains unsupported characters."),
});

function permissionForOperation(operationType: CommitteeOnboardingOperationType) {
  return operationType === "committee_roster_import"
    ? "admin.committee.manage"
    : "admin.membership.manage";
}

async function requireOnboardingPermission(operationType: CommitteeOnboardingOperationType) {
  return requireAdminPermission(permissionForOperation(operationType), {
    fallbackPath: ONBOARDING_PATH,
  });
}

function formText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function optionalFormText(formData: FormData, key: string) {
  const value = formText(formData, key).trim();
  return value || undefined;
}

function parseJson(value: string, label: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new IntakeParseError("invalid_delimited_source", `${label} is not valid JSON.`);
  }
}

function uploadFromForm(formData: FormData) {
  const value = formData.get("sourceFile");
  if (
    !value ||
    typeof value === "string" ||
    typeof (value as Blob).arrayBuffer !== "function"
  ) {
    return null;
  }
  return value as File;
}

async function inspectFormSource(
  formData: FormData,
  request: z.infer<typeof sourceRequestSchema>
) {
  const upload = uploadFromForm(formData);
  let bytes: Buffer | undefined;
  let manualRows: Record<string, string>[] | undefined;
  let text: string | undefined;

  if (request.sourceKind === "manual") {
    const parsed = manualRowsSchema.parse(
      parseJson(formText(formData, "manualRows"), "Manual rows")
    );
    manualRows = parsed.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, value === null ? "" : String(value)])
      )
    );
  } else if (request.sourceKind === "pasted_tsv") {
    text = formText(formData, "sourceText");
  } else {
    if (!upload) {
      throw new IntakeParseError("empty_source", "Choose a source file to continue.");
    }
    assertIntakeSourceSize(upload.size);
    bytes = Buffer.from(await upload.arrayBuffer());
  }

  return inspectOnboardingSource({
    bytes,
    manualRows,
    originalFilename: upload?.name ?? null,
    sheetName: request.sheetName,
    sourceKind: request.sourceKind,
    text,
  });
}

function parseSourceRequest(formData: FormData) {
  return sourceRequestSchema.parse({
    operationType: formText(formData, "operationType"),
    sheetName: optionalFormText(formData, "sheetName"),
    sourceKind: formText(formData, "sourceKind"),
  });
}

function parseColumnMapping(formData: FormData, availableKeys: readonly string[]) {
  const raw = optionalFormText(formData, "columnMapping");
  const overrides = raw
    ? columnMappingSchema.parse(parseJson(raw, "Column mapping"))
    : {};
  const available = new Set(availableKeys);
  for (const sourceKey of Object.values(overrides)) {
    if (!available.has(sourceKey)) {
      throw new IntakeParseError(
        "invalid_delimited_source",
        "Column mapping references a heading that is not in this source."
      );
    }
  }
  return overrides as CommitteeOnboardingColumnMapping;
}

function actionError(error: unknown, fallback: string): { message: string; ok: false } {
  if (error instanceof z.ZodError) {
    return { message: error.issues[0]?.message || fallback, ok: false };
  }
  if (error instanceof IntakeParseError || error instanceof OnboardingDraftRepositoryError) {
    return { message: error.message, ok: false };
  }
  return {
    message: getSafeAdminActionErrorMessage(error, {
      context: "onboarding.action",
      fallback,
    }),
    ok: false,
  };
}

async function requireStoredDraft(operationId: string) {
  await requireAdminPermission([...ONBOARDING_PERMISSIONS], {
    fallbackPath: ONBOARDING_PATH,
  });
  const sessionClient = await createClient();
  const draft = await loadOnboardingDraft(sessionClient, operationId);
  await requireOnboardingPermission(draft.operationType);
  return { draft, sessionClient };
}

function revalidateOnboardingPaths() {
  revalidatePath(ONBOARDING_PATH);
  revalidatePath("/admin/committee");
  revalidatePath("/admin/membership");
  revalidatePath("/committee");
  revalidatePath("/members");
}

export async function inspectOnboardingSourceAction(
  formData: FormData
): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const request = parseSourceRequest(formData);
    await requireOnboardingPermission(request.operationType);
    const inspected = await inspectFormSource(formData, request);
    return {
      data: {
        availableSheets: inspected.table.availableSheets,
        headers: inspected.table.headers,
        inferredMapping: resolveColumnMapping(inspected.table.headers),
        originalFilename: inspected.originalFilename,
        previewRows: inspected.table.rows.slice(0, 25),
        rowCount: inspected.table.rows.length,
        selectedSheet: inspected.table.selectedSheet,
        sourceSha256: inspected.sourceSha256,
      },
      message: `${inspected.table.rows.length} source row(s) inspected.`,
      ok: true,
    };
  } catch (error) {
    return actionError(error, "Unable to inspect the onboarding source.");
  }
}

export async function createOnboardingDraftAction(
  formData: FormData
): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const request = parseSourceRequest(formData);
    const auth = await requireOnboardingPermission(request.operationType);
    const actorUserId = auth.user?.id;
    if (!actorUserId) return { message: "Admin session is missing.", ok: false };

    const inspected = await inspectFormSource(formData, request);
    const overrides = parseColumnMapping(
      formData,
      inspected.table.headers.map(({ key }) => key)
    );
    const mapping = resolveColumnMapping(inspected.table.headers, overrides);
    const targetTermInput = optionalFormText(formData, "targetTermId");
    const targetTermId = targetTermInput ? uuidSchema.parse(targetTermInput) : null;
    const readClient = createAdminClient();
    const context = await loadOnboardingNormalizationContext(readClient, {
      mapping,
      table: inspected.table,
      targetTermId,
    });
    const metadata = parseCommitteeDraftMetadata({
      columnMapping: mapping,
      operationType: request.operationType,
      originalFilename: inspected.originalFilename ?? undefined,
      schemaVersion: 1,
      sheetName: inspected.table.selectedSheet ?? undefined,
      sourceKind: request.sourceKind,
      sourceSha256: inspected.sourceSha256,
      targetTermId,
      targetTermUpdatedAt: context.targetTermUpdatedAt,
    });
    const rows = buildOnboardingDraftRows({
      context,
      mapping,
      operationType: metadata.operationType,
      table: inspected.table,
      targetTermId: metadata.targetTermId,
    });
    const sessionClient = await createClient();
    const result = await persistOnboardingDraft(
      createSupabaseOnboardingDraftGateway(sessionClient),
      { actorUserId, metadata, rows }
    );
    revalidateOnboardingPaths();
    return {
      data: result,
      message:
        result.errorRows > 0
          ? `Draft saved with ${result.errorRows} row(s) needing correction.`
          : "Draft saved. Review and validate it before publishing.",
      ok: true,
    };
  } catch (error) {
    return actionError(error, "Unable to create the onboarding draft.");
  }
}

export async function getOnboardingDraftAction(
  input: unknown
): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const parsed = existingDraftSchema.parse(input);
    const { draft } = await requireStoredDraft(parsed.operationId);
    return { data: draft, message: "Draft loaded.", ok: true };
  } catch (error) {
    return actionError(error, "Unable to load the onboarding draft.");
  }
}

export async function editOnboardingDraftRowAction(
  input: unknown
): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const parsed = editRowSchema.parse(input);
    const { draft, sessionClient } = await requireStoredDraft(parsed.operationId);
    const existingRow = draft.rows.find(({ id }) => id === parsed.rowId);
    if (!existingRow) {
      return { message: "Onboarding draft row not found.", ok: false };
    }
    const mapping = columnMappingSchema.parse(
      draft.metadata.columnMapping ?? {}
    ) as CommitteeOnboardingColumnMapping;
    const rowsForValidation = draft.rows
      .filter((row) => !row.isExcluded || row.id === existingRow.id)
      .map((row) =>
        row.id === existingRow.id ? { ...row, rawData: parsed.rawData } : row
      );
    const table = draftRowsAsTable(rowsForValidation);
    const context = await loadOnboardingNormalizationContext(createAdminClient(), {
      mapping,
      table,
      targetTermId: draft.targetTermId,
    });
    const normalizedRows = buildOnboardingDraftRows({
      context,
      mapping,
      operationType: draft.operationType,
      table,
      targetTermId: draft.targetTermId,
    });
    const normalizedRow = normalizedRows.find(
      ({ rowNumber }) => rowNumber === existingRow.rowNumber
    );
    if (!normalizedRow) {
      return { message: "Unable to normalize the edited row.", ok: false };
    }
    const result = await editOnboardingDraftRow(
      createSupabaseOnboardingDraftGateway(sessionClient),
      {
        expectedRevision: parsed.expectedRevision,
        operationId: parsed.operationId,
        row: normalizedRow,
        rowId: parsed.rowId,
      }
    );
    revalidatePath(ONBOARDING_PATH);
    return { data: result, message: "Draft row updated and rechecked.", ok: true };
  } catch (error) {
    return actionError(error, "Unable to update the onboarding draft row.");
  }
}

export async function setOnboardingDraftRowExcludedAction(
  input: unknown
): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const parsed = exclusionSchema.parse(input);
    const { sessionClient } = await requireStoredDraft(parsed.operationId);
    const result = await setOnboardingDraftRowExcluded(
      createSupabaseOnboardingDraftGateway(sessionClient),
      parsed
    );
    revalidatePath(ONBOARDING_PATH);
    return {
      data: result,
      message: parsed.excluded ? "Draft row excluded." : "Draft row restored.",
      ok: true,
    };
  } catch (error) {
    return actionError(error, "Unable to change the draft row state.");
  }
}

export async function validateOnboardingDraftAction(
  input: unknown
): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const parsed = validateSchema.parse(input);
    const { sessionClient } = await requireStoredDraft(parsed.operationId);
    const result = await validateOnboardingDraft(
      createSupabaseOnboardingDraftGateway(sessionClient),
      parsed
    );
    revalidatePath(ONBOARDING_PATH);
    return { data: result, message: "Draft validation passed.", ok: true };
  } catch (error) {
    return actionError(error, "The onboarding draft did not pass validation.");
  }
}

export async function publishOnboardingDraftAction(
  input: unknown
): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const parsed = publishSchema.parse(input);
    const { draft, sessionClient } = await requireStoredDraft(parsed.operationId);
    if (parsed.makeCurrent && draft.operationType !== "committee_roster_import") {
      return { message: "Only a committee roster can become the current committee.", ok: false };
    }
    const result = await publishOnboardingDraft(
      createSupabaseOnboardingDraftGateway(sessionClient),
      parsed
    );
    revalidateOnboardingPaths();
    return { data: result, message: "Onboarding draft published.", ok: true };
  } catch (error) {
    return actionError(error, "Unable to publish the onboarding draft.");
  }
}

export async function searchOnboardingMembersAction(
  input: unknown
): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const parsed = searchSchema.parse(input);
    await requireOnboardingPermission(parsed.operationType);
    const result = await searchOnboardingMembers(createAdminClient(), parsed);
    return { data: result, message: "Member search completed.", ok: true };
  } catch (error) {
    return actionError(error, "Unable to search members.");
  }
}
