import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";

export async function createFormUploadSession(options: {
  expiresAt: string; formDefinitionId: string; formVersionId: string; manifestSha256: string; sessionId: string;
}) {
  const admin = asFlexibleClient(createAdminClient());
  const { error } = await admin.from("form_upload_sessions").insert({
    expires_at: options.expiresAt,
    form_definition_id: options.formDefinitionId,
    form_version_id: options.formVersionId,
    id: options.sessionId,
    manifest_sha256: options.manifestSha256,
  });
  if (error) throw new Error("Secure upload authorization could not be created.");
}

export async function consumeFormUploadSession(options: {
  formDefinitionId: string; formVersionId: string; manifestSha256: string; sessionId: string;
}) {
  const admin = asFlexibleClient(createAdminClient());
  const { data, error } = await admin.rpc("consume_form_upload_session", {
    p_form_definition_id: options.formDefinitionId,
    p_form_version_id: options.formVersionId,
    p_manifest_sha256: options.manifestSha256,
    p_session_id: options.sessionId,
  });
  if (error) throw new Error("Secure upload authorization could not be consumed.");
  return data === true;
}
