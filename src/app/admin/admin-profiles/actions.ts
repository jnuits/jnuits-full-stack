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
import {
  buildAdminInvitationAcceptPath,
  resolveAdminInvitationAcceptanceState,
} from "@/lib/admin/admin-invitation-flow";
import { getSafeAdminActionErrorMessage, SafeAdminActionError } from "@/lib/admin/action-error";
import { setAdminFlash } from "@/lib/admin/flash";
import { issueInvitationForMember } from "@/lib/admin/invitations";
import {
  hasPermission,
  requireAdminPermission,
  requireAdminUser,
  requireAuthenticatedUser,
} from "@/lib/auth/session";
import { getAppBaseUrl } from "@/lib/env";
import { logServerError } from "@/lib/errors/api-error";
import { buildClaimProfileUrl } from "@/lib/members/claim-url";
import { buildAdminInvitationEmail } from "@/lib/notifications/email-builders";
import { sendEmail } from "@/lib/notifications/send-email";
import { recordSecurityEvent } from "@/lib/security/security-events";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";
import { createClient } from "@/lib/supabase/server";
import { authorizeAdminOperation, adminVerificationFailureMessage } from "@/lib/auth/admin-verification/guard";
import { AdminVerificationStore } from "@/lib/auth/admin-verification/store";
import type { AdminOperationIntent } from "@/lib/auth/admin-verification/types";

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

const inviteSchema = z
  .object({
    displayName: z.string().trim().max(160).optional().default(""),
    email: z.string().trim().max(254).optional().default(""),
    inviteMode: z.enum(["email", "member"]).default("email"),
    memberId: z.string().trim().max(80).optional().default(""),
    note: z.string().trim().max(500).optional().default(""),
    roleCode: z.enum(["super_admin", "admin", "content_admin"]),
    title: z.string().trim().max(120).optional().default(""),
  })
  .transform((value) => ({
    ...value,
    email: value.email.toLowerCase(),
  }))
  .superRefine((value, ctx) => {
    if (value.inviteMode === "member" && !value.memberId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a member profile to invite.",
        path: ["memberId"],
      });
    }

    if (value.inviteMode === "email" && !z.string().email().safeParse(value.email).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid admin email.",
        path: ["email"],
      });
    }
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
  linked_member_id?: null | string;
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
  claim_invitation_id?: null | string;
  email: string;
  id: string;
  invited_by_user_id: null | string;
  invited_role_code: string;
  status: string;
  target_admin_profile_id: null | string;
  target_user_id: null | string;
};

type MemberInviteRecord = {
  email: null | string;
  full_name: null | string;
  id: string;
  is_profile_claimed: boolean;
  jnuits_id: null | string;
  lifecycle_status: null | string;
  member_type: null | string;
  portal_access_status: null | string;
  user_id: null | string;
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

function normalizeEmail(value: null | string | undefined) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
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

async function findMemberForAdminInvite(admin: AdminClient, memberId: string) {
  const result = await asFlexibleClient(admin)
    .from("members" as string)
    .select(
      "id, user_id, full_name, email, jnuits_id, member_type, is_profile_claimed, lifecycle_status, portal_access_status",
    )
    .eq("id", memberId)
    .maybeSingle();

  if (result.error || !result.data) {
    throw result.error || new Error("Selected member profile was not found.");
  }

  return result.data as MemberInviteRecord;
}

async function findMemberByEmail(admin: AdminClient, email: string) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const result = await asFlexibleClient(admin)
    .from("members" as string)
    .select("id, user_id, full_name, email, jnuits_id, member_type, is_profile_claimed, lifecycle_status, portal_access_status")
    .ilike("email", normalizedEmail)
    .maybeSingle();

  if (result.error) throw result.error;
  return (result.data || null) as MemberInviteRecord | null;
}

async function loadAdminProfileByLinkedMember(admin: AdminClient, memberId: string) {
  let result = await asFlexibleClient(admin)
    .from("admin_profiles" as string)
    .select("id, user_id, admin_code, display_name, email, title, is_active, linked_member_id, status")
    .eq("linked_member_id", memberId)
    .maybeSingle();

  if (result.error && isMissingSchemaError(result.error)) {
    result = await asFlexibleClient(admin)
      .from("admin_profiles" as string)
      .select("id, user_id, admin_code, display_name, email, title, is_active, linked_member_id")
      .eq("linked_member_id", memberId)
      .maybeSingle();
  }

  if (result.error) throw result.error;
  return (result.data || null) as AdminProfileRecord | null;
}

