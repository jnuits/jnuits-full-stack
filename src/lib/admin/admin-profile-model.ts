import {
  ADMIN_LIFECYCLE_LABELS,
  ADMIN_ROLE_LABELS,
  normalizeAdminLifecycleStatus,
  normalizeAdminRoleCode,
  type AdminAccountCapabilities,
  type AdminAccountLifecycleStatus,
  type AdminAccountRoleCode,
} from "@/lib/admin/admin-account-policy";

export type AdminProfileStatusFilter =
  | ""
  | "active"
  | "frozen"
  | "inactive"
  | "pending_invite"
  | "removed";

export type AdminProfileTab = "access" | "directory" | "invitations" | "self";

export type AdminProfileFilters = {
  inviteMemberQ: string;
  profile: string;
  q: string;
  role: string;
  status: AdminProfileStatusFilter;
  tab: AdminProfileTab;
};

export type AdminProfileRole = {
  code: AdminAccountRoleCode;
  displayName: string;
};

export type AdminProfileLinkedMember = {
  email: null | string;
  fullName: null | string;
  id: string;
  jnuitsId: null | string;
  memberType: null | string;
};

export type AdminInviteMemberCandidate = {
  blockedReason: null | string;
  canInvite: boolean;
  email: null | string;
  fullName: null | string;
  hasActiveAdminGrant: boolean;
  id: string;
  isExecutive: boolean;
  isProfileClaimed: boolean;
  jnuitsId: null | string;
  lifecycleStatus: null | string;
  linkedAdminCode: null | string;
  linkedAdminProfileId: null | string;
  linkedAdminStatus: null | string;
  memberType: null | string;
  portalAccessStatus: null | string;
  userId: null | string;
};

export type AdminProfileDirectoryProfile = {
  adminCode: string;
  avatarSecureUrl: null | string;
  canEdit: boolean;
  capabilities: AdminAccountCapabilities;
  createdAt: string;
  displayName: string;
  email: null | string;
  id: string;
  isActive: boolean;
  isSuperAdmin: boolean;
  linkedMember: AdminProfileLinkedMember | null;
  linkedMemberId: null | string;
  lifecycleLabel: string;
  lifecycleStatus: AdminAccountLifecycleStatus;
  primaryRole: AdminProfileRole | null;
  roles: AdminProfileRole[];
  statusReason: null | string;
  statusUpdatedAt: null | string;
  statusUpdatedByUserId: null | string;
  title: null | string;
  updatedAt: string;
  userId: string;
};

export type AdminInvitationStatus =
  | "accepted"
  | "expired"
  | "failed"
  | "pending"
  | "revoked";

export type AdminInvitationDeliveryStatus =
  | "failed"
  | "pending"
  | "sent"
  | "skipped";

export type AdminAccountInvitation = {
  acceptedAt: null | string;
  deliveryStatus: AdminInvitationDeliveryStatus;
  email: string;
  expiresAt: string;
  id: string;
  invitedByUserId: null | string;
  invitedRoleCode: AdminAccountRoleCode;
  lastSentAt: null | string;
  note: null | string;
  revokedAt: null | string;
  sendAttempts: number;
  status: AdminInvitationStatus;
  targetAdminProfileId: null | string;
  targetUserId: null | string;
};

export type AdminProfileStats = {
  active: number;
  admins: number;
  contentAdmins: number;
  frozen: number;
  inactive: number;
  pendingInvites: number;
  removed: number;
  superAdmins: number;
  total: number;
};

export type AdminProfileAuditActivityInput = {
  action: null | string;
  actor_user_id: null | string;
  created_at: null | string;
  entity_id: null | string;
  entity_type: null | string;
  id: string;
};

export type AdminProfileSecurityActivityInput = {
  actor_user_id: null | string;
  created_at: null | string;
  event_type: null | string;
  id: string;
  severity: null | string;
  target_user_id: null | string;
};

export type AdminProfileActivity = {
  actorUserId: null | string;
  createdAt: string;
  entityId?: null | string;
  entityType?: null | string;
  id: string;
  kind: "audit" | "security";
  label: string;
  severity?: null | string;
  targetUserId?: null | string;
};

const VALID_STATUSES = new Set([
  "active",
  "frozen",
  "inactive",
  "pending_invite",
  "removed",
]);
const VALID_TABS = new Set(["access", "directory", "invitations", "self"]);

