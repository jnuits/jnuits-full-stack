import "server-only";

import { verifyRetentionArchiveManifest, type SignedRetentionArchiveManifest } from "./archive";
import type { RetentionScope } from "./operations";
import type { FlexibleSupabaseClient } from "@/lib/supabase/flexible";

export class RetentionArchiveVerificationError extends Error {}

type ArchiveRecord = {
  archive_manifest: unknown;
  manifest_checksum_sha256: null | string;
  status: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseVerifiedRetentionArchiveRecord(record: ArchiveRecord) {
  if (record.status !== "archived") {
    throw new RetentionArchiveVerificationError("Archive must complete before purge approval.");
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
  return candidate;
}

export async function requireVerifiedRetentionArchive(
  admin: FlexibleSupabaseClient,
  scope: RetentionScope,
  jobId: string,
) {
  const table = scope === "form" ? "form_archive_jobs" : "event_retention_jobs";
  const result = await admin
    .from(table)
    .select("status, archive_manifest, manifest_checksum_sha256")
    .eq("id", jobId)
    .maybeSingle();

  if (result.error || !result.data) {
    throw new RetentionArchiveVerificationError("Retention archive could not be verified.");
  }
  return parseVerifiedRetentionArchiveRecord(result.data as ArchiveRecord);
}
