"use server";

import type { User } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  ADMIN_ROLE_LABELS,
  normalizeAdminLifecycleStatus,
  normalizeAdminRoleCode,
  resolveAdminAccountCapabilities,
  type AdminAccountLifecycleStatus,
  type AdminAccountRoleCode,
} from "@/lib/admin/admin-account-policy";
import { getSafeAdminActionErrorMessage } from "@/lib/admin/action-error";
import { setAdminFlash } from "@/lib/admin/flash";
import {
  hasPermission,
  requireAdminPermission,
  requireAdminUser,
  requireAuthenticatedUser,
} from "@/lib/auth/session";
import { getAppBaseUrl } from "@/lib/env";
import { logServerError } from "@/lib/errors/api-error";
import { buildAdminInvitationEmail } from "@/lib/notifications/email-builders";
import { sendEmail } from "@/lib/notifications/send-email";
import { recordSecurityEvent } from "@/lib/security/security-events";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";

const adminProfileUpdateSchema = z.object({
  adminProfileId: z.string().trim().min(1, "Missing admin profile identifier."),
  displayName: z.string().trim().min(1, "Display name is required.").max(160),
  title: z.string().trim().max(120).optional().default(""),
});

const lifecycleSchema = z.object({
  adminProfileId: z.string().trim().min(1, "Missing admin profile identifier."),
  confirmation: z.string().trim().min(1, "Confirmation is required."),
  intent: z.enum(["freeze", "remove", "unfreeze"]),
});

const roleChangeSchema = z.object({
  adminProfileId: z.string().trim().min(1, "Missing admin profile identifier."),
  confirmation: z.string().trim().min(1, "Confirmation is required."),
  roleCode: z.enum(["super_admin", "admin", "content_admin"]),
});

const inviteSchema = z.object({
  displayName: z.string().trim().max(160).optional().default(""),
  email: z.string().trim().email("Enter a valid admin email.").transform((value) => value.toLowerCase()),
  note: z.string().trim().max(500).optional().default(""),
  roleCode: z.enum(["super_admin", "admin", "content_admin"]),
  title: z.string().trim().max(120).optional().default(""),
});

const revokeInvitationSchema = z.object({
  confirmation: z.string().trim().min(1, "Confirmation is required."),
  invitationId: z.string().trim().min(1, "Missing invitation identifier."),
});

type AdminClient = ReturnType<typeof createAdminClient>;

type AdminProfileRecord = {
  admin_code: string;
  display_name: string;
  email: null | string;
  id: string;
  is_active: boolean;
  status?: null | string;
  title: null | string;
  user_id: string;
};

type AdminRoleRecord = {
  id: string;
  rbac_platform_roles:
    | { code?: null | string; display_name?: null | string; id?: null | string }
    | Array<{ code?: null | string; display_name?: null | string; id?: null | string }>
    | null;
  role_id: string;
  user_id: string;
};

type TargetAccount = {
  lifecycleStatus: AdminAccountLifecycleStatus;
  primaryRole: AdminAccountRoleCode | null;
  profile: AdminProfileRecord;
};

type AdminInvitationRecord = {
  email: string;
  id: string;
  invited_by_user_id: null | string;
  invited_role_code: string;
  status: string;
  target_admin_profile_id: null | string;
  target_user_id: null | string;
};

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function pickFormFields(formData: FormData, fields: string[]) {
  return Object.fromEntries(fields.map((field) => [field, asString(formData.get(field))]));
}

function safeAdminProfileError(error: unknown, fallback: string) {
  return getSafeAdminActionErrorMessage(error, {
    context: "adminAccounts",
    fallback,
  });
}

function profileRedirectPath(profileId?: string, tab = "directory") {
  const params = new URLSearchParams({ tab });
  if (profileId) params.set("profile", profileId);
  return `/admin/admin-profiles?${params.toString()}`;
}

function isMissingSchemaError(error: unknown) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message || "")
      : error instanceof Error
        ? error.message
        : String(error || "");
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code || "")
      : "";

  return /column|schema cache|does not exist|not found/i.test(message) || /42703|42P01|PGRST20[45]/i.test(code);
}

function confirmationMatches(profile: AdminProfileRecord, confirmation: string) {
  const normalized = confirmation.trim().toLowerCase();
  return normalized === profile.admin_code.toLowerCase() || (profile.email ? normalized === profile.email.toLowerCase() : false);
}

