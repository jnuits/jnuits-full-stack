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

function escapeIlike(value: string) {
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

export async function createFormDraft(options: {
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

export async function publishFormVersion(options: {
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
