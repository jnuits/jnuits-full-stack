import type { Tables } from "@/lib/db/types";

export const MAX_BATCH_IDS = 25;

export type PublicCertificateRecord = Tables<"public_certificates">;

export function normalizeCertificateId(value: string) {
  return value.trim().toUpperCase();
}

export function normalizeIds(input: unknown) {
  if (!Array.isArray(input)) {
    return [];
  }

  return Array.from(
    new Set(
      input
        .map((value) => (typeof value === "string" ? normalizeCertificateId(value) : ""))
        .filter(Boolean)
    )
  ).slice(0, MAX_BATCH_IDS);
}

export function toPublicCertificate<T extends PublicCertificateRecord>(certificate: T) {
  return {
    asset_url: certificate.asset_url,
    certificate_id: certificate.certificate_id,
    details: certificate.details,
    exam_or_event: certificate.exam_or_event,
    exam_or_event_name: certificate.exam_or_event_name,
    first_name: certificate.first_name,
    issue_date: certificate.issue_date,
    last_name: certificate.last_name,
  };
}
