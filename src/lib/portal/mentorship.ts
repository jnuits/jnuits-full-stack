import "server-only";

import { hasPermission } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";
import { createClient } from "@/lib/supabase/server";
import { getPortalMemberSnapshot } from "@/lib/portal/member";

type MentorshipProfileRecord = {
  availability_status: "limited" | "open" | "paused";
  bio: string;
  interests: string[];
  member_id: string;
  opt_in: boolean;
  updated_at: string;
  user_id: string;
};

type MentorshipRelationshipRecord = {
  alumni_user_id: string;
  closed_at: null | string;
  created_at: string;
  created_by_user_id: string;
  id: string;
  member_user_id: string;
  status: "active" | "closed" | "declined" | "requested";
};

type MentorshipMessageRecord = {
  author_user_id: string;
  body_markdown: string;
  created_at: string;
  id: string;
  relationship_id: string;
};

type MemberReference = {
  current_organization?: null | string;
  designation?: null | string;
  full_name: null | string;
  id: string;
  jnuits_id: null | string;
  member_type: null | string;
  user_id: null | string;
};

type EnrichedMentor = MentorshipProfileRecord & {
  member: MemberReference | null;
};

type EnrichedRelationship = MentorshipRelationshipRecord & {
  alumniMember: MemberReference | null;
  memberRecord: MemberReference | null;
  messages: MentorshipMessageRecord[];
};

function buildMemberMaps(rows: MemberReference[] | null | undefined) {
  const byId = new Map<string, MemberReference>();
  const byUserId = new Map<string, MemberReference>();

  for (const row of rows || []) {
    byId.set(row.id, row);
    if (typeof row.user_id === "string" && row.user_id.length > 0) {
      byUserId.set(row.user_id, row);
    }
  }

  return { byId, byUserId };
}

export async function getPortalMentorshipWorkspace(userId: string) {
  const [
    snapshot,
    canRequest,
    canParticipate,
    canModerate,
    canManageAllSupport,
  ] = await Promise.all([
    getPortalMemberSnapshot(userId),
    hasPermission("portal.mentorship.request"),
    hasPermission("portal.mentorship.participate"),
    hasPermission("portal.community.moderate"),
    hasPermission("admin.support.manage"),
  ]);
  const supabase = asFlexibleClient(await createClient());
  const [profileResult, relationshipResult, mentorResult] = await Promise.all([
    supabase
      .from("mentorship_profiles")
      .select("user_id, member_id, availability_status, bio, interests, opt_in, updated_at")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("mentorship_relationships")
      .select(
        "id, member_user_id, alumni_user_id, status, created_by_user_id, created_at, closed_at"
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("mentorship_profiles")
      .select("user_id, member_id, availability_status, bio, interests, opt_in, updated_at")
      .eq("opt_in", true)
      .neq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(24),
  ]);

  if (profileResult.error) {
    throw new Error(profileResult.error.message);
  }

  if (relationshipResult.error) {
    throw new Error(relationshipResult.error.message);
  }

  if (mentorResult.error) {
    throw new Error(mentorResult.error.message);
  }

  const selfProfile = (profileResult.data as MentorshipProfileRecord | null) ?? null;
  const relationships = (relationshipResult.data || []) as MentorshipRelationshipRecord[];
  const mentorProfiles = (mentorResult.data || []) as MentorshipProfileRecord[];
  const relationshipIds = relationships.map((relationship) => relationship.id);
  const messageResult = relationshipIds.length
    ? await supabase
        .from("mentorship_messages")
        .select("id, relationship_id, author_user_id, body_markdown, created_at")
        .in("relationship_id", relationshipIds)
        .order("created_at", { ascending: true })
    : { data: [], error: null };

  if (messageResult.error) {
    throw new Error(messageResult.error.message);
  }

  const relationshipMessages = (messageResult.data || []) as MentorshipMessageRecord[];
  const relevantUserIds = Array.from(
    new Set(
      relationships
        .flatMap((relationship) => [
          relationship.member_user_id,
          relationship.alumni_user_id,
          relationship.created_by_user_id,
        ])
        .concat(mentorProfiles.map((profile) => profile.user_id))
        .filter((value): value is string => typeof value === "string" && value.length > 0)
    )
  );

  const admin = createAdminClient();
  const { data: memberRows, error: memberError } = relevantUserIds.length
    ? await admin
        .from("members")
        .select(
          "id, user_id, full_name, jnuits_id, member_type, current_organization, designation"
        )
        .in("user_id", relevantUserIds)
    : { data: [], error: null };

  if (memberError) {
    throw new Error(memberError.message);
  }

  const memberMaps = buildMemberMaps((memberRows || []) as MemberReference[]);
  const messagesByRelationship = new Map<string, MentorshipMessageRecord[]>();

  for (const message of relationshipMessages) {
    const bucket = messagesByRelationship.get(message.relationship_id) || [];
    bucket.push(message);
    messagesByRelationship.set(message.relationship_id, bucket);
  }

  const mentors: EnrichedMentor[] = mentorProfiles
    .map((profile) => ({
      ...profile,
      member:
        memberMaps.byId.get(profile.member_id) ||
        memberMaps.byUserId.get(profile.user_id) ||
        null,
    }))
    .filter(
      (profile) =>
        Boolean(profile.member) &&
        (profile.member?.member_type === "alumni" || canModerate || canManageAllSupport)
    );

  const enrichedRelationships: EnrichedRelationship[] = relationships.map(
    (relationship) => ({
      ...relationship,
      alumniMember: memberMaps.byUserId.get(relationship.alumni_user_id) || null,
      memberRecord: memberMaps.byUserId.get(relationship.member_user_id) || null,
      messages: messagesByRelationship.get(relationship.id) || [],
    })
  );

  return {
    canManageAllSupport,
    canModerate,
    canParticipate,
    canRequest,
    member: snapshot.member,
    mentors,
    relationships: enrichedRelationships,
    selfProfile,
  };
}