function resolveRoleRelation(relation: AdminRoleRecord["rbac_platform_roles"]) {
  if (!relation) return null;
  return Array.isArray(relation) ? relation[0] || null : relation;
}

async function loadTargetAccount(admin: AdminClient, adminProfileId: string) {
  const flexibleAdmin = asFlexibleClient(admin);
  const { data: profile, error: profileError } = await flexibleAdmin
    .from("admin_profiles" as string)
    .select("*")
    .eq("id", adminProfileId)
    .maybeSingle();

  if (profileError || !profile) {
    throw profileError || new Error("Admin profile was not found.");
  }

  const profileRecord = profile as AdminProfileRecord;
  const { data: roles, error: roleError } = await flexibleAdmin
    .from("rbac_user_platform_roles" as string)
    .select("id, user_id, role_id, rbac_platform_roles(id, code, display_name)")
    .eq("user_id", profileRecord.user_id)
    .eq("scope", "admin")
    .is("revoked_at", null);

  if (roleError) throw roleError;

  const activeRoles = ((roles || []) as AdminRoleRecord[])
    .map((role) => normalizeAdminRoleCode(resolveRoleRelation(role.rbac_platform_roles)?.code))
    .filter((role): role is AdminAccountRoleCode => Boolean(role));
  const primaryRole = activeRoles.includes("super_admin")
    ? "super_admin"
    : activeRoles.includes("admin")
      ? "admin"
      : activeRoles.includes("content_admin")
        ? "content_admin"
        : null;

  return {
    lifecycleStatus: normalizeAdminLifecycleStatus(profileRecord.status, profileRecord.is_active),
    primaryRole,
    profile: profileRecord,
  } satisfies TargetAccount;
}

async function actorCanManageTarget(options: {
  actorRole: AdminAccountRoleCode | null;
  actorUserId: string;
  admin: AdminClient;
  requireRolePermission?: boolean;
  target: TargetAccount;
}) {
  const hasManageAdminRoles = options.requireRolePermission ? true : await hasPermission("admin.roles.manage_admin");

  return resolveAdminAccountCapabilities({
    actorRole: options.actorRole,
    actorUserId: options.actorUserId,
    hasManageAdminRoles,
    targetLifecycleStatus: options.target.lifecycleStatus,
    targetRole: options.target.primaryRole,
    targetUserId: options.target.profile.user_id,
  });
}
async function countActiveSuperAdmins(admin: AdminClient) {
  const result = await asFlexibleClient(admin)
    .from("rbac_user_platform_roles" as string)
    .select("user_id, rbac_platform_roles!inner(code, scope)")
    .eq("scope", "admin")
    .is("revoked_at", null)
    .eq("rbac_platform_roles.code", "super_admin");

  if (result.error) throw result.error;

  const userIds = Array.from(
    new Set(((result.data || []) as Array<{ user_id?: string }>).map((row) => row.user_id).filter(Boolean) as string[]),
  );

  if (userIds.length === 0) return 0;

  const profiles = await asFlexibleClient(admin)
    .from("admin_profiles" as string)
    .select("user_id, is_active, status")
    .in("user_id", userIds);

  if (profiles.error) throw profiles.error;

  return ((profiles.data || []) as Array<{ is_active?: boolean; status?: null | string }>).filter((profile) =>
    profile.is_active && normalizeAdminLifecycleStatus(profile.status, Boolean(profile.is_active)) === "active",
  ).length;
}

async function assertNotLastSuperAdminChange(admin: AdminClient, target: TargetAccount) {
  if (target.primaryRole !== "super_admin") return;

  const activeSuperAdmins = await countActiveSuperAdmins(admin);
  if (activeSuperAdmins <= 1) {
    throw new Error("The last active super admin cannot be changed, frozen, or removed.");
  }
}

async function updateAdminProfileStatus(
  admin: AdminClient,
  options: {
    actorUserId: string;
    isActive: boolean;
    profileId: string;
    reason: string;
    status: AdminAccountLifecycleStatus;
  },
) {
  const now = new Date().toISOString();
  const result = await asFlexibleClient(admin)
    .from("admin_profiles" as string)
    .update({
      is_active: options.isActive,
      status: options.status,
      status_reason: options.reason,
      status_updated_at: now,
      status_updated_by_user_id: options.actorUserId,
      updated_at: now,
    })
    .eq("id", options.profileId);

  if (!result.error) return;
  if (!isMissingSchemaError(result.error)) throw result.error;

  const legacyResult = await asFlexibleClient(admin)
    .from("admin_profiles" as string)
    .update({ is_active: options.isActive, updated_at: now })
    .eq("id", options.profileId);

  if (legacyResult.error) throw legacyResult.error;
}

