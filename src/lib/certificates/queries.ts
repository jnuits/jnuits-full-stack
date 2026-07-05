import {
  normalizeCertificateId,
  type PublicCertificateRecord,
} from "@/lib/certificates/public-batch";
import { createPublicClient } from "@/lib/supabase/public";

const certificateSelect =
  "certificate_id, full_name, details, exam_or_event, exam_or_event_name, issue_date, asset_url";
const MISSING_PUBLIC_CERTIFICATES_VIEW_TTL_MS = 60_000;

let missingPublicCertificatesViewUntil = 0;

export type PublicCertificate = PublicCertificateRecord;

type CertificateQueryError = {
  code?: string;
  message?: string;
};

export function isMissingPublicCertificatesViewError(
  error: CertificateQueryError | null,
) {
  return (
    error?.code === "PGRST205" &&
    typeof error.message === "string" &&
    error.message.includes("public.public_certificates")
  );
}

function shouldSkipPublicCertificatesView() {
  return Date.now() < missingPublicCertificatesViewUntil;
}

function rememberMissingPublicCertificatesView() {
  missingPublicCertificatesViewUntil =
    Date.now() + MISSING_PUBLIC_CERTIFICATES_VIEW_TTL_MS;
}

function clearMissingPublicCertificatesView() {
  missingPublicCertificatesViewUntil = 0;
}

function normalizeCertificateRecord(
  certificate: PublicCertificateRecord | null,
): PublicCertificate | null {
  if (!certificate) {
    return null;
  }

  return {
    asset_url: certificate.asset_url,
    certificate_id: certificate.certificate_id,
    details: certificate.details,
    exam_or_event: certificate.exam_or_event,
    exam_or_event_name: certificate.exam_or_event_name,
    full_name: certificate.full_name.trim(),
    issue_date: certificate.issue_date,
  };
}

function normalizeCertificateRecords(certificates: PublicCertificateRecord[]) {
  return certificates
    .map((certificate) => normalizeCertificateRecord(certificate))
    .filter((certificate): certificate is PublicCertificate =>
      Boolean(certificate),
    );
}

export function resetPublicCertificateViewCacheForTests() {
  clearMissingPublicCertificatesView();
}

export async function findCertificateById(rawId: string) {
  const certificateId = normalizeCertificateId(rawId);

  if (!certificateId) {
    return null;
  }

  const supabase = createPublicClient();
  if (!shouldSkipPublicCertificatesView()) {
    const viewResult = await supabase
      .from("public_certificates")
      .select(certificateSelect)
      .eq("certificate_id", certificateId)
      .maybeSingle();

    if (!isMissingPublicCertificatesViewError(viewResult.error)) {
      if (viewResult.error) {
        throw viewResult.error;
      }

      clearMissingPublicCertificatesView();
      return normalizeCertificateRecord(
        viewResult.data as PublicCertificateRecord | null,
      );
    }

    rememberMissingPublicCertificatesView();
  }

  const fallbackResult = await supabase
    .from("certificates")
    .select(certificateSelect)
    .eq("certificate_id", certificateId)
    .maybeSingle();

  if (fallbackResult.error) {
    throw fallbackResult.error;
  }

  return normalizeCertificateRecord(
    fallbackResult.data as PublicCertificateRecord | null,
  );
}

export async function findCertificatesByIds(rawIds: string[]) {
  const certificateIds = Array.from(
    new Set(rawIds.map(normalizeCertificateId).filter(Boolean)),
  ).slice(0, 200);

  if (!certificateIds.length) {
    return [];
  }

  const supabase = createPublicClient();
  if (!shouldSkipPublicCertificatesView()) {
    const viewResult = await supabase
      .from("public_certificates")
      .select(certificateSelect)
      .in("certificate_id", certificateIds);

    if (!isMissingPublicCertificatesViewError(viewResult.error)) {
      if (viewResult.error) {
        throw viewResult.error;
      }

      clearMissingPublicCertificatesView();
      return normalizeCertificateRecords(
        (viewResult.data || []) as PublicCertificateRecord[],
      );
    }

    rememberMissingPublicCertificatesView();
  }

  const fallbackResult = await supabase
    .from("certificates")
    .select(certificateSelect)
    .in("certificate_id", certificateIds);

  if (fallbackResult.error) {
    throw fallbackResult.error;
  }

  return normalizeCertificateRecords(
    (fallbackResult.data || []) as PublicCertificateRecord[],
  );
}
