export type RetentionJobStatus =
  | "archive_requested"
  | "archived"
  | "candidate"
  | "failed"
  | "purge_approved"
  | "purged";

export function retentionEligibleAt(createdAt: string) {
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Retention candidate has an invalid timestamp.");
  }

  date.setUTCFullYear(date.getUTCFullYear() + 3);
  return date.toISOString();
}

export function canArchiveRetentionJob(status: RetentionJobStatus) {
  return status === "candidate" || status === "failed";
}

export function canApproveRetentionPurge(status: RetentionJobStatus) {
  return status === "archived";
}

export function canPurgeRetentionJob(status: RetentionJobStatus) {
  return status === "purge_approved";
}

export function redactEventRegistrantEmail(registrationId: string) {
  return `purged-${registrationId}@retained.invalid`;
}
