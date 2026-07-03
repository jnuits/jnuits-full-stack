import type { Tables } from "@/lib/db/types";

export const MAX_BATCH_IDS = 25;
export const MAX_CERTIFICATE_ID_LENGTH = 80;

export type PublicCertificateRecord = Tables<"public_certificates">;

export function normalizeCertificateId(value: string) {
  return value.trim().toUpperCase();
}

export function isValidCertificateId(value: string) {
  return (
    value.length > 0 &&
    value.length <= MAX_CERTIFICATE_ID_LENGTH &&
    !/[\u0000-\u001F\u007F]/.test(value)
  );
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
    full_name: certificate.full_name,
    issue_date: certificate.issue_date,
  };
}