function assertLinkedMemberCanBeInvited(options: {
  linkedProfile: AdminProfileRecord | null;
  member: MemberInviteRecord;
}) {
  if (!options.member.email) {
    throw new Error("Selected member profile has no email address.");
  }

  if (!options.linkedProfile) {
    return;
  }

  const status = normalizeAdminLifecycleStatus(
    options.linkedProfile.status,
    options.linkedProfile.is_active,
  );

  if (status !== "removed") {
    throw new Error("This member is already linked to an admin identity.");
  }
}

async function ensureTargetAuthUserForEmail(admin: AdminClient, email: string) {
  const targetEmail = normalizeEmail(email);
  const fallbackActionLink = `${getAppBaseUrl()}/admin/invite/accept`;

  if (!targetEmail) {
    throw new Error("Admin invitation target email is required.");
  }

  const { data, error } = await admin.auth.admin.generateLink({
    email: targetEmail,
    options: {
      redirectTo: `${getAppBaseUrl()}/auth/confirm?next=${encodeURIComponent("/admin/invite/accept")}`,
    },
    type: "invite",
  });

  if (error || !data.user) {
    throw error || new Error("Supabase could not create the invite link.");
  }

  return {
    actionLink: data.properties?.action_link || fallbackActionLink,
    user: data.user,
  };
}

