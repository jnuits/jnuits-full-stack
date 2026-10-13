import { requireAdminPermission } from "@/lib/auth/session";
import {
  WorkplaceWorkspaceClient,
  type WorkplaceDirectoryMember,
  type WorkplaceMetrics,
  type WorkplaceRequestRow,
} from "@/components/admin/workplace-workspace-client";
import { formatMembershipIdForDisplay } from "@/lib/members/jnuits-id";
import { parseWorkplaceUpdatePayload } from "@/lib/members/workplace-payload";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";

type SearchParams = Record<string, string | string[] | undefined>;

type WorkplaceRequestRecord = {
  id: string;
  member_id: string;
  payload: unknown;
  requested_at: string;
  review_note: null | string;
  reviewed_at: null | string;
  status: string;
  members?:
    | WorkplaceMemberRecord
    | WorkplaceMemberRecord[]
    | null;
};

type WorkplaceMemberRecord = {
  current_organization?: null | string;
  designation?: null | string;
  email?: null | string;
  facebook_url?: null | string;
  full_name?: null | string;
  id: string;
  jnuits_id?: null | string;
  lifecycle_status?: null | string;
  linkedin_url?: null | string;
  member_type?: null | string;
  portal_access_status?: null | string;
  professional_visibility?: null | string;
  updated_at?: null | string;
  website_url?: null | string;
  work_location?: null | string;
};

