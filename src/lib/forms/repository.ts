import "server-only";

import {
  parseFormApplicationBehavior,
  type FormApplicationBehavior,
} from "@/lib/forms/application-behavior";
import {
  FormKindSchema,
  parseFormDefinition,
  type FormAnswers,
  type FormDefinition,
  type FormKind,
} from "@/lib/forms/definition";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";
import type { FormSubmissionAsset } from "./upload-proof";

export type PublishedForm = {
  applicationBehavior: FormApplicationBehavior;
  definition: FormDefinition;
  description: null | string;
  id: string;
  linkedEventId?: null | string;
  kind: FormKind;
  slug: string;
  title: string;
  versionId: string;
};

type FormDefinitionRow = {
  current_published_version_id: null | string;
  description: null | string;
  id: string;
  linked_event_id: null | string;
  kind: unknown;
  slug: string;
  title: string;
};

type FormVersionRow = {
  application_behavior: unknown;
  field_schema: unknown;
  id: string;
};

export async function loadPublishedForm(slug: string): Promise<null | PublishedForm> {
  const admin = asFlexibleClient(createAdminClient());
  const { data: definitionData, error: definitionError } = await admin
    .from("form_definitions")
    .select(
      "id, kind, slug, title, description, linked_event_id, current_published_version_id"
    )
    .eq("slug", slug)
    .eq("lifecycle", "published")
    .maybeSingle();

  if (definitionError) {
    throw definitionError;
  }

  const definitionRow = definitionData as FormDefinitionRow | null;
  if (!definitionRow?.current_published_version_id) {
    return null;
  }

  const { data: versionData, error: versionError } = await admin
    .from("form_versions")
    .select("id, field_schema, application_behavior")
    .eq("id", definitionRow.current_published_version_id)
    .eq("form_definition_id", definitionRow.id)
    .eq("lifecycle", "published")
    .maybeSingle();

  if (versionError) {
    throw versionError;
  }

  const versionRow = versionData as FormVersionRow | null;
  if (!versionRow) {
    return null;
  }

  const kind = FormKindSchema.parse(definitionRow.kind);
  const definition = parseFormDefinition(versionRow.field_schema);
  const applicationBehavior = parseFormApplicationBehavior(
    kind,
    versionRow.application_behavior,
    definition
  );

  return {
    applicationBehavior,
    definition,
    description: definitionRow.description,
    id: definitionRow.id,
    linkedEventId: definitionRow.linked_event_id,
    kind,
    slug: definitionRow.slug,
    title: definitionRow.title,
    versionId: versionRow.id,
  };
}

export async function loadPublishedFormByVersionId(
  versionId: string
): Promise<null | PublishedForm> {
  const admin = asFlexibleClient(createAdminClient());
  const { data, error } = await admin
    .from("form_definitions")
    .select("slug")
    .eq("current_published_version_id", versionId)
    .eq("lifecycle", "published")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.slug || typeof data.slug !== "string") {
    return null;
  }

  const form = await loadPublishedForm(data.slug);
  return form?.versionId === versionId ? form : null;
}

export async function loadPublishedFormByKind(kind: FormKind): Promise<null | PublishedForm> {
  const admin = asFlexibleClient(createAdminClient());
  const { data, error } = await admin
    .from("form_definitions")
    .select("slug")
    .eq("kind", kind)
    .eq("lifecycle", "published")
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.slug || typeof data.slug !== "string") {
    return null;
  }

  return loadPublishedForm(data.slug);
}