function readParam(
  params: Record<string, string | string[] | undefined>,
  key: keyof AdminProfileFilters,
) {
  const value = params[key];
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function cleanFilterValue(value: string, max = 120) {
  return value.replace(/[()]/g, " ").trim().slice(0, max);
}

export function parseAdminProfileFilters(
  searchParams: Record<string, string | string[] | undefined>,
): AdminProfileFilters {
  const status = cleanFilterValue(readParam(searchParams, "status"), 24);
  const tab = cleanFilterValue(readParam(searchParams, "tab"), 24);

  return {
    inviteMemberQ: cleanFilterValue(readParam(searchParams, "inviteMemberQ"), 120),
    profile: cleanFilterValue(readParam(searchParams, "profile"), 80),
    q: cleanFilterValue(readParam(searchParams, "q"), 120),
    role: cleanFilterValue(readParam(searchParams, "role"), 80),
    status: VALID_STATUSES.has(status)
      ? (status as AdminProfileStatusFilter)
      : "",
    tab: VALID_TABS.has(tab) ? (tab as AdminProfileTab) : "directory",
  };
}

function searchableProfileText(profile: AdminProfileDirectoryProfile) {
  return [
    profile.displayName,
    profile.email,
    profile.adminCode,
    profile.title,
    profile.lifecycleLabel,
    profile.statusReason,
    profile.linkedMember?.fullName,
    profile.linkedMember?.email,
    profile.linkedMember?.jnuitsId,
    ...profile.roles.flatMap((role) => [role.code, role.displayName]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function filterAdminProfiles(
  profiles: AdminProfileDirectoryProfile[],
  filters: AdminProfileFilters,
) {
  const query = filters.q.toLowerCase();

  return profiles.filter((profile) => {
    if (filters.status === "active" && profile.lifecycleStatus !== "active") {
      return false;
    }

    if (filters.status === "inactive" && profile.isActive) {
      return false;
    }

    if (
      filters.status &&
      filters.status !== "active" &&
      filters.status !== "inactive" &&
      profile.lifecycleStatus !== filters.status
    ) {
      return false;
    }

    if (
      filters.role &&
      !profile.roles.some((role) => role.code === filters.role)
    ) {
      return false;
    }

    if (query && !searchableProfileText(profile).includes(query)) {
      return false;
    }

    return true;
  });
}

export function buildAdminProfileStats(
  profiles: AdminProfileDirectoryProfile[],
): AdminProfileStats {
  return profiles.reduce<AdminProfileStats>(
    (stats, profile) => {
      stats.total += 1;
      if (profile.isActive) {
        stats.active += 1;
      } else {
        stats.inactive += 1;
      }
      if (profile.lifecycleStatus === "pending_invite") {
        stats.pendingInvites += 1;
      }
      if (profile.lifecycleStatus === "frozen") {
        stats.frozen += 1;
      }
      if (profile.lifecycleStatus === "removed") {
        stats.removed += 1;
      }
      if (profile.roles.some((role) => role.code === "super_admin")) {
        stats.superAdmins += 1;
      }
      if (profile.roles.some((role) => role.code === "content_admin")) {
        stats.contentAdmins += 1;
      }
      if (profile.roles.some((role) => role.code === "admin")) {
        stats.admins += 1;
      }
      return stats;
    },
    {
      active: 0,
      admins: 0,
      contentAdmins: 0,
      frozen: 0,
      inactive: 0,
      pendingInvites: 0,
      removed: 0,
      superAdmins: 0,
      total: 0,
    },
  );
}

export function toAdminProfileRole(
  value: null | string | undefined,
  displayName?: null | string,
): AdminProfileRole | null {
  const code = normalizeAdminRoleCode(value);

  if (!code) {
    return null;
  }

  return {
    code,
    displayName: displayName || ADMIN_ROLE_LABELS[code],
  };
}

export function toAdminLifecycleStatus(
  value: null | string | undefined,
  isActive: boolean,
) {
  const status = normalizeAdminLifecycleStatus(value, isActive);

  return {
    label: ADMIN_LIFECYCLE_LABELS[status],
    status,
  };
}

function normalizeCreatedAt(value: null | string) {
  return value || new Date(0).toISOString();
}

export function combineAdminProfileActivities(
  auditRows: AdminProfileAuditActivityInput[],
  securityRows: AdminProfileSecurityActivityInput[],
): AdminProfileActivity[] {
  const auditActivities: AdminProfileActivity[] = auditRows.map((row) => ({
    actorUserId: row.actor_user_id,
    createdAt: normalizeCreatedAt(row.created_at),
    entityId: row.entity_id,
    entityType: row.entity_type,
    id: row.id,
    kind: "audit",
    label: row.action || "audit event",
  }));

  const securityActivities: AdminProfileActivity[] = securityRows.map(
    (row) => ({
      actorUserId: row.actor_user_id,
      createdAt: normalizeCreatedAt(row.created_at),
      id: row.id,
      kind: "security",
      label: row.event_type || "security event",
      severity: row.severity,
      targetUserId: row.target_user_id,
    }),
  );

  return [...auditActivities, ...securityActivities]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 5);
}
