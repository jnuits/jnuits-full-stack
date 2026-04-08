import type { Database } from "@/lib/db/types";
import { createClient } from "@/lib/supabase/server";

const certificateSelect =
  "id, certificate_id, first_name, last_name, details, exam_or_event, exam_or_event_name, issue_date, asset_url, source_document_id, source_record_id, source_migrated_at, created_at, updated_at";

export type CertificateRecord = Database["public"]["Tables"]["certificates"]["Row"];

export function normalizeCertificateId(value: string) {
  return value.trim().toUpperCase();
}

export async function findCertificateById(rawId: string) {
  const certificateId = normalizeCertificateId(rawId);

  if (!certificateId) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("certificates")
    .select(certificateSelect)
    .eq("certificate_id", certificateId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as CertificateRecord | null;
}

export async function findCertificatesByIds(rawIds: string[]) {
  const certificateIds = Array.from(
    new Set(rawIds.map(normalizeCertificateId).filter(Boolean))
  ).slice(0, 200);

  if (!certificateIds.length) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("certificates")
    .select(certificateSelect)
    .in("certificate_id", certificateIds);

  if (error) {
    throw error;
  }

  return (data || []) as CertificateRecord[];
}