export async function createPendingFormSubmission(options: {
  answers: FormAnswers;
  confirmationExpiresAt: Date;
  confirmationTokenHash: string;
  formDefinitionId: string;
  formVersionId: string;
  submitterEmail: string;
}) {
  const admin = asFlexibleClient(createAdminClient());
  const { data, error } = await admin
    .from("form_submissions")
    .insert({
      answers: options.answers,
      confirmation_expires_at: options.confirmationExpiresAt.toISOString(),
      confirmation_status: "pending",
      confirmation_token_hash: options.confirmationTokenHash,
      form_definition_id: options.formDefinitionId,
      form_version_id: options.formVersionId,
      source_metadata: { source: "public_form" },
      submitter_email: options.submitterEmail,
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  if (!data?.id || typeof data.id !== "string") {
    throw new Error("Form submission was not created.");
  }

  return data.id;
}

export async function createFormSubmissionAssets(
  submissionId: string,
  assets: FormSubmissionAsset[]
) {
  if (!assets.length) {
    return;
  }

  const admin = asFlexibleClient(createAdminClient());
  const { error } = await admin.from("form_submission_assets").insert(
    assets.map((asset) => ({
      bytes: asset.bytes,
      cloudinary_asset_id: asset.cloudinaryAssetId,
      cloudinary_folder: asset.cloudinaryFolder,
      cloudinary_public_id: asset.cloudinaryPublicId,
      cloudinary_version: asset.cloudinaryVersion,
      content_type: asset.contentType,
      field_id: asset.fieldId,
      form_submission_id: submissionId,
      sha256: asset.sha256,
    }))
  );

  if (error) {
    throw error;
  }
}

export async function markFormConfirmationSent(submissionId: string, tokenHash?: string) {
  const admin = asFlexibleClient(createAdminClient());
  let query = admin
    .from("form_submissions")
    .update({ confirmation_sent_at: new Date().toISOString() })
    .eq("id", submissionId)
    .eq("confirmation_status", "pending");

  if (tokenHash) {
    query = query.eq("confirmation_token_hash", tokenHash);
  }

  const { error } = await query;

  if (error) {
    throw error;
  }
}

export type FormConfirmationResendResult = {
  applicantName: null | string;
  formSubmissionId: null | string;
  resultStatus: string;
};

export async function refreshFormSubmissionConfirmation(options: {
  confirmationExpiresAt: Date;
  confirmationTokenHash: string;
  formDefinitionId: string;
  submitterEmail: string;
}): Promise<FormConfirmationResendResult> {
  const admin = asFlexibleClient(createAdminClient());
  const { data, error } = await admin.rpc("refresh_form_submission_confirmation", {
    p_form_definition_id: options.formDefinitionId,
    p_next_expires_at: options.confirmationExpiresAt.toISOString(),
    p_next_token_hash: options.confirmationTokenHash,
    p_submitter_email: options.submitterEmail,
  });

  if (error) {
    throw error;
  }

  const result = (Array.isArray(data) ? data[0] : data) as
    | {
        applicant_name?: null | string;
        form_submission_id?: null | string;
        result_status?: string;
      }
    | null;

  return {
    applicantName: result?.applicant_name || null,
    formSubmissionId: result?.form_submission_id || null,
    resultStatus: result?.result_status || "not_found",
  };
}

export async function recordFormConfirmationDelivery(options: {
  formSubmissionId: string;
  idempotencyKey: string;
  providerMessageId?: string;
  status: "failed" | "sent";
}) {
  const admin = asFlexibleClient(createAdminClient());
  const { error } = await admin.from("form_confirmation_deliveries").upsert(
    {
      error_message: options.status === "failed" ? "provider_send_failed" : null,
      form_submission_id: options.formSubmissionId,
      idempotency_key: options.idempotencyKey,
      provider_message_id: options.providerMessageId || null,
      sent_at: options.status === "sent" ? new Date().toISOString() : null,
      status: options.status,
    },
    { onConflict: "idempotency_key" }
  );

  if (error) {
    throw error;
  }
}
export type FormConfirmationResult = {
  form_kind: null | string;
  form_submission_id: null | string;
  result_status: string;
  review_case_id: null | string;
};

export async function confirmFormSubmission(options: {
  submissionId: string;
  tokenHash: string;
}): Promise<FormConfirmationResult | null> {
  const admin = asFlexibleClient(createAdminClient());
  const { data, error } = await admin.rpc("confirm_form_submission", {
    p_confirmation_token_hash: options.tokenHash,
    p_submission_id: options.submissionId,
  });

  if (error) {
    throw error;
  }

  const result = (Array.isArray(data) ? data[0] : data) as FormConfirmationResult | null;
  return result;
}