function parseString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function parsePositiveInt(
  value: string | string[] | undefined,
  fallback: number,
  max: number
) {
  const parsed = Number.parseInt(parseString(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

function parsePageSize(value: string | string[] | undefined) {
  const parsed = parsePositiveInt(value, 20, 50);
  return [15, 20, 50].includes(parsed) ? parsed : 20;
}

function parseFilter(value: string | string[] | undefined) {
  return parseString(value).trim();
}

function resolveOne<T>(relation: T | T[] | null | undefined) {
  if (!relation) return null;
  return Array.isArray(relation) ? relation[0] || null : relation;
}

function mapRequest(row: WorkplaceRequestRecord): WorkplaceRequestRow {
  const member = resolveOne(row.members);
  const payload = parseWorkplaceUpdatePayload(row.payload);

  return {
    currentOrganization: member?.current_organization || null,
    designation: member?.designation || null,
    displayJnuitsId: formatMembershipIdForDisplay(member?.jnuits_id) || row.member_id,
    email: member?.email || null,
    facebookUrl: member?.facebook_url || null,
    fullName: member?.full_name || "Linked member",
    id: row.id,
    linkedinUrl: member?.linkedin_url || null,
    memberId: row.member_id,
    memberType: member?.member_type || null,
    payload,
    professionalVisibility: member?.professional_visibility || null,
    requestedAt: row.requested_at,
    reviewNote: row.review_note,
    reviewedAt: row.reviewed_at,
    status: row.status,
    websiteUrl: member?.website_url || null,
    workLocation: member?.work_location || null,
  };
}

function mapMember(row: WorkplaceMemberRecord): WorkplaceDirectoryMember {
  return {
    currentOrganization: row.current_organization || null,
    designation: row.designation || null,
    displayJnuitsId: formatMembershipIdForDisplay(row.jnuits_id) || row.id,
    email: row.email || null,
    fullName: row.full_name || "Linked member",
    id: row.id,
    lifecycleStatus: row.lifecycle_status || "current",
    facebookUrl: row.facebook_url || null,
    linkedinUrl: row.linkedin_url || null,
    portalAccessStatus: row.portal_access_status || "active",
    professionalVisibility: row.professional_visibility || "members-only",
    updatedAt: row.updated_at || null,
    websiteUrl: row.website_url || null,
    workLocation: row.work_location || null,
  };
}

export const metadata = { title: "Workplace Requests — Admin | JnUITS" };

export default async function WorkplacePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdminPermission("admin.membership.manage", { fallbackPath: "/admin/dashboard" });
  const admin = createAdminClient();
  const flexibleAdmin = asFlexibleClient(admin);
  const resolvedSearchParams = await searchParams;
  const page = parsePositiveInt(resolvedSearchParams.page, 1, 10_000);
  const pageSize = parsePageSize(resolvedSearchParams.pageSize);
  const statusFilter = parseFilter(resolvedSearchParams.status) || "pending";
  const rangeFrom = (page - 1) * pageSize;
  const rangeTo = rangeFrom + pageSize - 1;
  const recentCutoff = new Date();
  recentCutoff.setDate(recentCutoff.getDate() - 30);
  const staleCutoff = new Date();
  staleCutoff.setFullYear(staleCutoff.getFullYear() - 1);

  let requestsQuery = flexibleAdmin
    .from("profile_update_requests" as string)
    .select(
      "id, member_id, payload, requested_at, reviewed_at, review_note, status, members!profile_update_requests_member_id_fkey(id, full_name, jnuits_id, email, member_type, current_organization, designation, work_location, facebook_url, linkedin_url, website_url, professional_visibility)",
      { count: "exact" }
    )
    .eq("request_type", "workplace_update");

  if (statusFilter) {
    requestsQuery = requestsQuery.eq("status", statusFilter);
  }

  const [
    requestsResult,
    directoryResult,
    historyResult,
    pendingCountResult,
    approvedCountResult,
    rejectedCountResult,
    publicCountResult,
    privateCountResult,
    staleCountResult,
  ] = await Promise.all([
    requestsQuery.order("requested_at", { ascending: false }).range(rangeFrom, rangeTo),
    flexibleAdmin
      .from("members" as string)
      .select(
        "id, full_name, email, jnuits_id, lifecycle_status, portal_access_status, current_organization, designation, work_location, facebook_url, linkedin_url, website_url, professional_visibility, updated_at"
      )
      .order("full_name", { ascending: true })
      .limit(150),
    flexibleAdmin
      .from("profile_update_requests" as string)
      .select(
        "id, member_id, payload, requested_at, reviewed_at, review_note, status, members!profile_update_requests_member_id_fkey(id, full_name, jnuits_id, email, member_type, current_organization, designation, work_location, facebook_url, linkedin_url, website_url, professional_visibility)"
      )
      .eq("request_type", "workplace_update")
      .neq("status", "pending")
      .order("reviewed_at", { ascending: false })
      .limit(30),
    flexibleAdmin
      .from("profile_update_requests" as string)
      .select("id", { count: "exact", head: true })
      .eq("request_type", "workplace_update")
      .eq("status", "pending"),
    flexibleAdmin
      .from("profile_update_requests" as string)
      .select("id", { count: "exact", head: true })
      .eq("request_type", "workplace_update")
      .eq("status", "approved")
      .gte("reviewed_at", recentCutoff.toISOString()),
    flexibleAdmin
      .from("profile_update_requests" as string)
      .select("id", { count: "exact", head: true })
      .eq("request_type", "workplace_update")
      .eq("status", "rejected")
      .gte("reviewed_at", recentCutoff.toISOString()),
    flexibleAdmin
      .from("members" as string)
      .select("id", { count: "exact", head: true })
      .eq("professional_visibility", "public"),
    flexibleAdmin
      .from("members" as string)
      .select("id", { count: "exact", head: true })
      .in("professional_visibility", ["members-only", "private"]),
    flexibleAdmin
      .from("members" as string)
      .select("id", { count: "exact", head: true })
      .not("current_organization", "is", null)
      .lt("updated_at", staleCutoff.toISOString()),
  ]);

  if ([requestsResult, historyResult, directoryResult, pendingCountResult, approvedCountResult, rejectedCountResult, publicCountResult, privateCountResult, staleCountResult].some((result) => result.error)) {
    throw new Error("Workplace requests could not be loaded. Please reload or try again later.");
  }

  const requestRows = (requestsResult.data || []) as WorkplaceRequestRecord[];
  const directoryRows = (directoryResult.data || []) as WorkplaceMemberRecord[];
  const historyRows = (historyResult.data || []) as WorkplaceRequestRecord[];
  const metrics: WorkplaceMetrics = {
    approvedRecent: approvedCountResult.count || 0,
    pending: pendingCountResult.count || 0,
    privateProfiles: privateCountResult.count || 0,
    publicProfiles: publicCountResult.count || 0,
    rejectedRecent: rejectedCountResult.count || 0,
    staleProfiles: staleCountResult.count || 0,
  };

  return (
    <WorkplaceWorkspaceClient
      directoryMembers={directoryRows.map(mapMember)}
      historyRows={historyRows.map(mapRequest)}
      metrics={metrics}
      page={page}
      pageSize={pageSize}
      requests={requestRows.map(mapRequest)}
      totalCount={requestsResult.count || requestRows.length}
    />
  );
}
