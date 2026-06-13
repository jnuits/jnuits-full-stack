import {
  normalizeCertificateId,
  type PublicCertificateRecord,
} from "@/lib/certificates/public-batch";
import { createPublicClient } from "@/lib/supabase/public";

const certificateSelect =
  "certificate_id, first_name, last_name, details, exam_or_event, exam_or_event_name, issue_date, asset_url";

export type PublicCertificate = PublicCertificateRecord;

export async function findCertificateById(rawId: string) {
  const certificateId = normalizeCertificateId(rawId);

  if (!certificateId) {
    return null;
  }

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("public_certificates")
    .select(certificateSelect)
    .eq("certificate_id", certificateId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as PublicCertificate | null;
}

export async function findCertificatesByIds(rawIds: string[]) {
  const certificateIds = Array.from(
    new Set(rawIds.map(normalizeCertificateId).filter(Boolean))
  ).slice(0, 200);

  if (!certificateIds.length) {
    return [];
  }

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("public_certificates")
    .select(certificateSelect)
    .in("certificate_id", certificateIds);

  if (error) {
    throw error;
  }

  return (data || []) as PublicCertificate[];
}
