export type RetentionJobStatus =
  | "archive_requested"
  | "archived"
  | "candidate"
  | "failed"
  | "purge_approved"
  | "purged";

export const RETENTION_YEARS = 3;

/**
 * The instant a record created at `createdAt` becomes retention eligible:
 * exactly three calendar years later, in UTC.
 */
export function retentionEligibleAt(createdAt: string) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) throw new Error("Retention candidate has an invalid timestamp.");
  date.setUTCFullYear(date.getUTCFullYear() + RETENTION_YEARS);
  return date.toISOString();
}

/**
 * The exact calendar cutoff for a retention run. Records created at or before
 * this instant are eligible; anything newer must never be archived or purged.
 * This is the single source of truth for row selection, and it is recorded in
 * the signed archive manifest so purge can reuse the same boundary.
 */
export function retentionBoundaryAt(now = new Date()) {
  if (Number.isNaN(now.getTime())) throw new Error("Retention comparison time is invalid.");
  const boundary = new Date(now.getTime());
  boundary.setUTCFullYear(boundary.getUTCFullYear() - RETENTION_YEARS);
  return boundary.toISOString();
}

export function isRetentionEligible(createdAt: string, now = new Date()) {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) throw new Error("Retention candidate has an invalid timestamp.");
  return created.getTime() <= new Date(retentionBoundaryAt(now)).getTime();
}

export function canArchiveRetentionJob(status: RetentionJobStatus) {
  return status === "candidate" || status === "failed";
}
export function canApproveRetentionPurge(status: RetentionJobStatus) { return status === "archived"; }
export function canPurgeRetentionJob(status: RetentionJobStatus) { return status === "purge_approved"; }
export function redactEventRegistrantEmail(registrationId: string) { return `purged-${registrationId}@retained.invalid`; }
