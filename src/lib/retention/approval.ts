import "server-only";

import {
  serializeRetentionArchiveManifest,
  verifyRetentionArchiveManifest,
  type SignedRetentionArchiveManifest,
} from "./archive";
import { sha256 } from "@/lib/exports/tabular";
import type { RetentionScope } from "./operations";
import type { FlexibleSupabaseClient } from "@/lib/supabase/flexible";

export class RetentionArchiveVerificationError extends Error {}

type ArchiveRecord = {
  archive_manifest: unknown;
  manifest_checksum_sha256: null | string;
  status: string;
};

export type RetentionArchiveVerificationOptions = {
  allowedStatuses?: readonly string[];
  statusMessage?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseVerifiedRetentionArchiveRecord(
  record: ArchiveRecord,
  options: RetentionArchiveVerificationOptions = {}
) {
  const allowedStatuses = options.allowedStatuses || ["archived"];
  if (!allowedStatuses.includes(record.status)) {
    throw new RetentionArchiveVerificationError(
      options.statusMessage || "Archive must complete before purge approval."
    );
  }
  if (!record.manifest_checksum_sha256 || !/^[a-f0-9]{64}$/.test(record.manifest_checksum_sha256)) {
    throw new RetentionArchiveVerificationError("Archive checksum verification is missing.");
  }
  if (!isRecord(record.archive_manifest)) {
    throw new RetentionArchiveVerificationError("Archive manifest is missing.");
  }

  const candidate = record.archive_manifest as unknown as SignedRetentionArchiveManifest;
  if (!verifyRetentionArchiveManifest(candidate)) {
    throw new RetentionArchiveVerificationError("Archive manifest signature verification failed.");
  }

  const checksumPayload = Buffer.from(
    serializeRetentionArchiveManifest(candidate),
    "utf8"
  );
  if (sha256(checksumPayload) !== record.manifest_checksum_sha256) {
    throw new RetentionArchiveVerificationError("Archive manifest checksum verification failed.");
  }

  return candidate;
}

export async function requireVerifiedRetentionArchive(
  admin: FlexibleSupabaseClient,
  scope: RetentionScope,
  jobId: string,
  options: RetentionArchiveVerificationOptions = {}
) {
  const table = scope === "form" ? "form_archive_jobs" : "event_retention_jobs";
  const resourceColumn = scope === "form" ? "form_definition_id" : "event_id";
  const result = await admin
    .from(table)
    .select(`status, archive_manifest, manifest_checksum_sha256, ${resourceColumn}`)
    .eq("id", jobId)
    .maybeSingle();

  if (result.error || !result.data) {
    throw new RetentionArchiveVerificationError("Retention archive could not be verified.");
  }

  const row = result.data as ArchiveRecord & Record<string, unknown>;
  const archive = parseVerifiedRetentionArchiveRecord(row, options);
  if (
    archive.manifest.scope !== scope ||
    archive.manifest.resourceId !== row[resourceColumn]
  ) {
    throw new RetentionArchiveVerificationError(
      "Archive manifest does not belong to this retention job."
    );
  }

  return archive;
}
