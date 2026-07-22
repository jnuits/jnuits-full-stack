import "server-only";

import type { FlexibleSupabaseClient } from "@/lib/supabase/flexible";
import {
  archiveRetentionDriveFile,
  createFormArchiveMaterials,
  signRetentionArchiveManifest,
  type RetentionArchiveAssetReference,
  type RetentionArchiveSubmissionRow,
} from "@/lib/retention/archive";
import {
  canApproveRetentionPurge,
  canArchiveRetentionJob,
  canPurgeRetentionJob,
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
const ACTIVE_STATUSES: RetentionJobStatus[] = [
  "archive_requested",
  "archived",
  "candidate",
  "purge_approved",
];

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

function resourceColumn(scope: RetentionScope) {
  return scope === "form" ? "form_definition_id" : "event_id";
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

async function existingResourceIds(
  admin: FlexibleSupabaseClient,
  scope: RetentionScope,
  ids: string[]
) {
  if (!ids.length) return new Set<string>();

  const column = resourceColumn(scope);
  const result = await admin
    .from(jobTable(scope))
    .select(column)
    .in(column, ids)
    .in("status", ACTIVE_STATUSES);

  if (result.error) {
    throw new RetentionWorkflowError("Existing retention jobs could not be checked.");
  }

  return new Set(
    (result.data || [])
      .map((row: Record<string, unknown>) => row[column])
      .filter((value: unknown): value is string => typeof value === "string")
  );
}

async function insertCandidates(
  admin: FlexibleSupabaseClient,
  scope: RetentionScope,
  candidates: Array<{ eligibleAt: string; resourceId: string }>,
  actorUserId: string
) {
  const existing = await existingResourceIds(
    admin,
    scope,
    candidates.map((candidate) => candidate.resourceId)
  );
  const column = resourceColumn(scope);
  const rows = candidates
    .filter((candidate) => !existing.has(candidate.resourceId))
    .map((candidate) => ({
      [column]: candidate.resourceId,
      requested_by_user_id: actorUserId,
      retention_eligible_at: candidate.eligibleAt,
      status: "candidate",
    }));

  if (!rows.length) return 0;

  const result = await admin.from(jobTable(scope)).insert(rows);

  if (result.error && result.error.code !== "23505") {
    throw new RetentionWorkflowError("Retention candidates could not be saved.");
  }

  return result.error ? 0 : rows.length;
}

async function discoverRetentionCandidates(
  admin: FlexibleSupabaseClient,
  actorUserId: string
) {
  const cutoff = new Date();
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 3);
  const cutoffIso = cutoff.toISOString();
  const oldSubmissions = await loadPagedRows(
    (from, to) =>
      admin
        .from("form_submissions")
        .select("form_definition_id, created_at")
        .lte("created_at", cutoffIso)
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

  const eventResult = await admin
    .from("events")
    .select("id, starts_at, ends_at")
    .or(`ends_at.lte.${cutoffIso},and(ends_at.is.null,starts_at.lte.${cutoffIso})`)
    .order("starts_at", { ascending: true })
    .range(0, 999);

  if (eventResult.error) {
    throw new RetentionWorkflowError("Retention-eligible events could not be scanned.");
  }

  const formCreated = await insertCandidates(
    admin,
    "form",
    [...oldestByForm.entries()].map(([resourceId, createdAt]) => ({
      eligibleAt: retentionEligibleAt(createdAt),
      resourceId,
    })),
    actorUserId
  );
  const eventCreated = await insertCandidates(
    admin,
    "event",
    (eventResult.data || []).flatMap((row: Record<string, unknown>) => {
      const id = row.id;
      const sourceDate = row.ends_at || row.starts_at;
      return typeof id === "string" && typeof sourceDate === "string"
        ? [{ eligibleAt: retentionEligibleAt(sourceDate), resourceId: id }]
        : [];
    }),
    actorUserId
  );

  await recordAudit(admin, actorUserId, "retention.discovery_completed", null, {
    event_candidates_created: eventCreated,
    form_candidates_created: formCreated,
  });

  return { created: eventCreated + formCreated, eventCreated, formCreated, success: true };
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
  formDefinitionId: string
): Promise<RetentionArchiveSubmissionRow[]> {
  const rows = await loadPagedRows(
    (from, to) =>
      admin
        .from("form_submissions")
        .select(
          "id, form_version_id, submitter_email, answers, confirmation_status, review_status, created_at, form_submission_assets(field_id, cloudinary_asset_id, cloudinary_public_id, cloudinary_version, cloudinary_folder, bytes, content_type, sha256)"
        )
        .eq("form_definition_id", formDefinitionId)
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
  event: EventTarget
): Promise<EventArchiveRow[]> {
  const rows = await loadPagedRows(
    (from, to) =>
      applyEventScope(
        admin
          .from("event_registrations")
          .select(
            "id, registrant_name, registrant_email, registrant_phone, registration_code, registration_status, created_at, waitlisted_at, promoted_at, checked_in_at, cancelled_at"
          )
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
  materials,
  prefix,
  resourceId,
  rowCount,
  scope,
}: {
  assetReferences: RetentionArchiveAssetReference[];
  materials: { csv: Buffer; json: Buffer; xlsx: Buffer };
  prefix: string;
  resourceId: string;
  rowCount: number;
  scope: RetentionScope;
}) {
  const uploads = await Promise.all([
    uploadGoogleDriveFile({ data: materials.csv, filename: `${prefix}.csv`, mimeType: "text/csv" }),
    uploadGoogleDriveFile({ data: materials.json, filename: `${prefix}.json`, mimeType: "application/json" }),
    uploadGoogleDriveFile({
      data: materials.xlsx,
      filename: `${prefix}.xlsx`,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  ]);
  const files = [
    archiveRetentionDriveFile(`${prefix}.csv`, uploads[0].id, materials.csv),
    archiveRetentionDriveFile(`${prefix}.json`, uploads[1].id, materials.json),
    archiveRetentionDriveFile(`${prefix}.xlsx`, uploads[2].id, materials.xlsx),
  ];
  const signed = signRetentionArchiveManifest({
    archivedAt: new Date().toISOString(),
    assetReferences,
    files,
    resourceId,
    rowCount,
    scope,
  });
  const manifestData = Buffer.from(JSON.stringify(signed, null, 2), "utf8");
  const manifestUpload = await uploadGoogleDriveFile({
    data: manifestData,
    filename: `${prefix}-manifest.json`,
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
  };
}

async function archiveRetentionJob(
  admin: FlexibleSupabaseClient,
  scope: RetentionScope,
  jobId: string,
  actorUserId: string
) {
  const job = await loadJob(admin, scope, jobId);

  if (!canArchiveRetentionJob(job.status)) {
    throw new RetentionWorkflowError("Retention job is not ready to archive.", 409);
  }

  const resourceId =
    scope === "form" ? job.form_definition_id : job.event_id;
  if (!resourceId) throw new RetentionWorkflowError("Retention job target is missing.");

  const requested = await admin
    .from(jobTable(scope))
    .update({ error_code: null, status: "archive_requested" })
    .eq("id", jobId)
    .eq("status", job.status);
  if (requested.error) {
    throw new RetentionWorkflowError("Retention archive could not be started.");
  }

  try {
    const date = new Date().toISOString().slice(0, 10);
    let archiveExportJobId: null | string = null;
    let bundle: Awaited<ReturnType<typeof uploadArchiveBundle>>;
    let rowCount = 0;

    if (scope === "form") {
      const rows = await loadFormRows(admin, resourceId);
      const materials = createFormArchiveMaterials(resourceId, rows);
      rowCount = materials.rowCount;
      bundle = await uploadArchiveBundle({
        assetReferences: materials.assetReferences,
        materials,
        prefix: `form-${resourceId}-retention-${date}`,
        resourceId,
        rowCount,
        scope,
      });
    } else {
      const event = await loadEventTarget(admin, resourceId);
      const rows = await loadEventRows(admin, event);
      const materials = createEventArchiveMaterials(event.id, rows);
      const assetReferences = await loadEventAssetReferences(
        admin,
        rows.map((row) => row.id)
      );
      rowCount = materials.rowCount;
      bundle = await uploadArchiveBundle({
        assetReferences,
        materials,
        prefix: `event-${event.id}-retention-${date}`,
        resourceId: event.id,
        rowCount,
        scope,
      });

      const exportJob = await admin
        .from("event_export_jobs")
        .insert({
          checksum_sha256: bundle.checksum,
          destination: "google_drive",
          event_id: event.id,
          export_kind: "event_archive",
          filter_metadata: { schema_version: 1 },
          format: "archive_manifest",
          google_drive_file_id: bundle.manifestFileId,
          requested_by_user_id: actorUserId,
          row_count: rowCount,
          status: "completed",
        })
        .select("id")
        .single();
      if (exportJob.error || !exportJob.data?.id) {
        throw new RetentionWorkflowError("Event archive audit job could not be saved.");
      }
      archiveExportJobId = exportJob.data.id;
    }

    const completion: Record<string, unknown> = {
      archive_manifest: bundle.manifest,
      error_code: null,
      manifest_checksum_sha256: bundle.checksum,
      status: "archived",
    };
    if (archiveExportJobId) completion.archive_export_job_id = archiveExportJobId;
    const completed = await admin
      .from(jobTable(scope))
      .update(completion)
      .eq("id", jobId)
      .eq("status", "archive_requested");
    if (completed.error) {
      throw new RetentionWorkflowError("Retention archive record could not be completed.");
    }

    await recordAudit(admin, actorUserId, "retention.archive_completed", resourceId, {
      job_id: jobId,
      row_count: rowCount,
      scope,
    });
    return { rowCount, success: true };
  } catch (error) {
    await admin
      .from(jobTable(scope))
      .update({ error_code: "archive_failed", status: "failed" })
      .eq("id", jobId);
    throw error;
  }
}

async function approveRetentionPurge(
  admin: FlexibleSupabaseClient,
  scope: RetentionScope,
  jobId: string,
  actorUserId: string
) {
  const job = await loadJob(admin, scope, jobId);
  if (!canApproveRetentionPurge(job.status)) {
    throw new RetentionWorkflowError("Archive must complete before purge approval.", 409);
  }

  const approvedAt = new Date().toISOString();
  const result = await admin
    .from(jobTable(scope))
    .update({
      approved_at: approvedAt,
      approved_by_user_id: actorUserId,
      status: "purge_approved",
    })
    .eq("id", jobId)
    .eq("status", "archived");
  if (result.error) {
    throw new RetentionWorkflowError("Retention purge approval could not be saved.");
  }

  await recordAudit(admin, actorUserId, "retention.purge_approved", jobId, {
    scope,
  });
  return { success: true };
}

async function purgeRetentionJob(
  admin: FlexibleSupabaseClient,
  scope: RetentionScope,
  jobId: string,
  actorUserId: string
) {
  const job = await loadJob(admin, scope, jobId);
  if (!canPurgeRetentionJob(job.status)) {
    throw new RetentionWorkflowError("Purge requires an archived, approved job.", 409);
  }

  const result = await admin.rpc("purge_retention_job", {
    p_actor_user_id: actorUserId,
    p_job_id: jobId,
    p_scope: scope,
  });
  if (result.error) {
    throw new RetentionWorkflowError("Retention source PII could not be purged.");
  }

  return result.data || { success: true };
}
async function recordAudit(
  admin: FlexibleSupabaseClient,
  actorUserId: string,
  action: string,
  entityId: null | string,
  metadata: Record<string, unknown>
) {
  const result = await admin.from("audit_events").insert({
    action,
    actor_user_id: actorUserId,
    entity_id: entityId,
    entity_type: "retention_job",
    metadata: metadata as never,
  });
  if (result.error) {
    throw new RetentionWorkflowError("Retention audit record could not be saved.");
  }
}

export async function runRetentionAction(
  admin: FlexibleSupabaseClient,
  action: RetentionAction
) {
  if (action.action === "discover") {
    return discoverRetentionCandidates(admin, action.actorUserId);
  }
  if (action.action === "archive") {
    return archiveRetentionJob(
      admin,
      action.scope,
      action.jobId,
      action.actorUserId
    );
  }
  if (action.action === "approve_purge") {
    return approveRetentionPurge(
      admin,
      action.scope,
      action.jobId,
      action.actorUserId
    );
  }
  return purgeRetentionJob(
    admin,
    action.scope,
    action.jobId,
    action.actorUserId
  );
}
