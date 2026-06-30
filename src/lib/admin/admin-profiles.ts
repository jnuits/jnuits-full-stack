import "server-only";

import {
  canActorSeeTarget,
  normalizeAdminLifecycleStatus,
  normalizeAdminRoleCode,
  resolveAdminAccountCapabilities,
  resolveAllowedInviteRoles,
  type AdminAccountRoleCode,
} from "@/lib/admin/admin-account-policy";
import {
  buildAdminProfileStats,
  combineAdminProfileActivities,
  filterAdminProfiles,
  toAdminLifecycleStatus,
  toAdminProfileRole,
  type AdminAccountInvitation,
  type AdminInviteMemberCandidate,
  type AdminInvitationDeliveryStatus,
  type AdminInvitationStatus,
  type AdminProfileActivity,
  type AdminProfileAuditActivityInput,
  type AdminProfileDirectoryProfile,
  type AdminProfileFilters,
  type AdminProfileLinkedMember,
  type AdminProfileRole,
  type AdminProfileSecurityActivityInput,
} from "@/lib/admin/admin-profile-model";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";

type AdminProfileRow = {
  admin_code: string;
  avatar_secure_url: null | string;
  created_at: string;
  display_name: string;
  email: null | string;
  id: string;
  is_active: boolean;
  linked_member_id: null | string;
  status?: null | string;
  status_reason?: null | string;
  status_updated_at?: null | string;
  status_updated_by_user_id?: null | string;
  title: null | string;
  updated_at: string;
  user_id: string;
};

type RoleGrantRow = {
  rbac_platform_roles:
    | { code?: null | string; display_name?: null | string }
    | Array<{ code?: null | string; display_name?: null | string }>
    | null;
  user_id: string;
};

type MemberRow = {
  email: null | string;
  full_name: null | string;
  id: string;
  jnuits_id: null | string;
  member_type: null | string;
};

type MemberSearchRow = MemberRow & {
  is_profile_claimed?: boolean | null;
  lifecycle_status?: null | string;
  portal_access_status?: null | string;
  user_id?: null | string;
};

type LinkedAdminProfileRow = {
  admin_code: string;
  id: string;
  is_active: boolean;
  linked_member_id: null | string;
  status?: null | string;
  user_id: string;
};

type CommitteeAssignmentRow = {
  member_id: null | string;
};

type AdminInvitationRow = {
  accepted_at?: null | string;
  delivery_status?: null | string;
  email?: null | string;
  expires_at?: null | string;
  id: string;
  invited_by_user_id?: null | string;
  invited_role_code?: null | string;
  last_sent_at?: null | string;
  note?: null | string;
  revoked_at?: null | string;
  send_attempts?: null | number;
  status?: null | string;
  target_admin_profile_id?: null | string;
  target_user_id?: null | string;
};

type SupabaseLikeError = {
  code?: null | string;
  message?: null | string;
};

export type AdminProfileDirectoryData = {
  actorInviteRoles: AdminAccountRoleCode[];
  actorProfile: AdminProfileDirectoryProfile | null;
  activities: AdminProfileActivity[];
  filteredProfiles: AdminProfileDirectoryProfile[];
  invitationMemberCandidates: AdminInviteMemberCandidate[];
  invitations: AdminAccountInvitation[];
  profiles: AdminProfileDirectoryProfile[];
  roleOptions: AdminProfileRole[];
  selectedProfile: AdminProfileDirectoryProfile | null;
  stats: ReturnType<typeof buildAdminProfileStats>;
};

function resolveRoleRelations(relation: RoleGrantRow["rbac_platform_roles"]) {
  if (!relation) {
    return [];
  }

  return Array.isArray(relation) ? relation : [relation];
}

function rolePriority(code: string) {
  if (code === "super_admin") return 0;
  if (code === "admin") return 1;
  if (code === "content_admin") return 2;
  return 10;
}

function sortRoles(roles: AdminProfileRole[]) {
  return [...roles].sort((left, right) => {
    const priorityDelta = rolePriority(left.code) - rolePriority(right.code);
    return priorityDelta || left.displayName.localeCompare(right.displayName);
  });
}