async function revokeActiveAdminGrants(
  admin: AdminClient,
  options: { actorUserId: string; reason: string; targetUserId: string },
) {
  const now = new Date().toISOString();
  const result = await asFlexibleClient(admin)
    .from("rbac_user_platform_roles" as string)
    .update({
      note: options.reason,
      revocation_reason: options.reason,
      revoked_at: now,
      revoked_by_user_id: options.actorUserId,
    })
    .eq("user_id", options.targetUserId)
    .eq("scope", "admin")
    .is("revoked_at", null);

  if (!result.error) return;
  if (!isMissingSchemaError(result.error)) throw result.error;

  const legacyResult = await asFlexibleClient(admin)
    .from("rbac_user_platform_roles" as string)
    .update({ note: options.reason, revoked_at: now })
    .eq("user_id", options.targetUserId)
    .eq("scope", "admin")
    .is("revoked_at", null);

  if (legacyResult.error) throw legacyResult.error;
}

async function insertAdminRoleGrant(
  admin: AdminClient,
  options: {
    actorUserId: string;
    note: string;
    roleCode: AdminAccountRoleCode;
    targetUserId: string;
  },
) {
  const roleResult = await asFlexibleClient(admin)
    .from("rbac_platform_roles" as string)
    .select("id")
    .eq("code", options.roleCode)
    .eq("scope", "admin")
    .maybeSingle();

  if (roleResult.error || !roleResult.data) {
    throw roleResult.error || new Error("Target admin role is not configured.");
  }

  const insertResult = await asFlexibleClient(admin)
    .from("rbac_user_platform_roles" as string)
    .insert({
      granted_by: options.actorUserId,
      note: options.note,
      role_id: (roleResult.data as { id: string }).id,
      scope: "admin",
      user_id: options.targetUserId,
    });

  if (insertResult.error) throw insertResult.error;
}

async function auditAdminAccountEvent(
  admin: AdminClient,
  payload: {
    action: string;
    actorUserId: string;
    metadata?: Record<string, unknown>;
    profile: AdminProfileRecord;
    severity?: "critical" | "info" | "warning";
  },
) {
  await asFlexibleClient(admin).from("audit_events" as string).insert({
    action: payload.action,
    actor_user_id: payload.actorUserId,
    entity_id: payload.profile.id,
    entity_type: "admin_profile",
    metadata: {
      adminCode: payload.profile.admin_code,
      targetUserId: payload.profile.user_id,
      ...payload.metadata,
    },
  });

  await recordSecurityEvent(admin, {
    actorUserId: payload.actorUserId,
    eventType: payload.action,
    payload: {
      adminProfileId: payload.profile.id,
      adminCode: payload.profile.admin_code,
      ...payload.metadata,
    },
    severity: payload.severity || "info",
    targetUserId: payload.profile.user_id,
  });
}

