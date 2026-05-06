import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { formatAdvisorJnuitsIdForDisplay } from "@/lib/members/jnuits-id";
import { asFlexibleClient } from "@/lib/supabase/flexible";

export type PortalAdvisorSnapshot = {
  advisor: {
    advisorJnuitsId: null | string;
    advisorType: string;
    avatarSecureUrl: null | string;
    bio: null | string;
    dateConfidence: string;
    department: null | string;
    designation: null | string;
    email: null | string;
    facebookUrl: null | string;
    formerTitle: null | string;
    fullName: string;
    id: string;
    isCurrent: boolean;
    isPublic: boolean;
    jnuProfileUrl: null | string;
    joinedOn: null | string;
    leftOn: null | string;
    linkedinUrl: null | string;
    phone: null | string;
    publications: string[];
    speech: null | string;
    statusNote: null | string;
    tenureDisplay: null | string;
    title: null | string;
    websiteUrl: null | string;
    workExperience: string[];
  } | null;
};

type AdvisorRecord = {
  advisor_jnuits_id?: null | string;
  advisor_type?: null | string;
  avatar_secure_url?: null | string;
  bio?: null | string;
  date_confidence?: null | string;
  department?: null | string;
  designation?: null | string;
  email?: null | string;
  facebook_url?: null | string;
  former_title?: null | string;
  full_name?: null | string;
  id?: null | string;
  is_current?: null | boolean;
  is_public?: null | boolean;
  jnu_profile_url?: null | string;
  joined_on?: null | string;
  left_on?: null | string;
  linkedin_url?: null | string;
  phone?: null | string;
  publications?: unknown;
  speech?: null | string;
  status_note?: null | string;
  tenure_display?: null | string;
  title?: null | string;
  website_url?: null | string;
  work_experience?: unknown;
};

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

export async function getPortalAdvisorSnapshot(
  userId: string
): Promise<PortalAdvisorSnapshot> {
  const admin = createAdminClient();
  const { data, error } = await asFlexibleClient(admin)
    .from("advisor_profiles" as string)
    .select(
      "id, advisor_jnuits_id, advisor_type, full_name, title, former_title, department, designation, email, phone, avatar_secure_url, speech, bio, work_experience, publications, facebook_url, linkedin_url, website_url, jnu_profile_url, joined_on, left_on, tenure_display, date_confidence, status_note, is_current, is_public"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data || typeof data !== "object") {
    return { advisor: null };
  }

  const advisor = data as AdvisorRecord;

  return {
    advisor: {
      advisorJnuitsId: formatAdvisorJnuitsIdForDisplay(advisor.advisor_jnuits_id) || null,
      advisorType: advisor.advisor_type || "honorable_advisor",
      avatarSecureUrl: advisor.avatar_secure_url || null,
      bio: advisor.bio || null,
      dateConfidence: advisor.date_confidence || "verified",
      department: advisor.department || null,
      designation: advisor.designation || null,
      email: advisor.email || null,
      facebookUrl: advisor.facebook_url || null,
      formerTitle: advisor.former_title || null,
      fullName: advisor.full_name || "Advisor",
      id: advisor.id || "",
      isCurrent: advisor.is_current ?? true,
      isPublic: advisor.is_public ?? true,
      jnuProfileUrl: advisor.jnu_profile_url || null,
      joinedOn: advisor.joined_on || null,
      leftOn: advisor.left_on || null,
      linkedinUrl: advisor.linkedin_url || null,
      phone: advisor.phone || null,
      publications: asStringList(advisor.publications),
      speech: advisor.speech || null,
      statusNote: advisor.status_note || null,
      tenureDisplay: advisor.tenure_display || null,
      title: advisor.title || null,
      websiteUrl: advisor.website_url || null,
      workExperience: asStringList(advisor.work_experience),
    },
  };
}