function addRole(
  rolesByUserId: Map<string, Map<string, AdminProfileRole>>,
  userId: string,
  role: AdminProfileRole,
) {
  const existing =
    rolesByUserId.get(userId) || new Map<string, AdminProfileRole>();
  existing.set(role.code, role);
  rolesByUserId.set(userId, existing);
}

function buildRoleOptions(profiles: AdminProfileDirectoryProfile[]) {
  const options = new Map<string, AdminProfileRole>();
  for (const profile of profiles) {
    for (const role of profile.roles) {
      options.set(role.code, role);
    }
  }
  return sortRoles(Array.from(options.values()));
}

function toLinkedMember(
  row: MemberRow | undefined,
): AdminProfileLinkedMember | null {
  if (!row) {
    return null;
  }

  return {
    email: row.email,
    fullName: row.full_name,
    id: row.id,
    jnuitsId: row.jnuits_id,
    memberType: row.member_type,
  };
}

function asInvitationStatus(value: null | string | undefined): AdminInvitationStatus {
  return value === "accepted" ||
    value === "expired" ||
    value === "failed" ||
    value === "revoked"
    ? value
    : "pending";
}

function asDeliveryStatus(
  value: null | string | undefined,
): AdminInvitationDeliveryStatus {
  return value === "failed" || value === "sent" || value === "skipped"
    ? value
    : "pending";
}

function mapInvitation(row: AdminInvitationRow): AdminAccountInvitation | null {
  const roleCode = normalizeAdminRoleCode(row.invited_role_code);

  if (!roleCode || !row.email || !row.expires_at) {
    return null;
  }

  return {
    acceptedAt: row.accepted_at || null,
    deliveryStatus: asDeliveryStatus(row.delivery_status),
    email: row.email,
    expiresAt: row.expires_at,
    id: row.id,
    invitedByUserId: row.invited_by_user_id || null,
    invitedRoleCode: roleCode,
    lastSentAt: row.last_sent_at || null,
    note: row.note || null,
    revokedAt: row.revoked_at || null,
    sendAttempts: row.send_attempts || 0,
    status: asInvitationStatus(row.status),
    targetAdminProfileId: row.target_admin_profile_id || null,
    targetUserId: row.target_user_id || null,
  };
}

function isMissingAdminInvitationsRelation(error: SupabaseLikeError) {
  const message = error.message || '';

  return (
    error.code === '42P01' ||
    error.code === 'PGRST106' ||
    error.code === 'PGRST200' ||
    error.code === 'PGRST205' ||
    message.includes('admin_invitations') ||
    message.includes('Could not find the table')
  );
}

function logOptionalAdminInvitationLoadError(error: SupabaseLikeError) {
  if (isMissingAdminInvitationsRelation(error)) {
    return;
  }

  if (process.env.NODE_ENV !== 'development') {
    console.error('Admin invitations load failed', {
      code: error.code,
      message: error.message,
    });
  }
}

