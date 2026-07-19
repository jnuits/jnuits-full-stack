import "server-only";

import type { FormApplicationBehavior } from "@/lib/forms/application-behavior";
import type { FormDefinition, FormKind } from "@/lib/forms/definition";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";

export type FormDraftIds = {
  formDefinitionId: string;
  formVersionId: string;
};

type FormDraftRpcResult = {
  form_definition_id: string;
  form_version_id: string;
};

export type FormManagementContext = {
  id: string;
  kind: FormKind;
  lifecycle: "archived" | "draft" | "published";
  linkedEventId: null | string;
};

export async function loadFormManagementContext(formDefinitionId: string): Promise<FormManagementContext | null> {
  const admin = asFlexibleClient(createAdminClient());
  const { data, error } = await admin
    .from("form_definitions")
    .select("id, kind, lifecycle, linked_event_id")
    .eq("id", formDefinitionId)
    .maybeSingle();

  if (error) throw error;
  if (!data?.id || !data.kind || !data.lifecycle) return null;
  return data as FormManagementContext;
}

export type FormSummary = {
  currentPublishedVersionId: null | string;
  id: string;
  kind: FormKind;
  lifecycle: "archived" | "draft" | "published";
  slug: string;
  title: string;
  updatedAt: string;
};


export type FormEditorVersion = {
  applicationBehavior: Record<string, unknown>;
  fieldSchema: Record<string, unknown>;
  id: string;
  lifecycle: "draft" | "published";
  versionNumber: number;
};

export type FormEditorContext = {
  description: string;
  id: string;
  kind: FormKind;
  lifecycle: "archived" | "draft" | "published";
  linkedEventId: null | string;
  slug: string;
  title: string;
  version: FormEditorVersion | null;
};

type FormEditorVersionRow = {
  application_behavior: Record<string, unknown>;
  field_schema: Record<string, unknown>;
  id: string;
  lifecycle: "draft" | "published";
  version_number: number;
};function escapeIlike(value: string) {
  return value.replace(/[\\%_,().]/g, (character) => `\\${character}`);
}

export async function listForms(options: {
  kind?: FormKind;
  page: number;
  pageSize: number;
  query?: string;
}) {
  const admin = asFlexibleClient(createAdminClient());
  const from = (options.page - 1) * options.pageSize;
  const to = from + options.pageSize - 1;
  let request = admin
    .from("form_definitions")
    .select("id, kind, lifecycle, slug, title, updated_at, current_published_version_id", {
      count: "exact",
    })
    .order("updated_at", { ascending: false });

  if (options.kind) {
    request = request.eq("kind", options.kind);
  }

  if (options.query) {
    const pattern = `%${escapeIlike(options.query)}%`;
    request = request.or(`slug.ilike.${pattern},title.ilike.${pattern}`);
  }

  const { count, data, error } = await request.range(from, to);
  if (error) throw error;

  const items = ((data || []) as Array<{
    current_published_version_id: null | string;
    id: string;
    kind: FormKind;
    lifecycle: "archived" | "draft" | "published";
    slug: string;
    title: string;
    updated_at: string;
  }>).map((form) => ({
    currentPublishedVersionId: form.current_published_version_id,
    id: form.id,
    kind: form.kind,
    lifecycle: form.lifecycle,
    slug: form.slug,
    title: form.title,
    updatedAt: form.updated_at,
  }));

  return { items, totalItems: count || 0 };
}

function firstResult<T>(data: T | T[] | null): T | null {
  return Array.isArray(data) ? data[0] || null : data;
}


function toFormEditorVersion(value: FormEditorVersionRow | null): FormEditorVersion | null {
  if (!value?.id || !value.field_schema || !value.application_behavior) {
    return null;
  }

  return {
    applicationBehavior: value.application_behavior,
    fieldSchema: value.field_schema,
    id: value.id,
    lifecycle: value.lifecycle,
    versionNumber: value.version_number,
  };
}

