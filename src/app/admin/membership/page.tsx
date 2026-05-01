import { cookies } from "next/headers";

import {
  MembershipDbClient,
  type AccountRequestClientRecord,
  type CycleMemberClientRecord,
  type InvitationBatchClientRecord,
  type ManagedMemberClientRecord,
  type MembershipCycleClientRecord,
  type PortalRoleOptionClientRecord,
} from "@/components/admin/membership-db-client";
import { ADMIN_FLASH_COOKIE_NAME, parseAdminFlash } from "@/lib/admin/flash";
import { formatMembershipIdForDisplay } from "@/lib/members/jnuits-id";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";

type CycleMemberRecord = {
  cycle_id: string;
  expires_on: string | null;
  id: string;
  member_id: string;
  note: string | null;
  state: string;
  members?:
    | {
        full_name?: string | null;
        id?: string;
        is_profile_claimed?: boolean | null;
        jnuits_id?: string | null;
      }
    | {
        full_name?: string | null;
        id?: string;
        is_profile_claimed?: boolean | null;
        jnuits_id?: string | null;
      }[]
    | null;
};

type PortalRoleGrantRecord = {
  rbac_platform_roles:
    | { code?: string | null; display_name?: string | null }
    | { code?: string | null; display_name?: string | null }[]
    | null;
  user_id: string;
};

type AccountRequestRecord = {
  id: string;
  member_id: string;
  request_type: string;
  requested_at: string;
  review_note: string | null;
  status: string;
  members?:
    | {
        full_name?: string | null;
        jnuits_id?: string | null;
      }
    | {
        full_name?: string | null;
        jnuits_id?: string | null;
      }[]
    | null;
};

function resolveOne<T>(relation: T | T[] | null | undefined) {
  if (!relation) {
    return null;
  }

  return Array.isArray(relation) ? relation[0] || null : relation;
}

function displayMembershipId(
  value: null | string | undefined,
  fallback = "Unknown ID"
) {
  return formatMembershipIdForDisplay(value) || fallback;
}

function parsePositiveInt(
  value: string | string[] | undefined,
  fallback: number,
  max: number
) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw || "", 10);

  if (!Number.isFinite(parsed) || parsed < fallback) {
    return fallback;
  }

  return Math.min(parsed, max);
}

