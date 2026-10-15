import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { z } from "zod";
import { isDirectoryVerifiedForUser } from "@/lib/auth/directory-verification";
import type {
  MemberLifecycleStatus,
  PortalAccessStatus,
  PortalAccessState,
} from "@/lib/auth/session";
import { requirePortalIdentity } from "@/lib/auth/session";
import { resolveMembershipAccessMode } from "@/lib/membership/lifecycle";
import type { Tables } from "@/lib/db/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";

type MemberRecord = Omit<Tables<"members">, "verification_code_hash"> & {
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

const membershipStateSchema = z.object({
  memberId: z.string().uuid(), fullName: z.string(), jnuitsId: z.string().nullable(), avatarSecureUrl: z.string().nullable(),
  joinedOn: z.string().nullable(), renewalDueOn: z.string().nullable(), graceEndsOn: z.string().nullable(),
  renewalState: z.enum(["paid", "grace", "former", "unknown", "not_applicable"]),
  lifecycleStatus: z.enum(["current", "former", "alumni", "deleted"]).nullable(),
  memberType: z.enum(["current", "alumni"]).nullable(),
  portalAccessStatus: z.enum(["active", "frozen", "suspended", "deactivated", "deletion_requested"]).nullable(),
  currentMembershipPathStatus: z.string().nullable(), revision: z.number().int().nonnegative(),
  currentCaseId: z.string().uuid().nullable(), appealId: z.string().uuid().nullable(), closedOn: z.string().nullable(),
  closureReason: z.enum(["voluntary_departure", "departure_appeal_rejected", "alumni_conversion"]).nullable(),
});
export type PortalMembershipState = z.infer<typeof membershipStateSchema>;
export type PortalMembershipRequest = {
  id: string; request_type: string; status: string; requested_at: string;
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
  const result = await admin
    .from("members")
    .select("id, user_id, jnuits_id, full_name, member_type, email, phone, batch_no, department_code, current_organization, designation, work_location, workplace_applicability, facebook_url, linkedin_url, website_url, professional_visibility, is_profile_claimed, student_id, graduation_year, lifecycle_status, portal_access_status, avatar_public_id, avatar_secure_url, departments(name)")
    .eq("user_id", userId)
    .maybeSingle();
  if (result.error) throw new Error("Member profile could not be loaded.");
  if (!result.data) return null;
  // Even an unexpected database response must never serialize a credential hash.
  const { verification_code_hash: omitted, ...member } = result.data as unknown as Tables<"members">;
  void omitted;
  return member as MemberRecord;
}

function resolvePortalAccess(member: PortalMembershipState | null): PortalAccessState {
  if (!member) {
    return {
      lifecycleStatus: null,
      memberId: null,
      memberType: null,
      currentMembershipPathStatus: null,
      portalAccessStatus: null,
    };
  }

  return {
    lifecycleStatus: member.lifecycleStatus,
    memberId: member.memberId,
    memberType: member.memberType,
    currentMembershipPathStatus: member.currentMembershipPathStatus,
    portalAccessStatus: member.portalAccessStatus,
  };
}

export const getPortalMemberSnapshot = cache(async (userId: string) => {
  const auth = await requirePortalIdentity();
  if (auth.user?.id !== userId) throw new Error("You can only load your own member profile.");
  const admin = createAdminClient();
  const flexibleAdmin = asFlexibleClient(admin);
  const identity = await admin.from("members").select("id").eq("user_id", userId).maybeSingle();
  if (identity.error) throw new Error("Member profile could not be loaded.");
  let membership: PortalMembershipState | null = null;
  if (identity.data) {
    // requirePortalIdentity reconciles this owned member before resolving access.
    // PostgreSQL also owns the grace-end date and display state; TS only projects them.
    const result = await flexibleAdmin.rpc("get_member_membership_state", { p_member_id: identity.data.id });
    const parsed = membershipStateSchema.safeParse(result.data);
    if (result.error || !parsed.success || parsed.data.memberId !== identity.data.id) {
      throw new Error("Membership status could not be verified. Please try again later.");
    }
    membership = parsed.data;
  }
  const access = resolvePortalAccess(membership);
  const mode = resolveMembershipAccessMode({ ...access, currentMembershipPathStatus: access.currentMembershipPathStatus ?? null });
  const base = {
      access: { ...access, mode, canMutate: mode === "mutable", isRestricted: mode !== "mutable" },
      accountRequests: [] as WorkplaceRequestRecord[],
      member: null as MemberRecord | null,
      membership,
      membershipRequests: [] as PortalMembershipRequest[],
      departmentName: null,
      directoryVerified: false,
      profileChangeRequests: [] as WorkplaceRequestRecord[],
      settings: null as PortalUserSettingsRecord | null,
      timeline: [] as TimelineRecord[],
      workplaceRequests: [] as WorkplaceRequestRecord[],
  };
  if (mode === "blocked" || !membership) return { ...base, membership: null };
  if (mode === "restricted") {
    const result = await admin.from("profile_update_requests")
      .select("id, request_type, status, requested_at")
      .eq("member_id", membership.memberId)
      .in("request_type", ["membership_renewal", "membership_departure", "membership_departure_appeal", "alumni_conversion"])
      .order("requested_at", { ascending: false }).limit(20);
    if (result.error) throw new Error("Membership requests could not be loaded.");
    return { ...base, membershipRequests: (result.data || []) as PortalMembershipRequest[] };
  }
  const cookieStore = await cookies();
  const typedMember = await loadPortalMemberRecord(admin, userId);
  if (!typedMember) throw new Error("Member profile could not be loaded.");

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

  return {
    ...base,
    membershipRequests: requests.filter((request) => ["membership_renewal", "membership_departure", "membership_departure_appeal", "alumni_conversion"].includes(request.request_type))
      .map(({ id, request_type, status, requested_at }) => ({ id, request_type, status, requested_at })),
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
});
