import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";

export type PortalAdvisorSnapshot = {
  advisor: {
    advisorType: string;
    avatarSecureUrl: null | string;
    bio: null | string;
    department: null | string;
    designation: null | string;
    email: null | string;
    facebookUrl: null | string;
    fullName: string;
    id: string;
    isCurrent: boolean;
    isPublic: boolean;
    joinedOn: null | string;
    leftOn: null | string;
    linkedinUrl: null | string;
    phone: null | string;
    publications: string[];
    speech: null | string;
    title: null | string;
    websiteUrl: null | string;
    workExperience: string[];
  } | null;
};

type AdvisorRecord = {
  advisor_type?: null | string;
  avatar_secure_url?: null | string;
  bio?: null | string;
  department?: null | string;
  designation?: null | string;
  email?: null | string;
  facebook_url?: null | string;
  full_name?: null | string;
  id?: null | string;
  is_current?: null | boolean;
  is_public?: null | boolean;
  joined_on?: null | string;
  left_on?: null | string;
  linkedin_url?: null | string;
  phone?: null | string;
  publications?: unknown;
  speech?: null | string;
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
      "id, advisor_type, full_name, title, department, designation, email, phone, avatar_secure_url, speech, bio, work_experience, publications, facebook_url, linkedin_url, website_url, joined_on, left_on, is_current, is_public"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data || typeof data !== "object") {
    return { advisor: null };
  }

  const advisor = data as AdvisorRecord;

  return {
    advisor: {
      advisorType: advisor.advisor_type || "honorable_advisor",
      avatarSecureUrl: advisor.avatar_secure_url || null,
      bio: advisor.bio || null,
      department: advisor.department || null,
      designation: advisor.designation || null,
      email: advisor.email || null,
      facebookUrl: advisor.facebook_url || null,
      fullName: advisor.full_name || "Advisor",
      id: advisor.id || "",
      isCurrent: advisor.is_current ?? true,
      isPublic: advisor.is_public ?? true,
      joinedOn: advisor.joined_on || null,
      leftOn: advisor.left_on || null,
      linkedinUrl: advisor.linkedin_url || null,
      phone: advisor.phone || null,
      publications: asStringList(advisor.publications),
      speech: advisor.speech || null,
      title: advisor.title || null,
      websiteUrl: advisor.website_url || null,
      workExperience: asStringList(advisor.work_experience),
    },
  };
}