export default async function AdminMembershipPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = createAdminClient();
  const flexibleAdmin = asFlexibleClient(admin);
  const cookieStore = await cookies();
  const flash = parseAdminFlash(cookieStore.get(ADMIN_FLASH_COOKIE_NAME)?.value);
  const resolvedSearchParams = await searchParams;
  const memberLimit = parsePositiveInt(resolvedSearchParams.memberLimit, 40, 200);

  const [
    cyclesResult,
    cycleMembersResult,
    batchesResult,
    managedMembersResult,
    accountRequestsResult,
  ] = await Promise.all([
    admin
      .from("membership_cycles")
      .select(
        "id, code, title, starts_on, ends_on, renewal_open_on, renewal_close_on, status, created_at"
      )
      .order("starts_on", { ascending: false })
      .limit(20),
    admin
      .from("membership_cycle_memberships")
      .select(
        "id, cycle_id, member_id, state, enrolled_at, renewed_at, expires_on, note, members(id, full_name, jnuits_id, is_profile_claimed)"
      )
      .in("state", ["pending_renewal", "active"])
      .order("updated_at", { ascending: true })
      .limit(60),
    admin
      .from("invitation_batches")
      .select(
        "id, cycle_id, label, source, status, issued_count, claimed_count, expires_at, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(20),
    flexibleAdmin
      .from("members" as string)
      .select(
        "id, user_id, jnuits_id, full_name, email, member_type, is_profile_claimed, lifecycle_status, portal_access_status, avatar_secure_url, updated_at",
        { count: "exact" }
      )
      .not("jnuits_id", "ilike", "JNUITS-ADMIN-%")
      .order("updated_at", { ascending: false })
      .limit(memberLimit),
    flexibleAdmin
      .from("profile_update_requests" as string)
      .select(
        "id, member_id, request_type, status, requested_at, review_note, members(full_name, jnuits_id)"
      )
      .in("request_type", ["alumni_conversion", "account_deletion"])
      .eq("status", "pending")
      .order("requested_at", { ascending: true })
      .limit(30),
  ]);

  const cycles = (cyclesResult.data || []) as MembershipCycleClientRecord[];
  const rawCycleMembers = (cycleMembersResult.data || []) as CycleMemberRecord[];
  const batches = (batchesResult.data || []) as InvitationBatchClientRecord[];
  const rawManagedMembers = (managedMembersResult.data || []) as Omit<
    ManagedMemberClientRecord,
    "currentPortalRole" | "displayJnuitsId"
  >[];
  const rawAccountRequests = (accountRequestsResult.data || []) as AccountRequestRecord[];
  const memberUserIds = rawManagedMembers
    .map((member) => member.user_id)
    .filter((value): value is string => Boolean(value));

  const [portalRolesResult, activePortalRoleGrantsResult] = await Promise.all([
    flexibleAdmin
      .from("rbac_platform_roles" as string)
      .select("code, display_name")
      .eq("scope", "portal")
      .eq("is_assignable", true)
      .order("rank", { ascending: true }),
    memberUserIds.length > 0
      ? flexibleAdmin
          .from("rbac_user_platform_roles" as string)
          .select("user_id, rbac_platform_roles(code, display_name)")
          .eq("scope", "portal")
          .is("revoked_at", null)
          .in("user_id", memberUserIds)
      : Promise.resolve({ data: [] }),
  ]);

  const portalRoleOptions = (portalRolesResult.data || []) as PortalRoleOptionClientRecord[];
  const activePortalRoleByUserId = new Map(
    ((activePortalRoleGrantsResult.data || []) as PortalRoleGrantRecord[])
      .map((grant) => {
        const role = resolveOne(grant.rbac_platform_roles);
        return [grant.user_id, role?.code || null] as const;
      })
      .filter(
        (entry): entry is readonly [
          string,
          ManagedMemberClientRecord["currentPortalRole"],
        ] =>
          entry[1] === "member" ||
          entry[1] === "alumni" ||
          entry[1] === "executive" ||
          entry[1] === "alumni_ambassador"
      )
  );

  const managedMembers: ManagedMemberClientRecord[] = rawManagedMembers.map((member) => ({
    ...member,
    currentPortalRole: member.user_id
      ? activePortalRoleByUserId.get(member.user_id) || "member"
      : "member",
    displayJnuitsId: displayMembershipId(member.jnuits_id),
  }));

  const cycleMembers: CycleMemberClientRecord[] = rawCycleMembers.map((row) => {
    const member = resolveOne(row.members);
    return {
      cycle_id: row.cycle_id,
      displayJnuitsId: displayMembershipId(member?.jnuits_id),
      expires_on: row.expires_on,
      id: row.id,
      isProfileClaimed: Boolean(member?.is_profile_claimed),
      memberName: member?.full_name || "Member record",
      note: row.note,
      state: row.state,
    };
  });

  const accountRequests: AccountRequestClientRecord[] = rawAccountRequests.map((request) => {
    const member = resolveOne(request.members);
    return {
      displayJnuitsId: member?.jnuits_id
        ? displayMembershipId(member.jnuits_id)
        : request.member_id,
      id: request.id,
      member_id: request.member_id,
      memberName: member?.full_name || "Member record",
      requested_at: request.requested_at,
      request_type: request.request_type,
      review_note: request.review_note,
      status: request.status,
    };
  });

  const activeCycle = cycles.find((cycle) => cycle.status === "active") || null;
  const pendingRenewals = cycleMembers.filter(
    (row) => row.state === "pending_renewal"
  ).length;
  const activeMembersInCycles = cycleMembers.filter(
    (row) => row.state === "active"
  ).length;
  const totalIssuedInvitations = batches.reduce(
    (sum, batch) => sum + (batch.issued_count || 0),
    0
  );
  const totalClaimedInvitations = batches.reduce(
    (sum, batch) => sum + (batch.claimed_count || 0),
    0
  );

  return (
    <MembershipDbClient
      accountRequests={accountRequests}
      activeCycle={activeCycle}
      activeMembersInCycles={activeMembersInCycles}
      batches={batches}
      cycles={cycles}
      cycleMembers={cycleMembers}
      flash={flash}
      managedMemberTotal={managedMembersResult.count || managedMembers.length}
      managedMembers={managedMembers}
      memberLimit={memberLimit}
      pendingRenewals={pendingRenewals}
      portalRoleOptions={portalRoleOptions}
      totalClaimedInvitations={totalClaimedInvitations}
      totalIssuedInvitations={totalIssuedInvitations}
    />
  );
}