async function loadPendingAdminInvitationForUser(admin: AdminClient, user: { email?: null | string; id: string }) {
  const flexibleAdmin = asFlexibleClient(admin);
  const selectFields = "id, email, invited_role_code, status, target_user_id, target_admin_profile_id, expires_at";

  const userResult = await flexibleAdmin
    .from("admin_invitations" as string)
    .select(selectFields)
    .eq("status", "pending")
    .eq("target_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (userResult.error) throw userResult.error;
  if (userResult.data) return userResult.data;

  const email = normalizeEmail(user.email);
  if (!email) return null;

  const emailResult = await flexibleAdmin
    .from("admin_invitations" as string)
    .select(selectFields)
    .eq("status", "pending")
    .is("target_user_id", null)
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (emailResult.error) throw emailResult.error;
  return emailResult.data || null;
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

  const operation = parsed.data.intent === "remove" ? "admin.role.remove" : parsed.data.intent === "freeze" ? "admin.lifecycle.freeze" : "admin.lifecycle.unfreeze";
  const intent: AdminOperationIntent = { operation, payload: { adminProfileId: parsed.data.adminProfileId, confirmation: parsed.data.confirmation } };
  const proof = asString(formData.get("verificationProof")) || undefined;
  const authorized = await authorizeAdminOperation(intent, proof);
  if (!authorized.ok) return setFlashAndRedirect("error", "Lifecycle action failed", adminVerificationFailureMessage(authorized.code));

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

    if (parsed.data.intent === "remove") {
      const result = await asFlexibleClient(await createClient()).rpc("apply_admin_role_operation", {
        p_operation: operation, p_payload: intent.payload, p_proof: proof || null,
      });
      if (result.error) throw result.error;
      const completed = z.object({ ok: z.literal(true), value: z.object({ targetUserId: z.uuid(), adminProfileId: z.uuid() }) }).safeParse(result.data);
      if (!completed.success || completed.data.value.targetUserId !== target.profile.user_id || completed.data.value.adminProfileId !== target.profile.id) {
        throw new SafeAdminActionError("The verified role removal could not be confirmed. Refresh before trying again.");
      }
      // The dual-verified DB transaction has already removed only admin roles.
      // Cleanup cannot restore its consumed proof or revive those permissions.
      const cleanup = await admin.auth.admin.updateUserById(target.profile.user_id, { ban_duration: "none" });
      if (cleanup.error) throw new SafeAdminActionError("Admin access was removed, but account cleanup needs administrator review. Do not repeat the role removal.");
    } else {
      const reservation = await new AdminVerificationStore().reserve(authorized.value.prepared.actor, intent, proof);
      if (!reservation.ok) throw new SafeAdminActionError(adminVerificationFailureMessage(reservation.code));
      const { error } = await admin.auth.admin.updateUserById(target.profile.user_id, {
        ban_duration: parsed.data.intent === "freeze" ? "876000h" : "none",
      });
      if (error) throw new SafeAdminActionError("The account update could not be confirmed. Ask an administrator to review its state before trying again.");
      const result = await asFlexibleClient(admin).rpc("complete_admin_lifecycle_operation", {
        p_attempt_id: reservation.value.attemptId, p_payload: intent.payload,
      });
      if (result.error || !z.object({ ok: z.literal(true), value: z.null() }).safeParse(result.data).success) {
        throw new SafeAdminActionError("The account update needs administrator review before another attempt. Its verification cannot be reused.");
      }
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

  const proof = asString(formData.get("verificationProof")) || undefined;
  const authorized = await authorizeAdminOperation({ operation: "admin.role.change", payload: parsed.data }, proof);
  if (!authorized.ok) return setFlashAndRedirect("error", "Role change failed", adminVerificationFailureMessage(authorized.code));

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

    const client = asFlexibleClient(await createClient());
    const result = await client.rpc("apply_admin_role_operation", { p_operation: "admin.role.change", p_payload: parsed.data, p_proof: proof ?? null });
    if (result.error || !result.data || typeof result.data !== "object" || result.data.ok !== true) {
      throw result.error || new Error("Admin role verification was not accepted.");
    }
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
    pickFormFields(formData, [
      "displayName",
      "email",
      "inviteMode",
      "memberId",
      "note",
      "roleCode",
      "title",
    ]),
  );

  if (!parsed.success) {
    return setFlashAndRedirect(
      "error",
      "Admin invitation failed",
      parsed.error.issues[0]?.message || "Invalid admin invitation.",
      "/admin/admin-profiles?tab=invitations",
    );
  }

  const proof = asString(formData.get("verificationProof")) || undefined;
  const authorized = await authorizeAdminOperation({ operation: "admin.role.invite", payload: parsed.data }, proof);
  if (!authorized.ok) return setFlashAndRedirect("error", "Admin invitation failed", adminVerificationFailureMessage(authorized.code), "/admin/admin-profiles?tab=invitations");

  const allowedRoles: AdminAccountRoleCode[] = actorRole === "super_admin"
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
    const client = asFlexibleClient(await createClient());
    const issuance = await client.rpc("apply_admin_role_operation", { p_operation: "admin.role.invite", p_payload: parsed.data, p_proof: proof ?? null });
    const bound = z.object({ ok: z.literal(true), value: z.object({ attemptId: z.uuid(), recipientEmail: z.email(), displayName: z.string(), linkedMemberId: z.uuid().nullable() }) }).safeParse(issuance.data);
    if (issuance.error || !bound.success) throw issuance.error || new SafeAdminActionError("Invitation verification was not accepted. Verify again before retrying.");

    let actionLink = `${getAppBaseUrl()}/admin/invite/accept`;
    let claimInvitationId: null | string = null;
    let requiresMemberClaim = false;
    let email = parsed.data.email;
    const displayName = bound.data.value.displayName;
    let linkedMemberId: null | string = null;
    let targetUser: User | null = null;

    if (parsed.data.inviteMode === "member") {
      const member = await findMemberForAdminInvite(admin, parsed.data.memberId);
      if (member.id !== bound.data.value.linkedMemberId || normalizeEmail(member.email) !== bound.data.value.recipientEmail) {
        throw new SafeAdminActionError("The member details changed. Refresh and verify this invitation again.");
      }
      const linkedProfile = await loadAdminProfileByLinkedMember(admin, member.id);
      assertLinkedMemberCanBeInvited({ linkedProfile, member });

      email = normalizeEmail(member.email);
      linkedMemberId = member.id;

      if (!email) {
        throw new Error("Selected member profile has no email address.");
      }

      if (member.user_id) {
        targetUser = { email, id: member.user_id } as User;
      } else {
        const target = await ensureTargetAuthUserForEmail(admin, email);
        actionLink = target.actionLink;
        targetUser = target.user;
      }

      if (!member.is_profile_claimed || member.user_id !== targetUser.id) {
        const claimInvite = await issueInvitationForMember({
          actorUserId,
          admin,
          expiresInDays: 7,
          invitationType: member.member_type === "alumni" ? "alumni_direct" : "member_claim",
          maxUses: 1,
          member,
          note: parsed.data.note || "Issued before admin invitation activation.",
        });
        claimInvitationId = claimInvite.invitationId;
        requiresMemberClaim = true;
        actionLink = buildClaimProfileUrl({
          invitationCode: claimInvite.code,
          jnuitsId: member.jnuits_id || "JnUITS member",
        });
      }
    } else {
      const matchingMember = await findMemberByEmail(admin, parsed.data.email);
      if (matchingMember) {
        throw new Error("This email matches an existing member profile. Search and link that member instead of creating an email-only admin identity.");
      }

      const target = await ensureTargetAuthUserForEmail(admin, parsed.data.email);
      actionLink = target.actionLink;
      targetUser = target.user;
      email = parsed.data.email;
    }

    if (!targetUser) {
      throw new Error("Admin invite target user could not be resolved.");
    }

    const existingAdminGrant = await asFlexibleClient(admin)
      .from("rbac_user_platform_roles" as string)
      .select("id")
      .eq("user_id", targetUser.id)
      .eq("scope", "admin")
      .is("revoked_at", null)
      .limit(1)
      .maybeSingle();

    if (existingAdminGrant.error) throw existingAdminGrant.error;
    if (existingAdminGrant.data) throw new Error("This user already has active admin access.");

    const completion = await asFlexibleClient(admin).rpc("complete_admin_invitation_operation", {
      p_attempt_id: bound.data.value.attemptId,
      p_payload: { targetUserId: targetUser.id, claimInvitationId },
    });
    const completed = z.object({ ok: z.literal(true), value: z.object({ invitationId: z.uuid(), adminProfileId: z.uuid() }) }).safeParse(completion.data);
    if (completion.error || !completed.success) throw completion.error || new SafeAdminActionError("The reserved invitation could not be completed. Refresh its status before retrying.");
    const invitationId = completed.data.value.invitationId;
    const delivery = await sendEmail({
      html: buildAdminInvitationEmail({
        actionLink,
        adminRoleLabel: ADMIN_ROLE_LABELS[parsed.data.roleCode],
        expiresInDays: 7,
        recipientEmail: email,
        recipientName: displayName || email,
        requiresMemberClaim,
      }),
      subject: "Your JnUITS admin workspace invitation",
      to: email,
    });

    const deliveryUpdate = await asFlexibleClient(admin)
      .from("admin_invitations" as string)
      .update({
        delivery_status: delivery.success ? "sent" : "failed",
        last_sent_at: delivery.success ? new Date().toISOString() : null,
        provider_message_id: delivery.messageId || null,
        send_attempts: 1,
        status: delivery.success ? "pending" : "failed",
      })
      .eq("id", invitationId);

    await recordSecurityEvent(admin, {
      actorUserId,
      eventType: "admin_invitation.created",
      payload: {
        claimInvitationId,
        deliveryStatus: delivery.success ? "sent" : "failed",
        invitationId,
        inviteMode: parsed.data.inviteMode,
        linkedMemberId,
        roleCode: parsed.data.roleCode,
      },
      severity: parsed.data.roleCode === "super_admin" ? "critical" : "warning",
      targetUserId: targetUser.id,
    });
    if (deliveryUpdate.error || !delivery.success) throw new SafeAdminActionError("The invitation was created but email delivery did not complete. Check its status before reissuing it.");
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
      message: "The admin invitation was created. Linked unclaimed member profiles must be claimed before admin activation.",
    },
    "/admin/admin-profiles",
  );
  redirect("/admin/admin-profiles?tab=invitations");
}