async function loadSelectedProfileActivities(
  admin: ReturnType<typeof createAdminClient>,
  profile: AdminProfileDirectoryProfile | null,
) {
  if (!profile) {
    return [];
  }

  const flexibleAdmin = asFlexibleClient(admin);
  const [auditResult, securityResult] = await Promise.all([
    flexibleAdmin
      .from("audit_events" as string)
      .select("id, action, actor_user_id, entity_type, entity_id, created_at")
      .or(`actor_user_id.eq.${profile.userId},entity_id.eq.${profile.id}`)
      .order("created_at", { ascending: false })
      .limit(5),
    flexibleAdmin
      .from("security_events" as string)
      .select(
        "id, event_type, severity, actor_user_id, target_user_id, created_at",
      )
      .or(
        `actor_user_id.eq.${profile.userId},target_user_id.eq.${profile.userId}`,
      )
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  if (auditResult.error || securityResult.error) {
    console.error("Admin profile activity load failed", {
      auditError: auditResult.error,
      securityError: securityResult.error,
    });
  }

  return combineAdminProfileActivities(
    (auditResult.data || []) as AdminProfileAuditActivityInput[],
    (securityResult.data || []) as AdminProfileSecurityActivityInput[],
  );
}

export function cleanMemberSearchQuery(value: string) {
  return value.replace(/[%*,_]/g, " ").trim().slice(0, 80);
}

function memberSearchPattern(query: string) {
  return `%${query}%`;
}

function isBlockingLinkedAdminProfile(profile: LinkedAdminProfileRow | undefined) {
  if (!profile) {
    return false;
  }

  return normalizeAdminLifecycleStatus(profile.status, profile.is_active) !== "removed";
}

function mapMemberCandidate(options: {
  activeAdminUserIds: Set<string>;
  executiveMemberIds: Set<string>;
  linkedAdminProfileByMemberId: Map<string, LinkedAdminProfileRow>;
  row: MemberSearchRow;
}): AdminInviteMemberCandidate {
  const linkedProfile = options.linkedAdminProfileByMemberId.get(options.row.id);
  const hasActiveAdminGrant = options.row.user_id
    ? options.activeAdminUserIds.has(options.row.user_id)
    : false;
  const hasBlockingLinkedProfile = isBlockingLinkedAdminProfile(linkedProfile);
  const blockedReason = !options.row.email
    ? "Member profile has no email address."
    : hasActiveAdminGrant
      ? "This member's account already has active admin access."
      : hasBlockingLinkedProfile
        ? "This member is already linked to an admin identity."
        : null;

  return {
    blockedReason,
    canInvite: !blockedReason,
    email: options.row.email,
    fullName: options.row.full_name,
    hasActiveAdminGrant,
    id: options.row.id,
    isExecutive: options.executiveMemberIds.has(options.row.id),
    isProfileClaimed: Boolean(options.row.is_profile_claimed),
    jnuitsId: options.row.jnuits_id,
    lifecycleStatus: options.row.lifecycle_status || null,
    linkedAdminCode: linkedProfile?.admin_code || null,
    linkedAdminProfileId: linkedProfile?.id || null,
    linkedAdminStatus: linkedProfile
      ? normalizeAdminLifecycleStatus(linkedProfile.status, linkedProfile.is_active)
      : null,
    memberType: options.row.member_type,
    portalAccessStatus: options.row.portal_access_status || null,
    userId: options.row.user_id || null,
  };
}

async function loadAdminInviteMemberCandidates(options: {
  actorRole: AdminAccountRoleCode | null;
  admin: ReturnType<typeof createAdminClient>;
  filters: AdminProfileFilters;
  hasManageAdminRoles: boolean;
}) {
  const allowedInviteRoles = resolveAllowedInviteRoles({
    actorRole: options.actorRole,
    hasManageAdminRoles: options.hasManageAdminRoles,
  });
  const query = cleanMemberSearchQuery(options.filters.inviteMemberQ);

  if (allowedInviteRoles.length === 0 || query.length < 2) {
    return [];
  }

  const flexibleAdmin = asFlexibleClient(options.admin);
  const pattern = memberSearchPattern(query);
  const memberResult = await flexibleAdmin
    .from("members" as string)
    .select(
      "id, user_id, jnuits_id, full_name, email, member_type, is_profile_claimed, lifecycle_status, portal_access_status",
    )
    .or(
      `full_name.ilike.${pattern},email.ilike.${pattern},jnuits_id.ilike.${pattern},member_type.ilike.${pattern}`,
    )
    .order("full_name", { ascending: true })
    .limit(12);

  if (memberResult.error) {
    if (process.env.NODE_ENV !== "development") {
      console.error("Admin invite member search failed", {
        code: memberResult.error.code,
        message: memberResult.error.message,
      });
    }
    return [];
  }

  const members = (memberResult.data || []) as MemberSearchRow[];
  const memberIds = members.map((member) => member.id);
  const userIds = members
    .map((member) => member.user_id)
    .filter((userId): userId is string => Boolean(userId));

  const [linkedProfilesResult, roleGrantResult, committeeResult] = await Promise.all([
    memberIds.length > 0
      ? flexibleAdmin
          .from("admin_profiles" as string)
          .select("id, user_id, admin_code, linked_member_id, is_active, status")
          .in("linked_member_id", memberIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length > 0
      ? flexibleAdmin
          .from("rbac_user_platform_roles" as string)
          .select("user_id, rbac_platform_roles!inner(code, scope)")
          .eq("scope", "admin")
          .is("revoked_at", null)
          .in("user_id", userIds)
      : Promise.resolve({ data: [], error: null }),
    memberIds.length > 0
      ? flexibleAdmin
          .from("committee_assignments" as string)
          .select("member_id")
          .eq("status", "active")
          .in("member_id", memberIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (
    linkedProfilesResult.error ||
    roleGrantResult.error ||
    committeeResult.error
  ) {
    if (process.env.NODE_ENV !== "development") {
      console.error("Admin invite member search context failed", {
        committeeError: committeeResult.error,
        linkedProfileError: linkedProfilesResult.error,
        roleGrantError: roleGrantResult.error,
      });
    }
    return [];
  }

  const linkedAdminProfileByMemberId = new Map(
    ((linkedProfilesResult.data || []) as LinkedAdminProfileRow[])
      .filter((profile) => Boolean(profile.linked_member_id))
      .map((profile) => [profile.linked_member_id as string, profile] as const),
  );
  const activeAdminUserIds = new Set(
    ((roleGrantResult.data || []) as Array<{ user_id?: null | string }>)
      .map((grant) => grant.user_id)
      .filter((userId): userId is string => Boolean(userId)),
  );
  const executiveMemberIds = new Set(
    ((committeeResult.data || []) as CommitteeAssignmentRow[])
      .map((assignment) => assignment.member_id)
      .filter((memberId): memberId is string => Boolean(memberId)),
  );

  return members.map((row) =>
    mapMemberCandidate({
      activeAdminUserIds,
      executiveMemberIds,
      linkedAdminProfileByMemberId,
      row,
    }),
  );
}
async function loadAdminInvitations(options: {
  actorRole: AdminAccountRoleCode | null;
  actorUserId: string;
  admin: ReturnType<typeof createAdminClient>;
  hasManageAdminRoles: boolean;
}) {
  const allowedInviteRoles = resolveAllowedInviteRoles({
    actorRole: options.actorRole,
    hasManageAdminRoles: options.hasManageAdminRoles,
  });

  if (allowedInviteRoles.length === 0) {
    return [];
  }

  const result = await asFlexibleClient(options.admin)
    .from("admin_invitations" as string)
    .select(
      "id, email, target_user_id, target_admin_profile_id, invited_role_code, status, invited_by_user_id, accepted_at, revoked_at, expires_at, delivery_status, last_sent_at, send_attempts, note",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (result.error) {
    logOptionalAdminInvitationLoadError(result.error);
    return [];
  }

  const invitations = ((result.data || []) as AdminInvitationRow[])
    .map(mapInvitation)
    .filter((invitation): invitation is AdminAccountInvitation => Boolean(invitation));

  if (options.actorRole === "super_admin") {
    return invitations;
  }

  return invitations.filter(
    (invitation) =>
      invitation.invitedRoleCode === "content_admin" ||
      invitation.invitedByUserId === options.actorUserId ||
      invitation.targetUserId === options.actorUserId,
  );
}

export async function loadAdminProfileDirectory(options: {
  actorAdminRole: AdminAccountRoleCode | null;
  actorUserId: string;
  canManageAdminRoles: boolean;
  filters: AdminProfileFilters;
}): Promise<AdminProfileDirectoryData> {
  const admin = createAdminClient();
  const flexibleAdmin = asFlexibleClient(admin);

  const { data: profileRows, error: profileError } = await flexibleAdmin
    .from("admin_profiles" as string)
    .select("*")
    .order("updated_at", { ascending: false });

  if (profileError) {
    throw profileError;
  }

  const rows = (profileRows || []) as AdminProfileRow[];
  const userIds = Array.from(
    new Set(rows.map((profile) => profile.user_id).filter(Boolean)),
  );
  const linkedMemberIds = Array.from(
    new Set(
      rows
        .map((profile) => profile.linked_member_id)
        .filter(Boolean) as string[],
    ),
  );

  const [roleResult, memberResult] = await Promise.all([
    userIds.length > 0
      ? flexibleAdmin
          .from("rbac_user_platform_roles" as string)
          .select("user_id, rbac_platform_roles(code, display_name)")
          .eq("scope", "admin")
          .is("revoked_at", null)
          .in("user_id", userIds)
      : Promise.resolve({ data: [], error: null }),
    linkedMemberIds.length > 0
      ? flexibleAdmin
          .from("members" as string)
          .select("id, full_name, jnuits_id, member_type, email")
          .in("id", linkedMemberIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (roleResult.error) {
    throw roleResult.error;
  }

  if (memberResult.error) {
    throw memberResult.error;
  }

  const rolesByUserId = new Map<string, Map<string, AdminProfileRole>>();
  for (const grant of (roleResult.data || []) as RoleGrantRow[]) {
    for (const role of resolveRoleRelations(grant.rbac_platform_roles)) {
      const normalizedRole = toAdminProfileRole(role.code, role.display_name);
      if (!normalizedRole) {
        continue;
      }
      addRole(rolesByUserId, grant.user_id, normalizedRole);
    }
  }

  const membersById = new Map(
    ((memberResult.data || []) as MemberRow[]).map(
      (member) => [member.id, member] as const,
    ),
  );

  const allProfiles = rows.map<AdminProfileDirectoryProfile>((profile) => {
    const roles = sortRoles(
      Array.from(rolesByUserId.get(profile.user_id)?.values() || []),
    );
    const primaryRole = roles[0] || null;
    const isSuperAdmin = roles.some((role) => role.code === "super_admin");
    const lifecycle = toAdminLifecycleStatus(profile.status, profile.is_active);
    const capabilities = resolveAdminAccountCapabilities({
      actorRole: options.actorAdminRole,
      actorUserId: options.actorUserId,
      hasManageAdminRoles: options.canManageAdminRoles,
      targetLifecycleStatus: lifecycle.status,
      targetRole: primaryRole?.code || null,
      targetUserId: profile.user_id,
    });

    return {
      adminCode: profile.admin_code,
      avatarSecureUrl: profile.avatar_secure_url,
      canEdit: capabilities.canEditProfile,
      capabilities,
      createdAt: profile.created_at,
      displayName: profile.display_name,
      email: profile.email,
      id: profile.id,
      isActive: profile.is_active,
      isSuperAdmin,
      lifecycleLabel: lifecycle.label,
      lifecycleStatus: lifecycle.status,
      linkedMember: toLinkedMember(
        profile.linked_member_id
          ? membersById.get(profile.linked_member_id)
          : undefined,
      ),
      linkedMemberId: profile.linked_member_id,
      primaryRole,
      roles,
      statusReason: profile.status_reason || null,
      statusUpdatedAt: profile.status_updated_at || null,
      statusUpdatedByUserId: profile.status_updated_by_user_id || null,
      title: profile.title,
      updatedAt: profile.updated_at,
      userId: profile.user_id,
    };
  });

  const profiles = allProfiles.filter((profile) =>
    canActorSeeTarget({
      actorRole: options.actorAdminRole,
      actorUserId: options.actorUserId,
      targetRole: profile.primaryRole?.code || null,
      targetUserId: profile.userId,
    }),
  );
  const filteredProfiles = filterAdminProfiles(profiles, options.filters);
  const actorProfile =
    profiles.find((profile) => profile.userId === options.actorUserId) || null;
  const requestedProfileId =
    options.filters.profile === "me"
      ? actorProfile?.id || ""
      : options.filters.profile;
  const selectedProfile =
    filteredProfiles.find((profile) => profile.id === requestedProfileId) ||
    (options.filters.tab === "self" ? actorProfile : null) ||
    filteredProfiles[0] ||
    null;

  return {
    actorInviteRoles: resolveAllowedInviteRoles({
      actorRole: options.actorAdminRole,
      hasManageAdminRoles: options.canManageAdminRoles,
    }),
    actorProfile,
    activities: await loadSelectedProfileActivities(admin, selectedProfile),
    filteredProfiles,
    invitationMemberCandidates: await loadAdminInviteMemberCandidates({
      actorRole: options.actorAdminRole,
      admin,
      filters: options.filters,
      hasManageAdminRoles: options.canManageAdminRoles,
    }),
    invitations: await loadAdminInvitations({
      actorRole: options.actorAdminRole,
      actorUserId: options.actorUserId,
      admin,
      hasManageAdminRoles: options.canManageAdminRoles,
    }),
    profiles,
    roleOptions: buildRoleOptions(profiles),
    selectedProfile,
    stats: buildAdminProfileStats(profiles),
  };
}
