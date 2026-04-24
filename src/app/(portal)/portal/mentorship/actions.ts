"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  hasPermission,
  requirePortalPermission,
  requirePortalUser,
} from "@/lib/auth/session";
import { asFlexibleClient } from "@/lib/supabase/flexible";
import { createClient } from "@/lib/supabase/server";

const mentorshipProfileSchema = z.object({
  availabilityStatus: z.enum(["open", "limited", "paused"]).default("open"),
  bio: z.string().trim().max(2000).default(""),
  interests: z.string().trim().max(500).default(""),
  optIn: z.enum(["true", "false"]).default("false"),
});

const mentorshipRequestSchema = z.object({
  alumniUserId: z.string().trim().uuid("Mentor reference is invalid."),
});

const mentorshipStatusSchema = z.object({
  relationshipId: z.string().trim().uuid("Relationship reference is invalid."),
  status: z.enum(["active", "declined", "closed"]).default("active"),
});

const mentorshipMessageSchema = z.object({
  body: z.string().trim().min(2, "Add a message before sending.").max(4000),
  relationshipId: z.string().trim().uuid("Relationship reference is invalid."),
});

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

async function loadMentorshipActorContext() {
  const auth = await requirePortalUser({ fallbackPath: "/portal/mentorship" });
  const supabase = asFlexibleClient(await createClient());
  const [currentMemberTypeResult, canModerate, canParticipate, canManageAll] =
    await Promise.all([
      supabase.rpc("current_member_type"),
      hasPermission("portal.community.moderate"),
      hasPermission("portal.mentorship.participate"),
      hasPermission("admin.support.manage"),
    ]);

  return {
    auth,
    canManageAll,
    canModerate,
    canParticipate,
    currentMemberType:
      typeof currentMemberTypeResult.data === "string"
        ? currentMemberTypeResult.data
        : null,
    supabase,
  };
}

export async function saveMentorshipProfile(formData: FormData) {
  await requirePortalPermission(
    [
      "portal.mentorship.request",
      "portal.mentorship.participate",
      "portal.community.moderate",
      "admin.support.manage",
    ],
    { fallbackPath: "/portal/mentorship" }
  );

  const parsed = mentorshipProfileSchema.safeParse({
    availabilityStatus: asString(formData.get("availabilityStatus")) || "open",
    bio: asString(formData.get("bio")),
    interests: asString(formData.get("interests")),
    optIn: formData.get("optIn") ? "true" : "false",
  });

  if (!parsed.success) {
    redirect(
      `/portal/mentorship?error=${encodeURIComponent(
        parsed.error.issues[0]?.message || "mentorship-profile-invalid"
      )}`
    );
  }

  const { auth, canManageAll, canModerate, canParticipate, currentMemberType, supabase } =
    await loadMentorshipActorContext();

  if (!auth.user?.memberId) {
    redirect("/portal/mentorship?error=linked-member-required");
  }

  const canAdvertiseAsMentor =
    currentMemberType === "alumni" || canModerate || canManageAll || canParticipate;
  const interests = parsed.data.interests
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 12);
  const { error } = await supabase.from("mentorship_profiles").upsert(
    {
      availability_status: parsed.data.availabilityStatus,
      bio: parsed.data.bio,
      interests,
      member_id: auth.user.memberId,
      opt_in: canAdvertiseAsMentor && parsed.data.optIn === "true",
      user_id: auth.user.id,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    redirect(
      `/portal/mentorship?error=${encodeURIComponent(
        error.message || "mentorship-profile"
      )}`
    );
  }

  revalidatePath("/portal/mentorship");
  redirect("/portal/mentorship?message=mentorship-profile-saved");
}

export async function requestMentorshipRelationship(formData: FormData) {
  await requirePortalPermission(
    [
      "portal.mentorship.request",
      "portal.mentorship.participate",
      "portal.community.moderate",
      "admin.support.manage",
    ],
    { fallbackPath: "/portal/mentorship" }
  );

  const parsed = mentorshipRequestSchema.safeParse({
    alumniUserId: asString(formData.get("alumniUserId")),
  });

  if (!parsed.success) {
    redirect(
      `/portal/mentorship?error=${encodeURIComponent(
        parsed.error.issues[0]?.message || "mentorship-request-invalid"
      )}`
    );
  }

  const { auth, canManageAll, canModerate, currentMemberType, supabase } =
    await loadMentorshipActorContext();

  if (!auth.user) {
    redirect("/portal/login?next=%2Fportal%2Fmentorship");
  }

  if (!auth.user.memberId) {
    redirect("/portal/mentorship?error=linked-member-required");
  }

  if (currentMemberType === "alumni" && !canModerate && !canManageAll) {
    redirect("/portal/mentorship?error=alumni-cannot-request");
  }

  const { error } = await supabase.from("mentorship_relationships").insert({
    alumni_user_id: parsed.data.alumniUserId,
    created_by_user_id: auth.user.id,
    member_user_id: auth.user.id,
  });

  if (error) {
    redirect(
      `/portal/mentorship?error=${encodeURIComponent(
        error.message || "mentorship-request"
      )}`
    );
  }

  revalidatePath("/portal/mentorship");
  redirect("/portal/mentorship?message=mentorship-requested");
}

export async function updateMentorshipRelationship(formData: FormData) {
  await requirePortalPermission(
    [
      "portal.mentorship.participate",
      "portal.community.moderate",
      "admin.support.manage",
    ],
    { fallbackPath: "/portal/mentorship" }
  );

  const parsed = mentorshipStatusSchema.safeParse({
    relationshipId: asString(formData.get("relationshipId")),
    status: asString(formData.get("status")) || "active",
  });

  if (!parsed.success) {
    redirect(
      `/portal/mentorship?error=${encodeURIComponent(
        parsed.error.issues[0]?.message || "mentorship-status-invalid"
      )}`
    );
  }

  const { supabase } = await loadMentorshipActorContext();
  const status = parsed.data.status;
  const { error } = await supabase
    .from("mentorship_relationships")
    .update({
      closed_at: status === "closed" ? new Date().toISOString() : null,
      status,
    })
    .eq("id", parsed.data.relationshipId);

  if (error) {
    redirect(
      `/portal/mentorship?error=${encodeURIComponent(
        error.message || "mentorship-status"
      )}`
    );
  }

  revalidatePath("/portal/mentorship");
  redirect("/portal/mentorship?message=mentorship-status-updated");
}

export async function postMentorshipMessage(formData: FormData) {
  const auth = await requirePortalUser({ fallbackPath: "/portal/mentorship" });

  if (!auth.user) {
    redirect("/portal/login?next=%2Fportal%2Fmentorship");
  }

  const parsed = mentorshipMessageSchema.safeParse({
    body: asString(formData.get("body")),
    relationshipId: asString(formData.get("relationshipId")),
  });

  if (!parsed.success) {
    redirect(
      `/portal/mentorship?error=${encodeURIComponent(
        parsed.error.issues[0]?.message || "mentorship-message-invalid"
      )}`
    );
  }

  const supabase = asFlexibleClient(await createClient());
  const { error } = await supabase.from("mentorship_messages").insert({
    author_user_id: auth.user.id,
    body_markdown: parsed.data.body,
    relationship_id: parsed.data.relationshipId,
  });

  if (error) {
    redirect(
      `/portal/mentorship?error=${encodeURIComponent(
        error.message || "mentorship-message"
      )}`
    );
  }

  revalidatePath("/portal/mentorship");
  redirect("/portal/mentorship?message=mentorship-message-sent");
}