export async function revokeAdminInvitationAction(formData: FormData) {
  const auth = await requireAdminPermission("admin.roles.manage_admin", {
    fallbackPath: "/admin/admin-profiles?tab=invitations",
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

  const proof = asString(formData.get("verificationProof")) || undefined;
  const authorized = await authorizeAdminOperation({ operation: "admin.invitation.revoke", payload: parsed.data }, proof);
  if (!authorized.ok) return setFlashAndRedirect("error", "Invitation revoke failed", adminVerificationFailureMessage(authorized.code), "/admin/admin-profiles?tab=invitations");

  try {
    const result = await asFlexibleClient(await createClient()).rpc("revoke_admin_invitation_verified", {
      p_payload: parsed.data, p_proof: proof || null,
    });
    if (result.error) throw result.error;
    if (!z.object({ ok: z.literal(true), value: z.null() }).safeParse(result.data).success) {
      throw new SafeAdminActionError("The verified invitation cancellation could not be confirmed. Refresh before trying again.");
    }
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
    const invitationData = await loadPendingAdminInvitationForUser(admin, user);

    if (!invitationData) throw new Error("No pending admin invitation was found for this account.");

    const invitation = invitationData as AdminInvitationRecord & { expires_at?: string };
    const roleCode = normalizeAdminRoleCode(invitation.invited_role_code);
    if (!roleCode) throw new Error("The invited admin role is not valid.");
    const expiresAt = Date.parse(invitation.expires_at || "");
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      await asFlexibleClient(admin).from("admin_invitations" as string).update({ status: "expired" }).eq("id", invitation.id);
      throw new Error("This admin invitation has expired.");
    }
    if (invitation.target_user_id && invitation.target_user_id !== user.id) throw new Error("This invitation belongs to a different signed-in user.");

    if (invitation.target_admin_profile_id) {
      const profileResult = await asFlexibleClient(admin)
        .from("admin_profiles" as string)
        .select("id, user_id, linked_member_id")
        .eq("id", invitation.target_admin_profile_id)
        .maybeSingle();

      if (profileResult.error || !profileResult.data) {
        throw profileResult.error || new Error("The pending admin profile was not found.");
      }

      const adminProfile = profileResult.data as {
        id: string;
        linked_member_id?: null | string;
        user_id: string;
      };

      if (adminProfile.user_id !== user.id) {
        throw new Error("This admin profile belongs to a different signed-in user.");
      }

      if (adminProfile.linked_member_id) {
        const memberResult = await asFlexibleClient(admin)
          .from("members" as string)
          .select("id, user_id, is_profile_claimed")
          .eq("id", adminProfile.linked_member_id)
          .maybeSingle();

        if (memberResult.error || !memberResult.data) {
          throw memberResult.error || new Error("The linked member profile was not found.");
        }

        const member = memberResult.data as {
          id: string;
          is_profile_claimed?: boolean | null;
          user_id?: null | string;
        };

        if (!member.is_profile_claimed || member.user_id !== user.id) {
          throw new Error("Claim the linked member profile with this same account before accepting admin access.");
        }
      }
    }

    const client = await createClient();
    const result = await asFlexibleClient(client).rpc("accept_verified_admin_invitation", { p_invitation_id: invitation.id });
    if (result.error) throw result.error;
    if (!result.data || typeof result.data !== "object" || result.data.ok !== true) {
      const code = result.data && typeof result.data === "object" ? result.data.code : null;
      const messages: Record<string, string> = {
        invitation_reissue_required: "This legacy invitation requires authorized reissuance.",
        invitation_expired: "This admin invitation has expired.",
        invitation_claim_required: "Claim the linked member profile with this same account before accepting admin access.",
        invitation_wrong_account: "This invitation belongs to a different signed-in user.",
      };
      throw new SafeAdminActionError(typeof code === "string" && messages[code] ? messages[code] : "This invitation could not be activated.");
    }
    // The grant advances the role version. Do not keep stale recipient claims.
    const refreshed = await client.auth.refreshSession();
    if (refreshed.error) throw new SafeAdminActionError("Admin access was recorded. Sign in again to refresh your session.");
  } catch (error) {
    logServerError("adminInvitation.accept", error);
    redirect(buildAdminInvitationAcceptPath({ state: resolveAdminInvitationAcceptanceState(error) }));
  }

  revalidatePath("/", "layout");
  redirect("/admin/mfa/setup");
}
