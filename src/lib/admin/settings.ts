import "server-only";

import { getAuthContext } from "@/lib/auth/session";
import { checkAdminMFA } from "@/lib/auth/mfa";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";
import { createClient } from "@/lib/supabase/server";

type SecurityEventRecord = {
  actor_user_id: null | string;
  created_at: string;
  event_type: string;
  id: string;
  payload: Record<string, unknown> | null;
  severity: "critical" | "info" | "warning";
  target_user_id: null | string;
};

type NotificationSettingsRecord = {
  mentorship_opt_in: boolean;
  notification_email_opt_in: boolean;
  preferred_theme: "dark" | "light" | "system";
  ticket_digest_opt_in: boolean;
};

type SecuritySettingsRecord = {
  admin_totp_enforced: boolean;
  updated_at: string;
  updated_by_user_id: null | string;
};

type RoleAssignmentRecord = {
  granted_at: null | string;
  note: null | string;
  rbac_platform_roles:
    | null
    | { code?: null | string; display_name?: null | string }
    | Array<{ code?: null | string; display_name?: null | string }>;
  scope: string;
};

function resolveRoleRecord(
  roleValue: RoleAssignmentRecord["rbac_platform_roles"]
) {
  if (Array.isArray(roleValue)) {
    return roleValue[0] || null;
  }

  return roleValue || null;
}

export async function getAdminSettingsSnapshot() {
  const auth = await getAuthContext();

  if (!auth.user) {
    return null;
  }

  const supabase = asFlexibleClient(await createClient());
  const [
    userResult,
    mfaState,
    roleAssignmentsResult,
    securityEventsResult,
    settingsResult,
    securitySettingsResult,
  ] =
    await Promise.all([
      supabase.auth.getUser(),
      checkAdminMFA(supabase),
      supabase
        .from("rbac_user_platform_roles" as string)
        .select("scope, granted_at, note, rbac_platform_roles(code, display_name)")
        .eq("user_id", auth.user.id)
        .is("revoked_at", null)
        .order("granted_at", { ascending: false }),
      supabase
        .from("security_events" as string)
        .select("id, actor_user_id, target_user_id, event_type, severity, payload, created_at")
        .or(`actor_user_id.eq.${auth.user.id},target_user_id.eq.${auth.user.id}`)
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("portal_user_settings" as string)
        .select("notification_email_opt_in, ticket_digest_opt_in, preferred_theme, mentorship_opt_in")
        .eq("user_id", auth.user.id)
        .maybeSingle(),
      supabase
        .from("security_settings" as string)
        .select("admin_totp_enforced, updated_by_user_id, updated_at")
        .eq("id", true)
        .maybeSingle(),
    ]);

  if (roleAssignmentsResult.error) {
    throw new Error(roleAssignmentsResult.error.message);
  }

  if (securityEventsResult.error) {
    throw new Error(securityEventsResult.error.message);
  }

  if (settingsResult.error) {
    throw new Error(settingsResult.error.message);
  }

  if (securitySettingsResult.error) {
    throw new Error(securitySettingsResult.error.message);
  }

  const admin = createAdminClient();
  const { data: linkedMember, error: linkedMemberError } = await admin
    .from("members")
    .select("id, full_name, jnuits_id, member_type, email")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (linkedMemberError) {
    throw new Error(linkedMemberError.message);
  }

  return {
    auth: auth.user,
    authUser: userResult.data.user,
    linkedMember,
    mfaState,
    notificationSettings:
      ((settingsResult.data as unknown) as NotificationSettingsRecord | null) ?? null,
    roleAssignments: (((roleAssignmentsResult.data || []) as unknown) as RoleAssignmentRecord[]).map(
      (assignment) => {
        const role = resolveRoleRecord(assignment.rbac_platform_roles);

        return {
          grantedAt: assignment.granted_at,
          note: assignment.note,
          roleCode: role?.code ?? null,
          roleDisplayName: role?.display_name ?? null,
          scope: assignment.scope,
        };
      }
    ),
    securityEvents:
      (((securityEventsResult.data as unknown) as SecurityEventRecord[] | null) ||
        []),
    securitySettings:
      ((securitySettingsResult.data as unknown) as SecuritySettingsRecord | null) ?? {
        admin_totp_enforced: true,
        updated_at: new Date(0).toISOString(),
        updated_by_user_id: null,
      },
  };
}
