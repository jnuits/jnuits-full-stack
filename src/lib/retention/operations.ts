import "server-only";
import { z } from "zod";

import type { FlexibleSupabaseClient } from "@/lib/supabase/flexible";
import { requireVerifiedRetentionArchive } from "@/lib/retention/approval";
import {
  archiveRetentionDriveFile,
  createFormArchiveMaterials,
  serializeRetentionArchiveManifest,
  signRetentionArchiveManifest,
  type RetentionArchiveAssetReference,
  type RetentionArchiveSubmissionRow,
} from "@/lib/retention/archive";
import {
  canApproveRetentionPurge,
  canArchiveRetentionJob,
  canPurgeRetentionJob,
  retentionBoundaryAt,
  retentionEligibleAt,
  type RetentionJobStatus,
} from "@/lib/retention/state";
import {
  createEventArchiveMaterials,
} from "@/lib/exports/event-archive";
import type { EventRegistrationExportRow } from "@/lib/exports/event-registrations";
import { sha256 } from "@/lib/exports/tabular";
import {
  isGoogleDriveExportConfigured,
  uploadGoogleDriveFile,
} from "@/lib/integrations/google-drive";

const PAGE_SIZE = 500;
const MAX_ROWS = 10_000;
const CONCURRENT_CHANGE_MESSAGE =
  "The retention job changed state in another session. Reload the workspace and try again.";

async function completeRetentionStep(admin: FlexibleSupabaseClient, attemptId: string, payload: Record<string, unknown>) {
  const result = await admin.rpc("complete_admin_retention_operation", { p_attempt_id: attemptId, p_payload: payload });
  if (result.error) {
    const code = asRecord(result.error).code;
    throw new RetentionWorkflowError(code === "40001" ? CONCURRENT_CHANGE_MESSAGE : "The verified retention update could not be confirmed. Refresh and verify again.", code === "40001" ? 409 : code === "42501" ? 403 : 500);
  }
  const parsed = z.object({ ok: z.literal(true), value: z.union([z.null(), z.object({ success: z.literal(true) }).passthrough()]) }).safeParse(result.data);
  const expectsNull = payload.stage === "archive_start" || payload.stage === "archive_failed";
  if (!parsed.success || (expectsNull ? parsed.data.value !== null : parsed.data.value === null)) {
    throw new RetentionWorkflowError("The verification completion could not be confirmed.");
  }
  return parsed.data.value;
}

export type RetentionScope = "event" | "form";

export type RetentionAction =
  | { action: "discover"; actorUserId: string }
  | { action: "archive"; actorUserId: string; jobId: string; scope: RetentionScope }
  | { action: "approve_purge"; actorUserId: string; jobId: string; scope: RetentionScope }
  | { action: "purge"; actorUserId: string; jobId: string; scope: RetentionScope };

type RetentionJobRow = {
  approved_at?: null | string;
  archive_manifest?: unknown;
  created_at: string;
  event_id?: string;
  events?: unknown;
  form_definition_id?: string;
  form_definitions?: unknown;
  id: string;
  retention_eligible_at: string;
  source_pii_purged_at?: null | string;
  status: RetentionJobStatus;
};

type EventTarget = {
  id: string;
  legacy_content_post_id: null | string;
  title: string;
};

type EventArchiveRow = EventRegistrationExportRow & { id: string };

type AssetRow = {
  bytes: number;
  cloudinary_asset_id: string;
  cloudinary_folder: string;
  cloudinary_public_id: string;
  cloudinary_version: string;
  content_type: string;
  sha256: string;
};