function generateAdminCode(userId: string) {
  return `JNUITS-ADMIN-${userId.replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

function normalizeEmail(value: null | string | undefined) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

async function findAuthUserByEmail(admin: AdminClient, email: string) {
  const targetEmail = normalizeEmail(email);
  const perPage = 200;

  for (let page = 1; page <= 25; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const match = data.users.find((user) => normalizeEmail(user.email) === targetEmail);
    if (match) return match;
    if (data.users.length < perPage) break;
  }

  return null;
}

async function ensureAdminInvitationSchema(admin: AdminClient) {
  const result = await asFlexibleClient(admin)
    .from("admin_invitations" as string)
    .select("id")
    .limit(1);

  if (result.error) {
    throw new Error("Admin invitation migration is not applied yet.");
  }
}

async function ensurePendingAdminProfile(options: {
  actorUserId: string;
  admin: AdminClient;
  displayName: string;
  email: string;
  roleCode: AdminAccountRoleCode;
  targetUserId: string;
  title: string;
}) {
  const profile = await asFlexibleClient(options.admin)
    .from("admin_profiles" as string)
    .select("id, user_id, admin_code, is_active, status")
    .eq("user_id", options.targetUserId)
    .maybeSingle();

  if (profile.error) throw profile.error;

  if (profile.data) {
    const existing = profile.data as AdminProfileRecord;
    const status = normalizeAdminLifecycleStatus(existing.status, existing.is_active);
    if (status === "active") throw new Error("This user already has an active admin profile.");

    const result = await asFlexibleClient(options.admin)
      .from("admin_profiles" as string)
      .update({
        display_name: options.displayName || options.email,
        email: options.email,
        is_active: false,
        status: "pending_invite",
        status_reason: `Invited as ${ADMIN_ROLE_LABELS[options.roleCode]}`,
        status_updated_at: new Date().toISOString(),
        status_updated_by_user_id: options.actorUserId,
        title: options.title || ADMIN_ROLE_LABELS[options.roleCode],
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("id")
      .single();

    if (result.error) throw result.error;
    return (result.data as { id: string }).id;
  }

  const result = await asFlexibleClient(options.admin)
    .from("admin_profiles" as string)
    .insert({
      admin_code: generateAdminCode(options.targetUserId),
      created_by_user_id: options.actorUserId,
      display_name: options.displayName || options.email,
      email: options.email,
      is_active: false,
      status: "pending_invite",
      status_reason: `Invited as ${ADMIN_ROLE_LABELS[options.roleCode]}`,
      status_updated_at: new Date().toISOString(),
      status_updated_by_user_id: options.actorUserId,
      title: options.title || ADMIN_ROLE_LABELS[options.roleCode],
      user_id: options.targetUserId,
    })
    .select("id")
    .single();

  if (result.error) throw result.error;
  return (result.data as { id: string }).id;
}

async function setFlashAndRedirect(
  tone: "error" | "success",
  title: string,
  message: string,
  path = "/admin/admin-profiles",
): Promise<never> {
  await setAdminFlash({ tone, title, message }, "/admin/admin-profiles");
  redirect(path);
}
export async function updateAdminProfileAction(formData: FormData) {
  const auth = await requireAdminUser({ fallbackPath: "/admin/admin-profiles" });
  const actorUserId = auth.user?.id;
  const actorRole = normalizeAdminRoleCode(auth.user?.adminRole);

  if (!actorUserId) redirect("/admin/login?next=%2Fadmin%2Fadmin-profiles");

  const parsed = adminProfileUpdateSchema.safeParse(
    pickFormFields(formData, ["adminProfileId", "displayName", "title"]),
  );

  if (!parsed.success) {
    return setFlashAndRedirect(
      "error",
      "Admin profile update failed",
      parsed.error.issues[0]?.message || "Invalid admin profile update.",
    );
  }

  const admin = createAdminClient();
  let target: TargetAccount;

  try {
    target = await loadTargetAccount(admin, parsed.data.adminProfileId);
    const capabilities = await actorCanManageTarget({ actorRole, actorUserId, admin, target });

    if (!capabilities.canEditProfile) {
      await setFlashAndRedirect(
        "error",
        "Admin profile update blocked",
        "Your role cannot edit this admin profile.",
        profileRedirectPath(target.profile.id),
      );
    }

    const { error } = await asFlexibleClient(admin)
      .from("admin_profiles" as string)
      .update({
        display_name: parsed.data.displayName,
        title: parsed.data.title || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", target.profile.id);

    if (error) throw error;

    await auditAdminAccountEvent(admin, {
      action: "admin_profile.updated",
      actorUserId,
      metadata: { lifecycleStatus: target.lifecycleStatus },
      profile: target.profile,
    });
  } catch (error) {
    await setFlashAndRedirect(
      "error",
      "Admin profile update failed",
      safeAdminProfileError(error, "Admin profile could not be updated."),
      parsed.success ? profileRedirectPath(parsed.data.adminProfileId) : "/admin/admin-profiles",
    );
  }

  revalidatePath("/admin/admin-profiles");
  await setAdminFlash(
    {
      tone: "success",
      title: "Admin profile updated",
      message: "Admin profile metadata was updated.",
    },
    "/admin/admin-profiles",
  );
  redirect(profileRedirectPath(target!.profile.id));
}

export async function updateAdminLifecycleAction(formData: FormData) {
  const auth = await requireAdminPermission("admin.roles.manage_admin", {
    fallbackPath: "/admin/admin-profiles",
    requireAal2: true,
  });
  const actorUserId = auth.user?.id;
  const actorRole = normalizeAdminRoleCode(auth.user?.adminRole);

  if (!actorUserId) redirect("/admin/login?next=%2Fadmin%2Fadmin-profiles");

  const parsed = lifecycleSchema.safeParse(
    pickFormFields(formData, ["adminProfileId", "confirmation", "intent"]),
  );

  if (!parsed.success) {
    return setFlashAndRedirect(
      "error",
      "Lifecycle action failed",
      parsed.error.issues[0]?.message || "Invalid lifecycle action.",
    );
  }

  const admin = createAdminClient();
  let target: TargetAccount | null = null;

  try {
    target = await loadTargetAccount(admin, parsed.data.adminProfileId);
    const capabilities = await actorCanManageTarget({
      actorRole,
      actorUserId,
      admin,
      requireRolePermission: true,
      target,
    });

    if (!confirmationMatches(target.profile, parsed.data.confirmation)) {
      throw new Error("Confirmation did not match the target admin code or email.");
    }

    if (parsed.data.intent === "freeze" && !capabilities.canFreeze) throw new Error("Your role cannot freeze this admin account.");
    if (parsed.data.intent === "unfreeze" && !capabilities.canUnfreeze) throw new Error("Your role cannot unfreeze this admin account.");
    if (parsed.data.intent === "remove" && !capabilities.canRemove) throw new Error("Your role cannot remove this admin account.");

    if (parsed.data.intent !== "unfreeze") await assertNotLastSuperAdminChange(admin, target);

    if (parsed.data.intent === "freeze") {
      const { error } = await admin.auth.admin.updateUserById(target.profile.user_id, { ban_duration: "876000h" });
      if (error) throw error;
      await updateAdminProfileStatus(admin, {
        actorUserId,
        isActive: false,
        profileId: target.profile.id,
        reason: "Frozen by admin account lifecycle action.",
        status: "frozen",
      });
      await auditAdminAccountEvent(admin, {
        action: "admin_account.frozen",
        actorUserId,
        profile: target.profile,
        severity: "warning",
      });
    }

    if (parsed.data.intent === "unfreeze") {
      const { error } = await admin.auth.admin.updateUserById(target.profile.user_id, { ban_duration: "none" });
      if (error) throw error;
      await updateAdminProfileStatus(admin, {
        actorUserId,
        isActive: true,
        profileId: target.profile.id,
        reason: "Unfrozen by admin account lifecycle action.",
        status: "active",
      });
      await auditAdminAccountEvent(admin, {
        action: "admin_account.unfrozen",
        actorUserId,
        profile: target.profile,
      });
    }

    if (parsed.data.intent === "remove") {
      await revokeActiveAdminGrants(admin, {
        actorUserId,
        reason: "Removed through admin account lifecycle action.",
        targetUserId: target.profile.user_id,
      });
      await admin.auth.admin.updateUserById(target.profile.user_id, { ban_duration: "none" });
      await updateAdminProfileStatus(admin, {
        actorUserId,
        isActive: false,
        profileId: target.profile.id,
        reason: "Admin role removed; Auth user and member profile preserved.",
        status: "removed",
      });
      await auditAdminAccountEvent(admin, {
        action: "admin_account.removed",
        actorUserId,
        profile: target.profile,
        severity: "critical",
      });
    }
  } catch (error) {
    await setFlashAndRedirect(
      "error",
      "Lifecycle action failed",
      safeAdminProfileError(error, "Admin account lifecycle could not be updated."),
      profileRedirectPath(parsed.data.adminProfileId, "access"),
    );
  }

  revalidatePath("/admin/admin-profiles");
  await setAdminFlash(
    {
      tone: "success",
      title: "Admin lifecycle updated",
      message: "The admin account lifecycle action completed.",
    },
    "/admin/admin-profiles",
  );
  redirect(profileRedirectPath(target?.profile.id, "access"));
}

export async function changeAdminRoleAction(formData: FormData) {
  const auth = await requireAdminPermission("admin.roles.manage_admin", {
    fallbackPath: "/admin/admin-profiles",
    requireAal2: true,
  });
  const actorUserId = auth.user?.id;
  const actorRole = normalizeAdminRoleCode(auth.user?.adminRole);

  if (!actorUserId) redirect("/admin/login?next=%2Fadmin%2Fadmin-profiles");

  const parsed = roleChangeSchema.safeParse(
    pickFormFields(formData, ["adminProfileId", "confirmation", "roleCode"]),
  );

  if (!parsed.success) {
    return setFlashAndRedirect(
      "error",
      "Role change failed",
      parsed.error.issues[0]?.message || "Invalid role change.",
    );
  }

  const admin = createAdminClient();
  let target: TargetAccount | null = null;

  try {
    target = await loadTargetAccount(admin, parsed.data.adminProfileId);
    const capabilities = await actorCanManageTarget({
      actorRole,
      actorUserId,
      admin,
      requireRolePermission: true,
      target,
    });

    if (!capabilities.canChangeRole) throw new Error("Your role cannot change this admin role.");
    if (!capabilities.allowedRoleTargets.includes(parsed.data.roleCode)) throw new Error("The selected target role is not allowed.");
    if (!confirmationMatches(target.profile, parsed.data.confirmation)) throw new Error("Confirmation did not match the target admin code or email.");
    if (target.primaryRole === parsed.data.roleCode) throw new Error("This admin already has the selected role.");
    if (target.primaryRole === "super_admin" && parsed.data.roleCode !== "super_admin") await assertNotLastSuperAdminChange(admin, target);

    await revokeActiveAdminGrants(admin, {
      actorUserId,
      reason: `Changed admin role to ${parsed.data.roleCode}.`,
      targetUserId: target.profile.user_id,
    });
    await insertAdminRoleGrant(admin, {
      actorUserId,
      note: `Granted through admin account console as ${ADMIN_ROLE_LABELS[parsed.data.roleCode]}.`,
      roleCode: parsed.data.roleCode,
      targetUserId: target.profile.user_id,
    });
    await updateAdminProfileStatus(admin, {
      actorUserId,
      isActive: true,
      profileId: target.profile.id,
      reason: `Role changed to ${ADMIN_ROLE_LABELS[parsed.data.roleCode]}.`,
      status: "active",
    });
    await auditAdminAccountEvent(admin, {
      action: "admin_account.role_changed",
      actorUserId,
      metadata: { previousRole: target.primaryRole, roleCode: parsed.data.roleCode },
      profile: target.profile,
      severity: parsed.data.roleCode === "super_admin" || target.primaryRole === "super_admin" ? "critical" : "warning",
    });
  } catch (error) {
    await setFlashAndRedirect(
      "error",
      "Role change failed",
      safeAdminProfileError(error, "Admin role could not be changed."),
      profileRedirectPath(parsed.data.adminProfileId, "access"),
    );
  }

  revalidatePath("/admin/admin-profiles");
  await setAdminFlash(
    {
      tone: "success",
      title: "Admin role changed",
      message: "The admin role assignment was updated.",
    },
    "/admin/admin-profiles",
  );
  redirect(profileRedirectPath(target?.profile.id, "access"));
}
export async function inviteAdminAction(formData: FormData) {
  const auth = await requireAdminPermission("admin.roles.manage_admin", {
    fallbackPath: "/admin/admin-profiles?tab=invitations",
    requireAal2: true,
  });
  const actorUserId = auth.user?.id;
  const actorRole = normalizeAdminRoleCode(auth.user?.adminRole);

  if (!actorUserId) redirect("/admin/login?next=%2Fadmin%2Fadmin-profiles");

  const parsed = inviteSchema.safeParse(
    pickFormFields(formData, ["displayName", "email", "note", "roleCode", "title"]),
  );

  if (!parsed.success) {
    return setFlashAndRedirect(
      "error",
      "Admin invitation failed",
      parsed.error.issues[0]?.message || "Invalid admin invitation.",
      "/admin/admin-profiles?tab=invitations",
    );
  }

  const allowedRoles = actorRole === "super_admin"
    ? ["super_admin", "admin", "content_admin"]
    : actorRole === "admin"
      ? ["content_admin"]
      : [];

  if (!allowedRoles.includes(parsed.data.roleCode)) {
    await setFlashAndRedirect(
      "error",
      "Admin invitation blocked",
      "Your role cannot invite that admin role.",
      "/admin/admin-profiles?tab=invitations",
    );
  }

  const admin = createAdminClient();

  try {
    await ensureAdminInvitationSchema(admin);
    const existingUser = await findAuthUserByEmail(admin, parsed.data.email);
    let targetUser: User | null = existingUser;
    let actionLink = `${getAppBaseUrl()}/admin/invite/accept`;

    if (!targetUser) {
      const { data, error } = await admin.auth.admin.generateLink({
        email: parsed.data.email,
        options: {
          redirectTo: `${getAppBaseUrl()}/auth/confirm?next=${encodeURIComponent("/admin/invite/accept")}`,
        },
        type: "invite",
      });

      if (error || !data.user) throw error || new Error("Supabase could not create the invite link.");
      targetUser = data.user;
      actionLink = (data as { properties?: { action_link?: string } }).properties?.action_link || actionLink;
    }

    const existingAdminGrant = await asFlexibleClient(admin)
      .from("rbac_user_platform_roles" as string)
      .select("id")
      .eq("user_id", targetUser.id)
      .eq("scope", "admin")
      .is("revoked_at", null)
      .maybeSingle();

    if (existingAdminGrant.error) throw existingAdminGrant.error;
    if (existingAdminGrant.data) throw new Error("This user already has active admin access.");

    const profileId = await ensurePendingAdminProfile({
      actorUserId,
      admin,
      displayName: parsed.data.displayName,
      email: parsed.data.email,
      roleCode: parsed.data.roleCode,
      targetUserId: targetUser.id,
      title: parsed.data.title,
    });

    const invitationResult = await asFlexibleClient(admin)
      .from("admin_invitations" as string)
      .insert({
        delivery_status: "pending",
        email: parsed.data.email,
        invited_by_user_id: actorUserId,
        invited_role_code: parsed.data.roleCode,
        note: parsed.data.note || null,
        status: "pending",
        target_admin_profile_id: profileId,
        target_user_id: targetUser.id,
      })
      .select("id")
      .single();

    if (invitationResult.error || !invitationResult.data) throw invitationResult.error || new Error("Admin invitation record could not be created.");

    const invitationId = (invitationResult.data as { id: string }).id;
    const delivery = await sendEmail({
      html: buildAdminInvitationEmail({
        actionLink,
        adminRoleLabel: ADMIN_ROLE_LABELS[parsed.data.roleCode],
        expiresInDays: 7,
        recipientEmail: parsed.data.email,
        recipientName: parsed.data.displayName || parsed.data.email,
      }),
      subject: "Your JnUITS admin workspace invitation",
      to: parsed.data.email,
    });

    await asFlexibleClient(admin)
      .from("admin_invitations" as string)
      .update({
        delivery_status: delivery.success ? "sent" : "failed",
        last_sent_at: delivery.success ? new Date().toISOString() : null,
        provider_message_id: delivery.messageId || null,
        send_attempts: 1,
        status: delivery.success ? "pending" : "failed",
      })
      .eq("id", invitationId);

    await asFlexibleClient(admin).from("audit_events" as string).insert({
      action: "admin_invitation.created",
      actor_user_id: actorUserId,
      entity_id: invitationId,
      entity_type: "admin_invitation",
      metadata: {
        deliveryStatus: delivery.success ? "sent" : "failed",
        email: parsed.data.email,
        roleCode: parsed.data.roleCode,
        targetUserId: targetUser.id,
      },
    });

    await recordSecurityEvent(admin, {
      actorUserId,
      eventType: "admin_invitation.created",
      payload: {
        deliveryStatus: delivery.success ? "sent" : "failed",
        invitationId,
        roleCode: parsed.data.roleCode,
      },
      severity: parsed.data.roleCode === "super_admin" ? "critical" : "warning",
      targetUserId: targetUser.id,
    });
  } catch (error) {
    await setFlashAndRedirect(
      "error",
      "Admin invitation failed",
      safeAdminProfileError(error, "Admin invitation could not be sent."),
      "/admin/admin-profiles?tab=invitations",
    );
  }

  revalidatePath("/admin/admin-profiles");
  await setAdminFlash(
    {
      tone: "success",
      title: "Admin invitation sent",
      message: "The admin invitation was created and delivery was attempted.",
    },
    "/admin/admin-profiles",
  );
  redirect("/admin/admin-profiles?tab=invitations");
}

export async function revokeAdminInvitationAction(formData: FormData) {
  const auth = await requireAdminPermission("admin.roles.manage_admin", {
    fallbackPath: "/admin/admin-profiles?tab=invitations",
    requireAal2: true,
  });
  const actorUserId = auth.user?.id;

  if (!actorUserId) redirect("/admin/login?next=%2Fadmin%2Fadmin-profiles");

  const parsed = revokeInvitationSchema.safeParse(
    pickFormFields(formData, ["confirmation", "invitationId"]),
  );

  if (!parsed.success) {
    return setFlashAndRedirect(
      "error",
      "Invitation revoke failed",
      parsed.error.issues[0]?.message || "Invalid invitation revoke request.",
      "/admin/admin-profiles?tab=invitations",
    );
  }

  const admin = createAdminClient();

  try {
    const result = await asFlexibleClient(admin)
      .from("admin_invitations" as string)
      .select("id, email, invited_role_code, invited_by_user_id, status, target_user_id, target_admin_profile_id")
      .eq("id", parsed.data.invitationId)
      .maybeSingle();

    if (result.error || !result.data) throw result.error || new Error("Admin invitation was not found.");

    const invitation = result.data as AdminInvitationRecord;
    if (parsed.data.confirmation.toLowerCase() !== invitation.email.toLowerCase()) throw new Error("Confirmation did not match the invitation email.");

    const update = await asFlexibleClient(admin)
      .from("admin_invitations" as string)
      .update({ revoked_at: new Date().toISOString(), revoked_by_user_id: actorUserId, status: "revoked" })
      .eq("id", invitation.id);

    if (update.error) throw update.error;

    if (invitation.target_admin_profile_id) {
      await updateAdminProfileStatus(admin, {
        actorUserId,
        isActive: false,
        profileId: invitation.target_admin_profile_id,
        reason: "Pending admin invitation revoked.",
        status: "removed",
      });
    }

    await asFlexibleClient(admin).from("audit_events" as string).insert({
      action: "admin_invitation.revoked",
      actor_user_id: actorUserId,
      entity_id: invitation.id,
      entity_type: "admin_invitation",
      metadata: { email: invitation.email, roleCode: invitation.invited_role_code },
    });
  } catch (error) {
    await setFlashAndRedirect(
      "error",
      "Invitation revoke failed",
      safeAdminProfileError(error, "Admin invitation could not be revoked."),
      "/admin/admin-profiles?tab=invitations",
    );
  }

  revalidatePath("/admin/admin-profiles");
  await setAdminFlash(
    {
      tone: "success",
      title: "Admin invitation revoked",
      message: "The pending admin invitation was revoked.",
    },
    "/admin/admin-profiles",
  );
  redirect("/admin/admin-profiles?tab=invitations");
}

export async function acceptAdminInvitationAction() {
  const auth = await requireAuthenticatedUser({ fallbackPath: "/admin/invite/accept" });
  const user = auth.user;

  if (!user?.id || !user.email) redirect("/admin/login?next=%2Fadmin%2Finvite%2Faccept");

  const admin = createAdminClient();

  try {
    const result = await asFlexibleClient(admin)
      .from("admin_invitations" as string)
      .select("id, email, invited_role_code, status, target_user_id, target_admin_profile_id, expires_at")
      .eq("status", "pending")
      .or(`target_user_id.eq.${user.id},email.eq.${user.email}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (result.error || !result.data) throw result.error || new Error("No pending admin invitation was found for this account.");

    const invitation = result.data as AdminInvitationRecord & { expires_at?: string };
    const roleCode = normalizeAdminRoleCode(invitation.invited_role_code);
    if (!roleCode) throw new Error("The invited admin role is not valid.");
    if (new Date(invitation.expires_at || "").getTime() < Date.now()) {
      await asFlexibleClient(admin).from("admin_invitations" as string).update({ status: "expired" }).eq("id", invitation.id);
      throw new Error("This admin invitation has expired.");
    }
    if (invitation.target_user_id && invitation.target_user_id !== user.id) throw new Error("This invitation belongs to a different signed-in user.");

    await insertAdminRoleGrant(admin, {
      actorUserId: user.id,
      note: "Accepted admin invitation.",
      roleCode,
      targetUserId: user.id,
    });

    if (invitation.target_admin_profile_id) {
      await updateAdminProfileStatus(admin, {
        actorUserId: user.id,
        isActive: true,
        profileId: invitation.target_admin_profile_id,
        reason: "Admin invitation accepted.",
        status: "active",
      });
    }

    const update = await asFlexibleClient(admin)
      .from("admin_invitations" as string)
      .update({ accepted_at: new Date().toISOString(), accepted_by_user_id: user.id, status: "accepted", target_user_id: user.id })
      .eq("id", invitation.id);

    if (update.error) throw update.error;

    await recordSecurityEvent(admin, {
      actorUserId: user.id,
      eventType: "admin_invitation.accepted",
      payload: { invitationId: invitation.id, roleCode },
      severity: roleCode === "super_admin" ? "critical" : "warning",
      targetUserId: user.id,
    });
  } catch (error) {
    logServerError("adminInvitation.accept", error);
    redirect(`/admin/access-pending?error=${encodeURIComponent(error instanceof Error ? error.message : "Admin invitation could not be accepted.")}`);
  }

  revalidatePath("/", "layout");
  redirect("/admin/mfa/setup");
}
