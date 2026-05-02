"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requirePortalUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

const advisorProfileUpdateSchema = z.object({
  bio: z.string().trim().max(5000).optional().default(""),
  facebookUrl: z.string().trim().url().or(z.literal("")).optional().default(""),
  linkedinUrl: z.string().trim().url().or(z.literal("")).optional().default(""),
  publications: z.string().trim().max(6000).optional().default(""),
  speech: z.string().trim().max(5000).optional().default(""),
  websiteUrl: z.string().trim().url().or(z.literal("")).optional().default(""),
  workExperience: z.string().trim().max(6000).optional().default(""),
});

function pickFormFields(formData: FormData, fields: string[]) {
  return Object.fromEntries(
    fields.map((field) => [field, asString(formData.get(field))])
  );
}

function listToJson(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function updateAdvisorProfileAction(formData: FormData) {
  const auth = await requirePortalUser({ fallbackPath: "/portal/advisor/profile" });

  if (!auth.user) {
    redirect("/portal/login");
  }

  const parsed = advisorProfileUpdateSchema.safeParse(
    pickFormFields(formData, [
      "bio",
      "facebookUrl",
      "linkedinUrl",
      "publications",
      "speech",
      "websiteUrl",
      "workExperience",
    ])
  );

  if (!parsed.success) {
    redirect("/portal/advisor/profile?error=invalid-profile");
  }

  const admin = createAdminClient();
  const flexibleAdmin = asFlexibleClient(admin);
  const { data: advisor } = await flexibleAdmin
    .from("advisor_profiles" as string)
    .select("id")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  const advisorId =
    advisor && typeof advisor === "object" && typeof (advisor as Record<string, unknown>).id === "string"
      ? String((advisor as Record<string, unknown>).id)
      : "";

  if (!advisorId) {
    redirect("/portal/advisor/profile?error=advisor-required");
  }

  const {
    bio,
    facebookUrl,
    linkedinUrl,
    publications,
    speech,
    websiteUrl,
    workExperience,
  } = parsed.data;

  const { error } = await flexibleAdmin
    .from("advisor_profiles" as string)
    .update({
      bio: bio || null,
      facebook_url: facebookUrl || null,
      linkedin_url: linkedinUrl || null,
      publications: listToJson(publications),
      speech: speech || null,
      updated_at: new Date().toISOString(),
      website_url: websiteUrl || null,
      work_experience: listToJson(workExperience),
    })
    .eq("id", advisorId)
    .eq("user_id", auth.user.id);

  if (error) {
    redirect("/portal/advisor/profile?error=save-failed");
  }

  await flexibleAdmin.from("audit_events" as string).insert({
    action: "advisor.profile_updated_self",
    actor_user_id: auth.user.id,
    entity_id: advisorId,
    entity_type: "advisor_profile",
    metadata: {},
  });

  revalidatePath("/portal/advisor/profile");
  revalidatePath("/committee");
  redirect("/portal/advisor/profile?message=profile-saved");
}
