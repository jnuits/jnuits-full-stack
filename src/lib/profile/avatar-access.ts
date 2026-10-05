import "server-only";
import { cookies } from "next/headers";
import { isStepUpActiveForUser } from "@/lib/auth/step-up";

import { logServerError } from "@/lib/errors/api-error";
import {
  getAuthContext,
  hasPermission,
  isMutablePortalAccess,
  type MemberLifecycleStatus,
  type PortalAccessStatus,
} from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";
import { reconcileMembershipLifecycle } from "@/lib/membership/reconciliation";

export const PROFILE_AVATAR_UPLOAD_PRESET = "jnuits_profile_avatars";
export const PROFILE_AVATAR_MAX_BYTES = 1_048_576;
export const PROFILE_AVATAR_MIN_DIMENSION = 400;
export const PROFILE_AVATAR_MAX_DIMENSION = 800;
export const PROFILE_AVATAR_STORED_DIMENSION = 400;
export const PROFILE_AVATAR_ALLOWED_FORMATS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
] as const;

export type AvatarTargetType = "admin_profile" | "member";

type AuthorizationFailure = {
  message: string;
  ok: false;
  status: 401 | 403 | 404 | 500;
};

export type AuthorizedAvatarTarget = {
  actorUserId: string;
  admin: ReturnType<typeof createAdminClient>;
  publicId: string;
  targetId: string;
  targetType: AvatarTargetType;
  targetUserId: null | string;
};

type AuthorizationSuccess = {
  ok: true;
  target: AuthorizedAvatarTarget;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asOptionalString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asLifecycleStatus(value: unknown): MemberLifecycleStatus | null {
  return value === "alumni" ||
    value === "current" ||
    value === "deleted" ||
    value === "former"
    ? value
    : null;
}

function asPortalAccessStatus(value: unknown): PortalAccessStatus | null {
  return value === "active" ||
    value === "deactivated" ||
    value === "deletion_requested" ||
    value === "frozen" ||
    value === "suspended"
    ? value
    : null;
}

export function buildAvatarPublicId(targetType: AvatarTargetType, targetId: string) {
  return targetType === "member"
    ? `jnuits/member-avatars/${targetId}/avatar`
    : `jnuits/admin-avatars/${targetId}/avatar`;
}

async function isSuperAdminUser(
  admin: ReturnType<typeof createAdminClient>,
  userId: string
) {
  const { data } = await asFlexibleClient(admin).rpc(
    "is_super_admin_user" as string,
    { target_user_id: userId }
  );

  return data === true;
}

export async function authorizeAvatarTarget(
  targetType: AvatarTargetType,
  targetId: string
): Promise<AuthorizationFailure | AuthorizationSuccess> {
  const auth = await getAuthContext();

  if (!auth.user?.id) {
    return {
      message: "Sign in before updating a profile photo.",
      ok: false,
      status: 401,
    };
  }

  const admin = createAdminClient();
  const flexibleAdmin = asFlexibleClient(admin);
  const actorUserId = auth.user.id;

  if (targetType === "member") {
    const readMember = () => flexibleAdmin
      .from("members" as string)
      .select("id, user_id, lifecycle_status, portal_access_status, current_membership_path_status")
      .eq("id", targetId)
      .maybeSingle();
    let { data, error } = await readMember();
    const initial = asRecord(data);
    if (!error && initial.user_id === actorUserId && initial.portal_access_status === "active"
      && (initial.lifecycle_status === "current" || initial.lifecycle_status === "former")) {
      try {
        await reconcileMembershipLifecycle({ memberId: targetId });
        ({ data, error } = await readMember());
      } catch {
        return { ok: false, status: 500, message: "Membership status could not be verified. Please try again later." };
      }
    }
    const member = asRecord(data);
    const memberId = asOptionalString(member.id);
    const memberUserId = asOptionalString(member.user_id);

    if (error) {
      logServerError("avatar-access member lookup", error);
      return {
        message: "Member profile could not be loaded.",
        ok: false,
        status: 500,
      };
    }

    if (!memberId) {
      return {
        message: "Member profile was not found.",
        ok: false,
        status: 404,
      };
    }

    const ownMutableProfile =
      memberUserId === actorUserId &&
      isMutablePortalAccess({
        lifecycleStatus: asLifecycleStatus(member.lifecycle_status),
        memberId,
        currentMembershipPathStatus: asOptionalString(member.current_membership_path_status),
        portalAccessStatus: asPortalAccessStatus(member.portal_access_status),
      });
    if (ownMutableProfile && !isStepUpActiveForUser(await cookies(), actorUserId)) {
      return { ok: false, status: 403, message: "Unlock profile editing with your current password before updating your photo." };
    }
    const canManageMembers =
      ownMutableProfile || (await hasPermission("admin.membership.manage"));

    if (!canManageMembers) {
      return {
        message:
          memberUserId === actorUserId
            ? "This member profile is currently read-only."
            : "You do not have permission to update this member photo.",
        ok: false,
        status: 403,
      };
    }

    return {
      ok: true,
      target: {
        actorUserId,
        admin,
        publicId: buildAvatarPublicId("member", memberId),
        targetId: memberId,
        targetType,
        targetUserId: memberUserId,
      },
    };
  }

  const { data, error } = await flexibleAdmin
    .from("admin_profiles" as string)
    .select("id, user_id, is_active")
    .eq("id", targetId)
    .maybeSingle();
  const profile = asRecord(data);
  const profileId = asOptionalString(profile.id);
  const profileUserId = asOptionalString(profile.user_id);

  if (error) {
    logServerError("avatar-access admin profile lookup", error);
    return {
      message: "Admin profile could not be loaded.",
      ok: false,
      status: 500,
    };
  }

  if (!profileId || !profileUserId) {
    return {
      message: "Admin profile was not found.",
      ok: false,
      status: 404,
    };
  }

  const ownActiveProfile = profileUserId === actorUserId && profile.is_active !== false;
  const canManageAdminProfiles =
    ownActiveProfile || (await hasPermission("admin.admin_profiles.manage"));

  if (!canManageAdminProfiles) {
    return {
      message:
        profileUserId === actorUserId
          ? "Only active admin profiles can update their own photo."
          : "You do not have permission to update this admin photo.",
      ok: false,
      status: 403,
    };
  }

  if (
    profileUserId !== actorUserId &&
    auth.user.adminRole !== "super_admin" &&
    (await isSuperAdminUser(admin, profileUserId))
  ) {
    return {
      message: "Only super admins can update super admin profile photos.",
      ok: false,
      status: 403,
    };
  }

  return {
    ok: true,
    target: {
      actorUserId,
      admin,
      publicId: buildAvatarPublicId("admin_profile", profileId),
      targetId: profileId,
      targetType,
      targetUserId: profileUserId,
    },
  };
}