export async function loadFormEditorContext(formDefinitionId: string): Promise<FormEditorContext | null> {
  const admin = asFlexibleClient(createAdminClient());
  const { data: definitionData, error: definitionError } = await admin
    .from("form_definitions")
    .select("id, kind, lifecycle, linked_event_id, slug, title, description, current_published_version_id")
    .eq("id", formDefinitionId)
    .maybeSingle();

  if (definitionError) throw definitionError;
  const definition = definitionData as {
    current_published_version_id: null | string;
    description: null | string;
    id: string;
    kind: FormKind;
    lifecycle: "archived" | "draft" | "published";
    linked_event_id: null | string;
    slug: string;
    title: string;
  } | null;

  if (!definition?.id || !definition.kind || !definition.lifecycle) {
    return null;
  }

  const versionSelect = "id, lifecycle, version_number, field_schema, application_behavior";
  const { data: draftData, error: draftError } = await admin
    .from("form_versions")
    .select(versionSelect)
    .eq("form_definition_id", definition.id)
    .eq("lifecycle", "draft")
    .order("version_number", { ascending: false })
    .limit(1);

  if (draftError) throw draftError;
  let version = toFormEditorVersion(
    firstResult(draftData as FormEditorVersionRow | FormEditorVersionRow[] | null)
  );

  if (!version && definition.current_published_version_id) {
    const { data: publishedData, error: publishedError } = await admin
      .from("form_versions")
      .select(versionSelect)
      .eq("id", definition.current_published_version_id)
      .eq("form_definition_id", definition.id)
      .maybeSingle();

    if (publishedError) throw publishedError;
    version = toFormEditorVersion(publishedData as FormEditorVersionRow | null);
  }

  return {
    description: definition.description || "",
    id: definition.id,
    kind: definition.kind,
    lifecycle: definition.lifecycle,
    linkedEventId: definition.linked_event_id,
    slug: definition.slug,
    title: definition.title,
    version,
  };
}export async function createFormDraft(options: {
  actorUserId: string;
  applicationBehavior: FormApplicationBehavior | Record<string, never>;
  definition: FormDefinition;
  description: string;
  kind: FormKind;
  linkedEventId: null | string;
  slug: string;
  title: string;
}): Promise<FormDraftIds> {
  const admin = asFlexibleClient(createAdminClient());
  const { data, error } = await admin.rpc("create_form_definition_draft", {
    p_actor_user_id: options.actorUserId,
    p_application_behavior: options.applicationBehavior,
    p_description: options.description,
    p_field_schema: options.definition,
    p_kind: options.kind,
    p_linked_event_id: options.linkedEventId,
    p_slug: options.slug,
    p_title: options.title,
  });
  const result = firstResult(data as FormDraftRpcResult | FormDraftRpcResult[] | null);

  if (error) {
    throw error;
  }

  if (!result?.form_definition_id || !result.form_version_id) {
    throw new Error("Form draft was not created.");
  }

  return {
    formDefinitionId: result.form_definition_id,
    formVersionId: result.form_version_id,
  };
}

export async function createFormDraftVersion(options: {
  actorUserId: string;
  applicationBehavior: FormApplicationBehavior | Record<string, never>;
  definition: FormDefinition;
  formDefinitionId: string;
}) {
  const admin = asFlexibleClient(createAdminClient());
  const { data, error } = await admin.rpc("create_form_draft_version", {
    p_actor_user_id: options.actorUserId,
    p_application_behavior: options.applicationBehavior,
    p_field_schema: options.definition,
    p_form_definition_id: options.formDefinitionId,
  });
  const result = firstResult(data as { form_version_id: string } | { form_version_id: string }[] | null);

  if (error) {
    throw error;
  }

  if (!result?.form_version_id) {
    throw new Error("Form draft version was not created.");
  }

  return result.form_version_id;
}


export async function updateFormDraftVersion(options: {
  actorUserId: string;
  applicationBehavior: FormApplicationBehavior | Record<string, never>;
  definition: FormDefinition;
  formDefinitionId: string;
  formVersionId: string;
}) {
  const admin = asFlexibleClient(createAdminClient());
  const { data, error } = await admin.rpc("update_form_draft_version", {
    p_actor_user_id: options.actorUserId,
    p_application_behavior: options.applicationBehavior,
    p_field_schema: options.definition,
    p_form_definition_id: options.formDefinitionId,
    p_form_version_id: options.formVersionId,
  });
  const result = firstResult(data as { form_version_id: string } | { form_version_id: string }[] | null);

  if (error) {
    throw error;
  }

  if (!result?.form_version_id) {
    throw new Error("Form draft version was not updated.");
  }

  return result.form_version_id;
}export async function publishFormVersion(options: {
  actorUserId: string;
  formDefinitionId: string;
  formVersionId: string;
}) {
  const admin = asFlexibleClient(createAdminClient());
  const { data, error } = await admin.rpc("publish_form_version", {
    p_actor_user_id: options.actorUserId,
    p_form_definition_id: options.formDefinitionId,
    p_form_version_id: options.formVersionId,
  });
  const result = firstResult(data as FormDraftRpcResult | FormDraftRpcResult[] | null);

  if (error) {
    throw error;
  }

  if (!result?.form_definition_id || !result.form_version_id) {
    throw new Error("Form version was not published.");
  }

  return {
    formDefinitionId: result.form_definition_id,
    formVersionId: result.form_version_id,
  };
}
