import "server-only";

import {
  isActiveAdminLifecycle,
  normalizeAdminLifecycleStatus,
  type AdminAccountLifecycleStatus,
} from "@/lib/admin/admin-account-policy";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";

export type AdminLifecycleAccessState =
  | AdminAccountLifecycleStatus
  | "inactive"
  | "missing"
  | "unavailable";

type AdminLifecycleProfile = {
  is_active: boolean;
  status?: null | string;
};

export function resolveAdminLifecycleAccessState(
  profile: AdminLifecycleProfile | null,
): AdminLifecycleAccessState {
  if (!profile) {
    return "missing";
  }

  const lifecycle = normalizeAdminLifecycleStatus(
    profile.status,
    profile.is_active,
  );

  if (isActiveAdminLifecycle(lifecycle, profile.is_active)) {
    return "active";
  }

  return lifecycle === "active" ? "inactive" : lifecycle;
}

export async function loadAdminLifecycleAccessState(
  userId: string,
): Promise<AdminLifecycleAccessState> {
  if (!userId) {
    return "missing";
  }

  const admin = asFlexibleClient(createAdminClient());
  const { data, error } = await admin
    .from("admin_profiles" as string)
    .select("is_active, status")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Admin lifecycle access check failed", {
      code: error.code,
      message: error.message,
    });
    return "unavailable";
  }

  const profile =
    data && typeof data === "object"
      ? (data as AdminLifecycleProfile)
      : null;

  return resolveAdminLifecycleAccessState(profile);
}