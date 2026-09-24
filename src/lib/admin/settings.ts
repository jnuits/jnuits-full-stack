import "server-only";

import { checkAdminMFA } from "@/lib/auth/mfa";
import { requireAdminUser } from "@/lib/auth/session";
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

type SettingsLoadError = {
  code?: null | string;
  message?: null | string;
};

function resolveRoleRecord(
  roleValue: RoleAssignmentRecord["rbac_platform_roles"]
) {
  if (Array.isArray(roleValue)) {
    return roleValue[0] || null;
  }

  return roleValue || null;
}

function throwSettingsLoadError(context: string, error: SettingsLoadError | null) {
  console.error("Admin settings snapshot load failed", {
    code: error?.code,
    context,
    message: error?.message,
  });
  throw new Error("Admin settings could not be loaded.");
}

export async function getAdminSettingsSnapshot() {
  // This helper is server-only and is shared by protected admin settings pages.
  // Service-role reads keep browser grants closed while every query remains scoped
  // to the authenticated operator's own user ID.
  const auth = await requireAdminUser({ fallbackPath: "/admin/settings" });

  if (!auth.user) {
    return null;
  }

  const sessionClient = await createClient();
  const admin = asFlexibleClient(createAdminClient());
  const [
    userResult,
    mfaState,
    roleAssignmentsResult,
    securityEventsResult,
    settingsResult,
    securitySettingsResult,
    linkedMemberResult,
  ] = await Promise.all([
    sessionClient.auth.getUser(),
    checkAdminMFA(sessionClient),
    admin
      .from("rbac_user_platform_roles" as string)
      .select("scope, granted_at, note, rbac_platform_roles(code, display_name)")
      .eq("user_id", auth.user.id)
      .is("revoked_at", null)
      .order("granted_at", { ascending: false }),
    admin
      .from("security_events" as string)
      .select("id, actor_user_id, target_user_id, event_type, severity, payload, created_at")
      .or(`actor_user_id.eq.${auth.user.id},target_user_id.eq.${auth.user.id}`)
      .order("created_at", { ascending: false })
      .limit(12),
    admin
      .from("portal_user_settings" as string)
      .select("notification_email_opt_in, ticket_digest_opt_in, preferred_theme, mentorship_opt_in")
      .eq("user_id", auth.user.id)
      .maybeSingle(),
    admin
      .from("security_settings" as string)
      .select("admin_totp_enforced, updated_by_user_id, updated_at")
      .eq("id", true)
      .maybeSingle(),
    admin
      .from("members" as string)
      .select("id, full_name, jnuits_id, member_type, email")
      .eq("user_id", auth.user.id)
      .maybeSingle(),
  ]);

  if (userResult.error) {
    throwSettingsLoadError("auth-user", userResult.error);
  }

  if (roleAssignmentsResult.error) {
    throwSettingsLoadError("role-assignments", roleAssignmentsResult.error);
  }

  if (securityEventsResult.error) {
    throwSettingsLoadError("security-events", securityEventsResult.error);
  }

  if (settingsResult.error) {
    throwSettingsLoadError("notification-settings", settingsResult.error);
  }

  if (securitySettingsResult.error) {
    throwSettingsLoadError("security-settings", securitySettingsResult.error);
  }

  if (linkedMemberResult.error) {
    throwSettingsLoadError("linked-member", linkedMemberResult.error);
  }

  return {
    auth: auth.user,
    authUser: userResult.data.user,
    linkedMember: linkedMemberResult.data,
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
