import { cookies } from "next/headers";
import { isDirectoryVerifiedForUser } from "@/lib/auth/directory-verification";
import type {
  MemberLifecycleStatus,
  PortalAccessStatus,
  PortalAccessState,
} from "@/lib/auth/session";
import { isMutablePortalAccess } from "@/lib/auth/session";
import type { Tables } from "@/lib/db/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";

type MemberRecord = Tables<"members"> & {
  avatar_public_id?: string | null;
  avatar_secure_url?: string | null;
  graduation_year?: number | null;
  lifecycle_status?: MemberLifecycleStatus | null;
  portal_access_status?: PortalAccessStatus | null;
  departments?: { name?: string | null } | { name?: string | null }[] | null;
  student_id?: string | null;
};

type TimelineRecord = Tables<"membership_lifecycle_events">;
type WorkplaceRequestRecord = Tables<"profile_update_requests">;
type PortalUserSettingsRecord = {
  mentorship_opt_in: boolean;
  notification_email_opt_in: boolean;
  preferred_theme: "dark" | "light" | "system";
  ticket_digest_opt_in: boolean;
  user_id: string;
};

function resolveDepartmentName(member: MemberRecord | null) {
  if (!member?.departments) {
    return null;
  }

  if (Array.isArray(member.departments)) {
    return member.departments[0]?.name || null;
  }

  return member.departments.name || null;
}

async function loadPortalMemberRecord(
  admin: ReturnType<typeof createAdminClient>,
  userId: string
) {
  const extendedSelect =
    "id, jnuits_id, full_name, member_type, email, phone, batch_no, department_code, current_organization, designation, work_location, facebook_url, linkedin_url, website_url, professional_visibility, is_profile_claimed, verification_code_hash, student_id, graduation_year, lifecycle_status, portal_access_status, avatar_public_id, avatar_secure_url, departments(name)";
    "id, jnuits_id, full_name, member_type, email, phone, batch_no, current_organization, designation, work_location, linkedin_url, website_url, professional_visibility, is_profile_claimed, verification_code_hash, student_id, graduation_year, lifecycle_status, portal_access_status, avatar_public_id, avatar_secure_url, departments(name)";
  const baseSelect =
    "id, jnuits_id, full_name, member_type, email, phone, batch_no, department_code, current_organization, designation, work_location, facebook_url, linkedin_url, website_url, professional_visibility, is_profile_claimed, verification_code_hash, departments(name)";

  const extendedResult = await admin
    .from("members")
    .select(extendedSelect)
    .eq("user_id", userId)
    .maybeSingle();

  if (!extendedResult.error) {
    return (extendedResult.data as MemberRecord | null) ?? null;
  }

  const columnMissing =
    extendedResult.error.message.includes("student_id") ||
    extendedResult.error.message.includes("graduation_year") ||
    extendedResult.error.message.includes("lifecycle_status") ||
    extendedResult.error.message.includes("portal_access_status") ||
    extendedResult.error.message.includes("avatar_public_id") ||
    extendedResult.error.message.includes("avatar_secure_url");

  if (!columnMissing) {
    throw extendedResult.error;
  }

  const baseResult = await admin
    .from("members")
    .select(baseSelect)
    .eq("user_id", userId)
    .maybeSingle();

  if (baseResult.error) {
    throw baseResult.error;
  }

  return (baseResult.data as MemberRecord | null) ?? null;
}

function resolvePortalAccess(member: MemberRecord | null): PortalAccessState {
  if (!member) {
    return {
      lifecycleStatus: null,
      memberId: null,
      portalAccessStatus: null,
    };
  }

  return {
    lifecycleStatus: member.lifecycle_status ?? "current",
    memberId: member.id,
    portalAccessStatus: member.portal_access_status ?? "active",
  };
}

export async function getPortalMemberSnapshot(userId: string) {
  const admin = createAdminClient();
  const flexibleAdmin = asFlexibleClient(admin);
  const cookieStore = await cookies();

  const typedMember = await loadPortalMemberRecord(admin, userId);

  if (!typedMember) {
    const access = resolvePortalAccess(null);

    return {
      access: {
        ...access,
        canMutate: false,
        isRestricted: true,
      },
      accountRequests: [] as WorkplaceRequestRecord[],
      member: null,
      departmentName: null,
      directoryVerified: false,
      profileChangeRequests: [] as WorkplaceRequestRecord[],
      settings: null as PortalUserSettingsRecord | null,
      timeline: [] as TimelineRecord[],
      workplaceRequests: [] as WorkplaceRequestRecord[],
    };
  }

  const [timelineResult, workplaceRequestResult, settingsResult] = await Promise.all([
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
    flexibleAdmin
      .from("portal_user_settings")
      .select("user_id, notification_email_opt_in, ticket_digest_opt_in, preferred_theme, mentorship_opt_in")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  const requests = (workplaceRequestResult.data || []) as WorkplaceRequestRecord[];
  const access = resolvePortalAccess(typedMember);

  return {
    access: {
      ...access,
      canMutate: isMutablePortalAccess(access),
      isRestricted: !isMutablePortalAccess(access),
    },
    accountRequests: requests.filter(
      (request) =>
        request.request_type === "alumni_conversion" ||
        request.request_type === "account_deletion"
    ),
    member: typedMember,
    departmentName: resolveDepartmentName(typedMember),
    directoryVerified: isDirectoryVerifiedForUser(cookieStore, userId),
    profileChangeRequests: requests.filter(
      (request) =>
        request.request_type === "profile_change" ||
        request.request_type === "email_change" ||
        request.request_type === "jnuits_id_change"
    ),
    settings: (settingsResult.data as PortalUserSettingsRecord | null) ?? null,
    timeline: (timelineResult.data || []) as TimelineRecord[],
    workplaceRequests: requests.filter(
      (request) => request.request_type === "workplace_update"
    ),
  };
}
