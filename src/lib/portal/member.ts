import { cookies } from "next/headers";
import { isDirectoryVerifiedForUser } from "@/lib/auth/directory-verification";
import type { Tables } from "@/lib/db/types";
import { createAdminClient } from "@/lib/supabase/admin";

type MemberRecord = Tables<"members"> & {
  departments?: { name?: string | null } | { name?: string | null }[] | null;
};

type TimelineRecord = Tables<"membership_lifecycle_events">;
type WorkplaceRequestRecord = Tables<"profile_update_requests">;

function resolveDepartmentName(member: MemberRecord | null) {
  if (!member?.departments) {
    return null;
  }

  if (Array.isArray(member.departments)) {
    return member.departments[0]?.name || null;
  }

  return member.departments.name || null;
}

export async function getPortalMemberSnapshot(userId: string) {
  const admin = createAdminClient();
  const cookieStore = await cookies();

  const { data: member } = await admin
    .from("members")
    .select(
      "id, jnuits_id, full_name, member_type, email, phone, batch_no, current_organization, designation, work_location, linkedin_url, website_url, professional_visibility, is_profile_claimed, verification_code_hash, departments(name)"
    )
    .eq("user_id", userId)
    .maybeSingle();

  const typedMember = (member as MemberRecord | null) ?? null;

  if (!typedMember) {
    return {
      member: null,
      departmentName: null,
      directoryVerified: false,
      profileChangeRequests: [] as WorkplaceRequestRecord[],
      timeline: [] as TimelineRecord[],
      workplaceRequests: [] as WorkplaceRequestRecord[],
    };
  }

  const [timelineResult, workplaceRequestResult] = await Promise.all([
    admin
      .from("membership_lifecycle_events")
      .select("id, event_type, occurred_at, summary, metadata, created_at")
      .eq("member_id", typedMember.id)
      .order("occurred_at", { ascending: false })
      .limit(8),
    admin
      .from("profile_update_requests")
      .select(
        "id, member_id, request_type, payload, status, requested_at, review_note, reviewed_at, reviewed_by_user_id, created_at, updated_at"
      )
      .eq("member_id", typedMember.id)
      .order("requested_at", { ascending: false })
      .limit(8),
  ]);

  return {
    member: typedMember,
    departmentName: resolveDepartmentName(typedMember),
    directoryVerified: isDirectoryVerifiedForUser(cookieStore, userId),
    profileChangeRequests: ((workplaceRequestResult.data || []) as WorkplaceRequestRecord[]).filter(
      (request) => request.request_type === "profile_change"
    ),
    timeline: (timelineResult.data || []) as TimelineRecord[],
    workplaceRequests: ((workplaceRequestResult.data || []) as WorkplaceRequestRecord[]).filter(
      (request) => request.request_type === "workplace_update"
    ),
  };
}
