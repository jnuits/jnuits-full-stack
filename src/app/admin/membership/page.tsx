import { cookies } from "next/headers";
import { loadCurrentPublicCommitteeTitles } from "@/lib/committee/current-titles.server";
import { requireAdminPagePermission as requireAdminPermission } from "@/lib/admin/activity/page-access";

import {
  MembershipDbClient,
  type AccountRequestClientRecord,
  type DepartmentOptionClientRecord,
  type InvitationBatchClientRecord,
  type ManagedMemberClientRecord,
  type PortalRoleOptionClientRecord,
} from "@/components/admin/membership-db-client";
import { ADMIN_FLASH_COOKIE_NAME, parseAdminFlash } from "@/lib/admin/flash";
import { formatMembershipIdForDisplay } from "@/lib/members/jnuits-id";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";
import { loadMembershipRenewalQueue } from "@/lib/membership/admin-renewal-queue";
import { z } from "zod";


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

function parseMemberPageSize(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw || "", 10);
  return [15, 20, 50].includes(parsed) ? parsed : 20;
}

function parseFilter(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() || "";
}

export default async function AdminMembershipPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPermission("admin.membership.manage", { fallbackPath: "/admin/dashboard" });
  const admin = createAdminClient();
  const flexibleAdmin = asFlexibleClient(admin);
  const cookieStore = await cookies();
  const flash = parseAdminFlash(cookieStore.get(ADMIN_FLASH_COOKIE_NAME)?.value);
  const resolvedSearchParams = await searchParams;
  const renewalQueue = await loadMembershipRenewalQueue(resolvedSearchParams);
  const selectedMemberId = z.uuid().safeParse(parseFilter(resolvedSearchParams.memberId));
  const memberPage = parsePositiveInt(resolvedSearchParams.memberPage, 1, 10_000);
  const memberPageSize = parseMemberPageSize(resolvedSearchParams.memberPageSize);
  const memberLifecycleFilter = parseFilter(resolvedSearchParams.memberLifecycle);
  const memberRoleFilter = parseFilter(resolvedSearchParams.memberRole);
  const memberRangeFrom = (memberPage - 1) * memberPageSize;
  const memberRangeTo = memberRangeFrom + memberPageSize - 1;

  const [
    batchesResult,
    accountRequestsResult,
    portalRolesResult,
    departmentsResult,
  ] = await Promise.all([
    admin
      .from("invitation_batches")
      .select(
        "id, cycle_id, label, source, status, issued_count, claimed_count, expires_at, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(20),
    flexibleAdmin
      .from("profile_update_requests" as string)
      .select(
        "id, member_id, request_type, status, requested_at, review_note, members!profile_update_requests_member_id_fkey(full_name, jnuits_id)"
      )
      .eq("request_type", "account_deletion")
      .eq("status", "pending")
      .order("requested_at", { ascending: true })
      .limit(30),
    flexibleAdmin
      .from("rbac_platform_roles" as string)
      .select("code, display_name")
      .eq("scope", "portal")
      .eq("is_assignable", true)
      .order("rank", { ascending: true }),
    flexibleAdmin
      .from("departments" as string)
      .select("code, name, short_code")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  const portalRoleOptions = (portalRolesResult.data || []) as PortalRoleOptionClientRecord[];
  const validPortalRoleCodes = new Set(portalRoleOptions.map((role) => role.code));
  const normalizedRoleFilter = validPortalRoleCodes.has(
    memberRoleFilter as PortalRoleOptionClientRecord["code"]
  )
    ? memberRoleFilter
    : "";

  let roleFilteredUserIds: string[] | null = null;
  if (normalizedRoleFilter) {
    const { data: grants } = await flexibleAdmin
      .from("rbac_user_platform_roles" as string)
      .select("user_id, rbac_platform_roles!inner(code)")
      .eq("scope", "portal")
      .is("revoked_at", null)
      .eq("rbac_platform_roles.code", normalizedRoleFilter);

    roleFilteredUserIds = Array.from(
      new Set(
        ((grants || []) as { user_id?: string | null }[])
          .map((grant) => grant.user_id)
          .filter((value): value is string => Boolean(value))
      )
    );
  }

  let managedMembersResult: {
    count: number | null;
    data: unknown[] | null;
  };

  if (roleFilteredUserIds && roleFilteredUserIds.length === 0) {
    managedMembersResult = { count: 0, data: [] };
  } else {
    let managedMembersQuery = flexibleAdmin
      .from("members" as string)
      .select(
        "id, user_id, jnuits_id, full_name, email, member_type, is_profile_claimed, lifecycle_status, portal_access_status, avatar_secure_url, department_code, batch_no, joined_on, phone, student_id, facebook_url, linkedin_url, website_url, updated_at",
        { count: "exact" }
      )
      .not("jnuits_id", "ilike", "JNUITS-ADMIN-%");

    if (memberLifecycleFilter === "current") {
      managedMembersQuery = managedMembersQuery.or("lifecycle_status.eq.current,lifecycle_status.is.null");
    } else if (memberLifecycleFilter) {
      managedMembersQuery = managedMembersQuery.eq("lifecycle_status", memberLifecycleFilter);
    }

    if (roleFilteredUserIds) {
      managedMembersQuery = managedMembersQuery.in("user_id", roleFilteredUserIds);
    }

    if (selectedMemberId.success) managedMembersQuery = managedMembersQuery.eq("id", selectedMemberId.data);

    managedMembersResult = await managedMembersQuery
      .order("updated_at", { ascending: false })
      .range(memberRangeFrom, memberRangeTo);
  }

  const batches = (batchesResult.data || []) as InvitationBatchClientRecord[];
  const rawManagedMembers = (managedMembersResult.data || []) as Omit<
    ManagedMemberClientRecord,
    "currentPortalRole" | "displayJnuitsId"
  >[];
  const rawAccountRequests = (accountRequestsResult.data || []) as AccountRequestRecord[];
  const departmentOptions: DepartmentOptionClientRecord[] = (
    (departmentsResult.data || []) as Array<{
      code: string;
      name: string;
      short_code: string;
    }>
  ).map((department) => ({
    internalCode: department.code,
    name: department.name,
    shortCode: department.short_code,
  }));
  const memberUserIds = rawManagedMembers
    .map((member) => member.user_id)
    .filter((value): value is string => Boolean(value));

  const [activePortalRoleGrantsResult] = await Promise.all([
    memberUserIds.length > 0
      ? flexibleAdmin
          .from("rbac_user_platform_roles" as string)
          .select("user_id, rbac_platform_roles(code, display_name)")
          .eq("scope", "portal")
          .is("revoked_at", null)
          .in("user_id", memberUserIds)
      : Promise.resolve({ data: [] }),
  ]);

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

  const currentTitles = await loadCurrentPublicCommitteeTitles(rawManagedMembers.map((member) => member.id));
  const managedMembers: ManagedMemberClientRecord[] = rawManagedMembers.map((member) => ({
    ...member,
    currentCommitteeTitles: currentTitles.get(member.id) || [],
    currentPortalRole: member.user_id
      ? activePortalRoleByUserId.get(member.user_id) || "member"
      : "member",
    displayJnuitsId: displayMembershipId(member.jnuits_id),
  }));


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
      batches={batches}
      departmentOptions={departmentOptions}
      flash={flash}
      managedMemberTotal={managedMembersResult.count || managedMembers.length}
      managedMembers={managedMembers}
      memberLifecycleFilter={memberLifecycleFilter}
      memberPage={memberPage}
      memberPageSize={memberPageSize}
      memberRoleFilter={normalizedRoleFilter}
      portalRoleOptions={portalRoleOptions}
      renewalQueue={renewalQueue}
      totalClaimedInvitations={totalClaimedInvitations}
      totalIssuedInvitations={totalIssuedInvitations}
    />
  );
}
