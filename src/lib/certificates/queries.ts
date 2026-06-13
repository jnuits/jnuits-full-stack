import {
  normalizeCertificateId,
  type PublicCertificateRecord,
} from "@/lib/certificates/public-batch";
import { createPublicClient } from "@/lib/supabase/public";

const certificateSelect =
  "certificate_id, first_name, last_name, details, exam_or_event, exam_or_event_name, issue_date, asset_url";

export type PublicCertificate = PublicCertificateRecord;

type CertificateQueryError = {
  code?: string;
  message?: string;
};

function isMissingPublicCertificatesViewError(error: CertificateQueryError | null) {
  return (
    error?.code === "PGRST205" &&
    typeof error.message === "string" &&
    error.message.includes("public.public_certificates")
  );
}

export async function findCertificateById(rawId: string) {
  const certificateId = normalizeCertificateId(rawId);

  if (!certificateId) {
    return null;
  }

  const supabase = createPublicClient();
  const viewResult = await supabase
    .from("public_certificates")
    .select(certificateSelect)
    .eq("certificate_id", certificateId)
    .maybeSingle();

  if (!isMissingPublicCertificatesViewError(viewResult.error)) {
    if (viewResult.error) {
      throw viewResult.error;
    }

    return viewResult.data as PublicCertificate | null;
  }

  const fallbackResult = await supabase
    .from("certificates")
    .select(certificateSelect)
    .eq("certificate_id", certificateId)
    .maybeSingle();

  if (fallbackResult.error) {
    throw fallbackResult.error;
  }

  return fallbackResult.data as PublicCertificate | null;
}

export async function findCertificatesByIds(rawIds: string[]) {
  const certificateIds = Array.from(
    new Set(rawIds.map(normalizeCertificateId).filter(Boolean))
  ).slice(0, 200);

  if (!certificateIds.length) {
    return [];
  }

  const supabase = createPublicClient();
  const viewResult = await supabase
    .from("public_certificates")
    .select(certificateSelect)
    .in("certificate_id", certificateIds);

  if (!isMissingPublicCertificatesViewError(viewResult.error)) {
    if (viewResult.error) {
      throw viewResult.error;
    }

    return (viewResult.data || []) as PublicCertificate[];
  }

  const fallbackResult = await supabase
    .from("certificates")
    .select(certificateSelect)
    .in("certificate_id", certificateIds);

  if (fallbackResult.error) {
    throw fallbackResult.error;
  }

  return (fallbackResult.data || []) as PublicCertificate[];
}
