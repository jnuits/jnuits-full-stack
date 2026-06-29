export type AdminAccountRoleCode = "admin" | "content_admin" | "super_admin";

export type AdminAccountLifecycleStatus =
  | "active"
  | "frozen"
  | "pending_invite"
  | "removed";

export type AdminAccountCapabilityInput = {
  actorRole: AdminAccountRoleCode | null;
  actorUserId: string;
  hasManageAdminRoles: boolean;
  targetLifecycleStatus: AdminAccountLifecycleStatus;
  targetRole: AdminAccountRoleCode | null;
  targetUserId: string;
};

export type AdminAccountCapabilities = {
  allowedInviteRoles: AdminAccountRoleCode[];
  allowedRoleTargets: AdminAccountRoleCode[];
  canChangeRole: boolean;
  canEditProfile: boolean;
  canFreeze: boolean;
  canInvite: boolean;
  canRemove: boolean;
  canUnfreeze: boolean;
};

const ADMIN_ROLE_CODES = new Set(["admin", "content_admin", "super_admin"]);
const ADMIN_LIFECYCLE_STATUSES = new Set([
  "active",
  "frozen",
  "pending_invite",
  "removed",
]);

const ROLE_RANK: Record<AdminAccountRoleCode, number> = {
  content_admin: 1,
  admin: 2,
  super_admin: 3,
};

export const ADMIN_ROLE_LABELS: Record<AdminAccountRoleCode, string> = {
  admin: "Admin",
  content_admin: "Content Admin",
  super_admin: "Super Admin",
};

export const ADMIN_LIFECYCLE_LABELS: Record<
  AdminAccountLifecycleStatus,
  string
> = {
  active: "Active",
  frozen: "Frozen",
  pending_invite: "Pending invite",
  removed: "Removed",
};

export function normalizeAdminRoleCode(
  value: null | string | undefined,
): AdminAccountRoleCode | null {
  return value && ADMIN_ROLE_CODES.has(value)
    ? (value as AdminAccountRoleCode)
    : null;
}

export function normalizeAdminLifecycleStatus(
  value: null | string | undefined,
  isActive: boolean,
): AdminAccountLifecycleStatus {
  if (value && ADMIN_LIFECYCLE_STATUSES.has(value)) {
    return value as AdminAccountLifecycleStatus;
  }

  return isActive ? "active" : "removed";
}

export function isActiveAdminLifecycle(
  status: AdminAccountLifecycleStatus,
  isActive: boolean,
) {
  return isActive && status === "active";
}

export function canActorSeeTarget(options: {
  actorRole: AdminAccountRoleCode | null;
  actorUserId: string;
  targetRole: AdminAccountRoleCode | null;
  targetUserId: string;
}) {
  if (options.actorUserId === options.targetUserId) {
    return true;
  }

  if (options.actorRole === "super_admin") {
    return true;
  }

  return (
    options.actorRole === "admin" && options.targetRole === "content_admin"
  );
}

export function resolveAllowedInviteRoles(options: {
  actorRole: AdminAccountRoleCode | null;
  hasManageAdminRoles: boolean;
}): AdminAccountRoleCode[] {
  if (!options.hasManageAdminRoles) {
    return [];
  }

  if (options.actorRole === "super_admin") {
    return ["super_admin", "admin", "content_admin"];
  }

  if (options.actorRole === "admin") {
    return ["content_admin"];
  }

  return [];
}

export function resolveAdminAccountCapabilities(
  input: AdminAccountCapabilityInput,
): AdminAccountCapabilities {
  const isSelf = input.actorUserId === input.targetUserId;
  const actorRank = input.actorRole ? ROLE_RANK[input.actorRole] : 0;
  const targetRank = input.targetRole ? ROLE_RANK[input.targetRole] : 0;
  const managesLowerRole =
    input.hasManageAdminRoles &&
    !isSelf &&
    actorRank > targetRank &&
    targetRank > 0;
  const superAdminManagingAnyLowerRole =
    input.hasManageAdminRoles &&
    input.actorRole === "super_admin" &&
    !isSelf &&
    targetRank > 0;
  const adminManagingContentAdmin =
    input.hasManageAdminRoles &&
    input.actorRole === "admin" &&
    !isSelf &&
    input.targetRole === "content_admin";
  const canManageTarget =
    superAdminManagingAnyLowerRole || adminManagingContentAdmin;
  const allowedInviteRoles = resolveAllowedInviteRoles({
    actorRole: input.actorRole,
    hasManageAdminRoles: input.hasManageAdminRoles,
  });
  const allowedRoleTargets: AdminAccountRoleCode[] =
    input.actorRole === "super_admin" && input.hasManageAdminRoles
      ? ["super_admin", "admin", "content_admin"]
      : [];

  return {
    allowedInviteRoles,
    allowedRoleTargets,
    canChangeRole:
      canManageTarget &&
      managesLowerRole &&
      input.targetLifecycleStatus !== "removed" &&
      allowedRoleTargets.length > 0,
    canEditProfile:
      isSelf ||
      input.actorRole === "super_admin" ||
      input.actorRole === "admin" && input.targetRole === "content_admin",
    canFreeze:
      canManageTarget && input.targetLifecycleStatus === "active",
    canInvite: allowedInviteRoles.length > 0,
    canRemove:
      canManageTarget && input.targetLifecycleStatus !== "removed",
    canUnfreeze:
      canManageTarget && input.targetLifecycleStatus === "frozen",
  };
}

