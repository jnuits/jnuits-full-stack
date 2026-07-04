import {
  normalizeCertificateId,
  type PublicCertificateRecord,
} from "@/lib/certificates/public-batch";
import { createPublicClient } from "@/lib/supabase/public";

const certificateSelect =
  "certificate_id, full_name, details, exam_or_event, exam_or_event_name, issue_date, asset_url";
const legacyCertificateSelect =
  "certificate_id, first_name, last_name, details, exam_or_event, exam_or_event_name, issue_date, asset_url";
const MISSING_PUBLIC_CERTIFICATES_VIEW_TTL_MS = 60_000;

let missingPublicCertificatesViewUntil = 0;

export type PublicCertificate = PublicCertificateRecord;

type CertificateQueryError = {
  code?: string;
  message?: string;
};

type LegacyPublicCertificateRecord = Omit<PublicCertificateRecord, "full_name"> & {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
};

export function isMissingPublicCertificatesViewError(
  error: CertificateQueryError | null
) {
  return (
    error?.code === "PGRST205" &&
    typeof error.message === "string" &&
    error.message.includes("public.public_certificates")
  );
}

function isMissingFullNameColumnError(error: CertificateQueryError | null) {
  return (
    (error?.code === "42703" || error?.code === "PGRST204") &&
    typeof error.message === "string" &&
    error.message.includes("full_name")
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
  certificate: PublicCertificateRecord | LegacyPublicCertificateRecord | null
): PublicCertificate | null {
  if (!certificate) {
    return null;
  }

  if (typeof certificate.full_name === "string" && certificate.full_name.trim()) {
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

  const legacyCertificate = certificate as LegacyPublicCertificateRecord;
  const legacyName = [legacyCertificate.first_name, legacyCertificate.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ")
    .trim();

  return {
    asset_url: certificate.asset_url,
    certificate_id: certificate.certificate_id,
    details: certificate.details,
    exam_or_event: certificate.exam_or_event,
    exam_or_event_name: certificate.exam_or_event_name,
    full_name: legacyName || certificate.certificate_id,
    issue_date: certificate.issue_date,
  };
}

function normalizeCertificateRecords(
  certificates: Array<PublicCertificateRecord | LegacyPublicCertificateRecord>
) {
  return certificates
    .map((certificate) => normalizeCertificateRecord(certificate))
    .filter((certificate): certificate is PublicCertificate => Boolean(certificate));
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
      if (isMissingFullNameColumnError(viewResult.error)) {
        const legacyViewResult = await supabase
          .from("public_certificates")
          .select(legacyCertificateSelect)
          .eq("certificate_id", certificateId)
          .maybeSingle();

        if (legacyViewResult.error) {
          throw legacyViewResult.error;
        }

        clearMissingPublicCertificatesView();
        return normalizeCertificateRecord(
          legacyViewResult.data as unknown as LegacyPublicCertificateRecord | null
        );
      }

      if (viewResult.error) {
        throw viewResult.error;
      }

      clearMissingPublicCertificatesView();
      return normalizeCertificateRecord(
        viewResult.data as PublicCertificateRecord | null
      );
    }

    rememberMissingPublicCertificatesView();
  }

  const fallbackResult = await supabase
    .from("certificates")
    .select(certificateSelect)
    .eq("certificate_id", certificateId)
    .maybeSingle();

  if (isMissingFullNameColumnError(fallbackResult.error)) {
    const legacyFallbackResult = await supabase
      .from("certificates")
      .select(legacyCertificateSelect)
      .eq("certificate_id", certificateId)
      .maybeSingle();

    if (legacyFallbackResult.error) {
      throw legacyFallbackResult.error;
    }

    return normalizeCertificateRecord(
      legacyFallbackResult.data as unknown as LegacyPublicCertificateRecord | null
    );
  }

  if (fallbackResult.error) {
    throw fallbackResult.error;
  }

  return normalizeCertificateRecord(
    fallbackResult.data as PublicCertificateRecord | null
  );
}

export async function findCertificatesByIds(rawIds: string[]) {
  const certificateIds = Array.from(
    new Set(rawIds.map(normalizeCertificateId).filter(Boolean))
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
      if (isMissingFullNameColumnError(viewResult.error)) {
        const legacyViewResult = await supabase
          .from("public_certificates")
          .select(legacyCertificateSelect)
          .in("certificate_id", certificateIds);

        if (legacyViewResult.error) {
          throw legacyViewResult.error;
        }

        clearMissingPublicCertificatesView();
        return normalizeCertificateRecords(
          (legacyViewResult.data || []) as unknown as LegacyPublicCertificateRecord[]
        );
      }

      if (viewResult.error) {
        throw viewResult.error;
      }

      clearMissingPublicCertificatesView();
      return normalizeCertificateRecords(
        (viewResult.data || []) as PublicCertificateRecord[]
      );
    }

    rememberMissingPublicCertificatesView();
  }

  const fallbackResult = await supabase
    .from("certificates")
    .select(certificateSelect)
    .in("certificate_id", certificateIds);

  if (isMissingFullNameColumnError(fallbackResult.error)) {
    const legacyFallbackResult = await supabase
      .from("certificates")
      .select(legacyCertificateSelect)
      .in("certificate_id", certificateIds);

    if (legacyFallbackResult.error) {
      throw legacyFallbackResult.error;
    }

    return normalizeCertificateRecords(
      (legacyFallbackResult.data || []) as unknown as LegacyPublicCertificateRecord[]
    );
  }

  if (fallbackResult.error) {
    throw fallbackResult.error;
  }

  return normalizeCertificateRecords(
    (fallbackResult.data || []) as PublicCertificateRecord[]
  );
}