import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";

export const FORM_LIFECYCLE_TARGETS = ["published", "closed", "archived"] as const;

export type FormLifecycleTarget = (typeof FORM_LIFECYCLE_TARGETS)[number];

export type FormLifecycleResult = {
  currentPublishedVersionId: string | null;
  formDefinitionId: string;
  lifecycle: FormLifecycleTarget;
};

type FormLifecycleRpcRow = {
  current_published_version_id: string | null;
  form_definition_id: string;
  lifecycle: FormLifecycleTarget;
};

function firstResult<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] || null : value;
}

export async function transitionFormLifecycle(options: {
  actorUserId: string;
  formDefinitionId: string;
  target: FormLifecycleTarget;
}): Promise<FormLifecycleResult> {
  const admin = asFlexibleClient(createAdminClient());
  const { data, error } = await admin.rpc("transition_form_definition_lifecycle", {
    p_actor_user_id: options.actorUserId,
    p_form_definition_id: options.formDefinitionId,
    p_target_lifecycle: options.target,
  });

  if (error) throw error;

  const result = firstResult(data as FormLifecycleRpcRow | FormLifecycleRpcRow[] | null);
  if (!result?.form_definition_id || !result.lifecycle) {
    throw new Error("The form lifecycle was not updated.");
  }

  return {
    currentPublishedVersionId: result.current_published_version_id,
    formDefinitionId: result.form_definition_id,
    lifecycle: result.lifecycle,
  };
}