export class RetentionWorkflowError extends Error {
  constructor(message: string, readonly status = 500) {
    super(message);
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function relationTitle(value: unknown) {
  const relation = Array.isArray(value) ? value[0] : value;
  const title = asRecord(relation).title;
  return typeof title === "string" ? title : null;
}

function jobTable(scope: RetentionScope) {
  return scope === "form" ? "form_archive_jobs" : "event_retention_jobs";
}


function mapJob(row: RetentionJobRow, scope: RetentionScope) {
  return {
    approvedAt: row.approved_at || null,
    createdAt: row.created_at,
    id: row.id,
    resourceId:
      scope === "form" ? row.form_definition_id || "" : row.event_id || "",
    resourceTitle:
      scope === "form"
        ? relationTitle(row.form_definitions)
        : relationTitle(row.events),
    retentionEligibleAt: row.retention_eligible_at,
    scope,
    sourcePiiPurgedAt: row.source_pii_purged_at || null,
    status: row.status,
  };
}


export async function listRetentionWorkspace(admin: FlexibleSupabaseClient) {
  const [formResult, eventResult] = await Promise.all([
    admin
      .from("form_archive_jobs")
      .select(
        "id, form_definition_id, status, retention_eligible_at, created_at, approved_at, source_pii_purged_at, form_definitions(title)"
      )
      .order("created_at", { ascending: false })
      .range(0, 99),
    admin
      .from("event_retention_jobs")
      .select(
        "id, event_id, status, retention_eligible_at, created_at, approved_at, source_pii_purged_at, events(title)"
      )
      .order("created_at", { ascending: false })
      .range(0, 99),
  ]);

  if (formResult.error || eventResult.error) {
    throw new RetentionWorkflowError("Retention jobs could not be loaded.");
  }

  return {
    archiveConfigured:
      isGoogleDriveExportConfigured() &&
      Boolean(process.env.RETENTION_MANIFEST_SIGNING_SECRET?.trim()),
    eventJobs: ((eventResult.data || []) as RetentionJobRow[]).map((row) =>
      mapJob(row, "event")
    ),
    formJobs: ((formResult.data || []) as RetentionJobRow[]).map((row) =>
      mapJob(row, "form")
    ),
  };
}

async function loadPagedRows(
  loadPage: (
    from: number,
    to: number
  ) => PromiseLike<{ data: unknown; error: unknown }>,
  failureMessage: string
) {
  const rows: Record<string, unknown>[] = [];

  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const result = await loadPage(from, from + PAGE_SIZE - 1);

    if (result.error) {
      throw new RetentionWorkflowError(failureMessage);
    }

    const page = Array.isArray(result.data)
      ? (result.data as Record<string, unknown>[])
      : [];
    rows.push(...page);

    if (page.length < PAGE_SIZE) {
      return rows;
    }
  }

  throw new RetentionWorkflowError(
    "Retention work exceeds the 10,000-row safety limit.",
    409
  );
}


async function discoverRetentionCandidates(
  admin: FlexibleSupabaseClient,
  attemptId: string
) {
  const boundary = retentionBoundaryAt();
  const oldSubmissions = await loadPagedRows(
    (from, to) =>
      admin
        .from("form_submissions")
        .select("form_definition_id, created_at")
        .lte("created_at", boundary)
        .order("created_at", { ascending: true })
        .range(from, to),
    "Retention-eligible form submissions could not be scanned."
  );
  const oldestByForm = new Map<string, string>();

  for (const row of oldSubmissions) {
    const formId = row.form_definition_id;
    const createdAt = row.created_at;
    if (typeof formId !== "string" || typeof createdAt !== "string") continue;
    if (!oldestByForm.has(formId)) oldestByForm.set(formId, createdAt);
  }

  // Paged like submissions. A single fixed range silently dropped every event
  // past the first page while still reporting the run as successful.
  const eligibleEvents = await loadPagedRows(
    (from, to) =>
      admin
        .from("events")
        .select("id, starts_at, ends_at")
        .or(`ends_at.lte.${boundary},and(ends_at.is.null,starts_at.lte.${boundary})`)
        .order("starts_at", { ascending: true })
        .range(from, to),
    "Retention-eligible events could not be scanned."
  );

  const formCandidates = [...oldestByForm.entries()].map(([resourceId, createdAt]) => ({
      eligibleAt: retentionEligibleAt(createdAt),
      resourceId,
    }));
  const eventCandidates = eligibleEvents.flatMap((row) => {
      const id = row.id;
      const sourceDate = row.ends_at || row.starts_at;
      return typeof id === "string" && typeof sourceDate === "string"
        ? [{ eligibleAt: retentionEligibleAt(sourceDate), resourceId: id }]
        : [];
    });
  return completeRetentionStep(admin, attemptId, { intent: {}, stage: "discover", boundary, formCandidates, eventCandidates });
}

async function loadJob(
  admin: FlexibleSupabaseClient,
  scope: RetentionScope,
  jobId: string
) {
  const result = await admin
    .from(jobTable(scope))
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  const row = result.data as RetentionJobRow | null;

  if (result.error || !row) {
    throw new RetentionWorkflowError("Retention job was not found.", 404);
  }

  return row;
}

async function loadFormRows(
  admin: FlexibleSupabaseClient,
  formDefinitionId: string,
  boundary: string
): Promise<RetentionArchiveSubmissionRow[]> {
  const rows = await loadPagedRows(
    (from, to) =>
      admin
        .from("form_submissions")
        .select(
          "id, form_version_id, submitter_email, answers, confirmation_status, review_status, created_at, form_submission_assets(field_id, cloudinary_asset_id, cloudinary_public_id, cloudinary_version, cloudinary_folder, bytes, content_type, sha256)"
        )
        .eq("form_definition_id", formDefinitionId)
        .lte("created_at", boundary)
        .order("created_at", { ascending: true })
        .range(from, to),
    "Form archive rows could not be loaded."
  );

  return rows.map((row) => ({
    answers: asRecord(row.answers),
    assets: Array.isArray(row.form_submission_assets)
      ? (row.form_submission_assets as RetentionArchiveSubmissionRow["assets"])
      : [],
    confirmation_status: String(row.confirmation_status || ""),
    created_at: String(row.created_at || ""),
    form_version_id: String(row.form_version_id || ""),
    id: String(row.id || ""),
    review_status: String(row.review_status || ""),
    submitter_email:
      typeof row.submitter_email === "string" ? row.submitter_email : null,
  }));
}

async function loadEventTarget(
  admin: FlexibleSupabaseClient,
  eventId: string
): Promise<EventTarget> {
  const result = await admin
    .from("events")
    .select("id, legacy_content_post_id, title")
    .eq("id", eventId)
    .maybeSingle();

  if (result.error || !result.data) {
    throw new RetentionWorkflowError("Event archive target was not found.", 404);
  }

  return result.data as EventTarget;
}

function applyEventScope<
  T extends {
    eq: (column: string, value: string) => T;
    or: (filter: string) => T;
  },
>(query: T, event: EventTarget): T {
  return event.legacy_content_post_id
    ? query.or(
        `event_id.eq.${event.id},event_post_id.eq.${event.legacy_content_post_id}`
      )
    : query.eq("event_id", event.id);
}

async function loadEventRows(
  admin: FlexibleSupabaseClient,
  event: EventTarget,
  boundary: string
): Promise<EventArchiveRow[]> {
  const rows = await loadPagedRows(
    (from, to) =>
      applyEventScope(
        admin
          .from("event_registrations")
          .select(
            "id, registrant_name, registrant_email, registrant_phone, registration_code, registration_status, created_at, waitlisted_at, promoted_at, checked_in_at, cancelled_at"
          )
          .lte("created_at", boundary)
          .order("created_at", { ascending: true }),
        event
      ).range(from, to),
    "Event archive rows could not be loaded."
  );

  return rows as unknown as EventArchiveRow[];
}

function assetReference(row: AssetRow): RetentionArchiveAssetReference {
  return {
    assetId: row.cloudinary_asset_id,
    bytes: row.bytes,
    contentType: row.content_type,
    folder: row.cloudinary_folder,
    publicId: row.cloudinary_public_id,
    sha256: row.sha256,
    version: row.cloudinary_version,
  };
}

async function loadEventAssetReferences(
  admin: FlexibleSupabaseClient,
  registrationIds: string[]
) {
  if (!registrationIds.length) return [];

  const submissionResult = await admin
    .from("form_submissions")
    .select("id")
    .in("event_registration_id", registrationIds);

  if (submissionResult.error) {
    throw new RetentionWorkflowError("Event archive asset links could not be loaded.");
  }

  const submissionIds = (submissionResult.data || [])
    .map((row: Record<string, unknown>) => row.id)
    .filter((value: unknown): value is string => typeof value === "string");

  if (!submissionIds.length) return [];

  const assetResult = await admin
    .from("form_submission_assets")
    .select(
      "cloudinary_asset_id, cloudinary_public_id, cloudinary_version, cloudinary_folder, bytes, content_type, sha256"
    )
    .in("form_submission_id", submissionIds);

  if (assetResult.error) {
    throw new RetentionWorkflowError("Event archive assets could not be loaded.");
  }

  return (assetResult.data || []).map((row: AssetRow) => assetReference(row));
}

async function uploadArchiveBundle({
  assetReferences,
  boundary,
  jobId,
  materials,
  prefix,
  resourceId,
  rowCount,
  scope,
}: {
  assetReferences: RetentionArchiveAssetReference[];
  boundary: string;
  jobId: string;
  materials: { csv: Buffer; json: Buffer; xlsx: Buffer };
  prefix: string;
  resourceId: string;
  rowCount: number;
  scope: RetentionScope;
}) {
  // Deterministic per logical file, so a retry after a partial failure reuses
  // whatever already landed in the Shared Drive instead of duplicating it.
  const dataKey = (kind: string, data: Buffer) =>
    `${scope}:${jobId}:${resourceId}:${kind}:${sha256(data)}`;
  const uploads = await Promise.all([
    uploadGoogleDriveFile({
      data: materials.csv,
      filename: `${prefix}.csv`,
      idempotencyKey: dataKey("csv", materials.csv),
      mimeType: "text/csv",
    }),
    uploadGoogleDriveFile({
      data: materials.json,
      filename: `${prefix}.json`,
      idempotencyKey: dataKey("json", materials.json),
      mimeType: "application/json",
    }),
    uploadGoogleDriveFile({
      data: materials.xlsx,
      filename: `${prefix}.xlsx`,
      idempotencyKey: dataKey("xlsx", materials.xlsx),
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  ]);
  const files = [
    archiveRetentionDriveFile(`${prefix}.csv`, uploads[0].id, materials.csv),
    archiveRetentionDriveFile(`${prefix}.json`, uploads[1].id, materials.json),
    archiveRetentionDriveFile(`${prefix}.xlsx`, uploads[2].id, materials.xlsx),
  ];
  const archivedAt = new Date().toISOString();
  const signed = signRetentionArchiveManifest({
    archivedAt,
    assetReferences,
    boundary,
    files,
    resourceId,
    rowCount,
    scope,
  });
  const manifestData = Buffer.from(serializeRetentionArchiveManifest(signed), "utf8");
  // The manifest embeds its own archive time, so its bytes differ per attempt.
  // Keying it by that time keeps the stored checksum matching the file that
  // actually exists in Drive instead of an earlier manifest.
  const manifestUpload = await uploadGoogleDriveFile({
    data: manifestData,
    filename: `${prefix}-manifest.json`,
    idempotencyKey: `${scope}:${jobId}:${resourceId}:manifest:${archivedAt}`,
    mimeType: "application/json",
  });

  return {
    checksum: sha256(manifestData),
    manifest: {
      ...signed,
      manifestFile: archiveRetentionDriveFile(
        `${prefix}-manifest.json`,
        manifestUpload.id,
        manifestData
      ),
    },
    manifestFileId: manifestUpload.id,
    reusedFiles: uploads.filter((upload) => upload.reused).length,
  };
}

async function markArchiveFailed(
  admin: FlexibleSupabaseClient,
  scope: RetentionScope,
  jobId: string,
  attemptId: string
) {
  try {
    // Constrained to archive_requested so a job that has since been archived,
    // approved, or purged can never be demoted back into a re-archivable state.
    await completeRetentionStep(admin, attemptId, { intent: {jobId, scope}, stage: "archive_failed" });
  } catch {
    // Never let failure bookkeeping mask the original archive error.
  }
}

async function archiveRetentionJob(
  admin: FlexibleSupabaseClient,
  scope: RetentionScope,
  jobId: string,
  attemptId: string
) {
  const job = await loadJob(admin, scope, jobId);

  if (!canArchiveRetentionJob(job.status)) {
    throw new RetentionWorkflowError("Retention job is not ready to archive.", 409);
  }

  const now = new Date();
  if (new Date(job.retention_eligible_at).getTime() > now.getTime()) {
    throw new RetentionWorkflowError(
      "This job has not reached its three-year retention boundary yet.",
      409
    );
  }

  const boundary = retentionBoundaryAt(now);
  const resourceId =
    scope === "form" ? job.form_definition_id : job.event_id;
  if (!resourceId) throw new RetentionWorkflowError("Retention job target is missing.");

  await completeRetentionStep(admin, attemptId, { intent: {jobId, scope}, stage: "archive_start", boundary });

  try {
    const date = now.toISOString().slice(0, 10);
    let bundle: Awaited<ReturnType<typeof uploadArchiveBundle>>;
    let rowCount = 0;

    if (scope === "form") {
      const rows = await loadFormRows(admin, resourceId, boundary);
      const materials = createFormArchiveMaterials(resourceId, rows);
      rowCount = materials.rowCount;
      bundle = await uploadArchiveBundle({
        assetReferences: materials.assetReferences,
        boundary,
        jobId,
        materials,
        prefix: `form-${resourceId}-retention-${date}`,
        resourceId,
        rowCount,
        scope,
      });
    } else {
      const event = await loadEventTarget(admin, resourceId);
      const rows = await loadEventRows(admin, event, boundary);
      const materials = createEventArchiveMaterials(event.id, rows);
      const assetReferences = await loadEventAssetReferences(
        admin,
        rows.map((row) => row.id)
      );
      rowCount = materials.rowCount;
      bundle = await uploadArchiveBundle({
        assetReferences,
        boundary,
        jobId,
        materials,
        prefix: `event-${event.id}-retention-${date}`,
        resourceId: event.id,
        rowCount,
        scope,
      });

    }
    await completeRetentionStep(admin, attemptId, {
      intent: {jobId, scope}, stage: "archive_complete", boundary, bundle, reusedFiles: bundle.reusedFiles, rowCount,
    });
    return { boundary, reusedFiles: bundle.reusedFiles, rowCount, success: true };
  } catch (error) {
    await markArchiveFailed(admin, scope, jobId, attemptId);
    throw error;
  }
}

async function approveRetentionPurge(
  admin: FlexibleSupabaseClient,
  scope: RetentionScope,
  jobId: string,
  attemptId: string
) {
  const job = await loadJob(admin, scope, jobId);
  if (!canApproveRetentionPurge(job.status)) {
    throw new RetentionWorkflowError("Archive must complete before purge approval.", 409);
  }

  const archive = await requireVerifiedRetentionArchive(admin, scope, jobId);
  return completeRetentionStep(admin, attemptId, {intent: {jobId, scope}, stage: "approve_purge", archiveManifest: archive,
    archiveChecksum: sha256(Buffer.from(serializeRetentionArchiveManifest(archive), "utf8"))});
}

async function purgeRetentionJob(
  admin: FlexibleSupabaseClient,
  scope: RetentionScope,
  jobId: string,
  attemptId: string
) {
  const job = await loadJob(admin, scope, jobId);
  if (!canPurgeRetentionJob(job.status)) {
    throw new RetentionWorkflowError("Purge requires an archived, approved job.", 409);
  }

  // The boundary is read back out of the signed manifest inside
  // purge_retention_job, so the purge can only ever touch rows the archive
  // already captured.
  const archive = await requireVerifiedRetentionArchive(admin, scope, jobId, {allowedStatuses: ["purge_approved"], statusMessage: "Purge requires an archived, approved job."});
  return completeRetentionStep(admin, attemptId, {intent: {jobId, scope, confirmation: "PURGE"}, stage: "purge", archiveManifest: archive,
    archiveChecksum: sha256(Buffer.from(serializeRetentionArchiveManifest(archive), "utf8"))});
}


export async function runRetentionAction(
  admin: FlexibleSupabaseClient,
  action: RetentionAction,
  attemptId: string
) {
  if (!z.uuid().safeParse(attemptId).success) throw new RetentionWorkflowError("A reserved verification operation is required.", 403);
  if (action.action === "discover") {
    return discoverRetentionCandidates(admin, attemptId);
  }
  if (action.action === "archive") {
    return archiveRetentionJob(
      admin,
      action.scope,
      action.jobId,
      attemptId
    );
  }
  if (action.action === "approve_purge") {
    return approveRetentionPurge(
      admin,
      action.scope,
      action.jobId,
      attemptId
    );
  }
  return purgeRetentionJob(
    admin,
    action.scope,
    action.jobId,
    attemptId
  );
}
