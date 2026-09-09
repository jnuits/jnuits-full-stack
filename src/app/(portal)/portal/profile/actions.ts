"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePortalPermission, requirePortalUser } from "@/lib/auth/session";
import { recordSecurityEvent } from "@/lib/security/security-events";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { asFlexibleClient } from "@/lib/supabase/flexible";
import { logServerError } from "@/lib/errors/api-error";

const preferencesSchema = z.object({
  notificationEmailOptIn: z
    .enum(["true", "false"])
    .optional()
    .default("false")
    .transform((value) => value === "true"),
  preferredTheme: z.enum(["system", "light", "dark"]).default("system"),
  ticketDigestOptIn: z
    .enum(["true", "false"])
    .optional()
    .default("false")
    .transform((value) => value === "true"),
});

function readCheckbox(formData: FormData, name: string) {
  return formData.get(name) ? "true" : "false";
}

function readOptionalNote(formData: FormData) {
  const value = formData.get("note");
  return typeof value === "string" ? value.trim().slice(0, 1000) : "";
}

async function loadLifecycleActionMember(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await asFlexibleClient(admin)
    .from("members" as string)
    .select("id, user_id, jnuits_id, member_type, lifecycle_status, portal_access_status")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return { admin, member: null as Record<string, unknown> | null };
  }

  return { admin, member: data as Record<string, unknown> };
}

async function hasPendingAccountRequest(
  admin: ReturnType<typeof createAdminClient>,
  memberId: string,
  requestType: "account_deletion" | "alumni_conversion"
) {
  const { data } = await asFlexibleClient(admin)
    .from("profile_update_requests" as string)
    .select("id")
    .eq("member_id", memberId)
    .eq("request_type", requestType)
    .eq("status", "pending")
    .maybeSingle();

  return Boolean(data);
}

export async function savePortalProfilePreferences(formData: FormData) {
  const auth = await requirePortalPermission("portal.profile.manage_self", {
    fallbackPath: "/portal/profile",
  });

  if (!auth.user) {
    redirect("/portal/login?next=%2Fportal%2Fprofile");
  }

  const parsed = preferencesSchema.safeParse({
    notificationEmailOptIn: readCheckbox(formData, "notificationEmailOptIn"),
    preferredTheme:
      typeof formData.get("preferredTheme") === "string"
        ? formData.get("preferredTheme")
        : "system",
    ticketDigestOptIn: readCheckbox(formData, "ticketDigestOptIn"),
  });

  if (!parsed.success) {
    redirect("/portal/profile?error=preferences-invalid");
  }

  const supabase = asFlexibleClient(await createClient());
  const { error } = await supabase.from("portal_user_settings").upsert(
    {
      member_id: auth.user.memberId,
      notification_email_opt_in: parsed.data.notificationEmailOptIn,
      preferred_theme: parsed.data.preferredTheme,
      ticket_digest_opt_in: parsed.data.ticketDigestOptIn,
      user_id: auth.user.id,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    logServerError("portal preferences upsert", error);
    redirect("/portal/profile?error=preferences-save");
  }

  revalidatePath("/portal/profile");
  redirect("/portal/profile?message=preferences-saved");
}

export async function requestAlumniConversionAction(formData: FormData) {
  const auth = await requirePortalUser({ fallbackPath: "/portal" });

  if (!auth.user) {
    redirect("/portal/login?next=%2Fportal");
  }

  const { admin, member } = await loadLifecycleActionMember(auth.user.id);
  const memberId = typeof member?.id === "string" ? member.id : null;
  const lifecycleStatus =
    typeof member?.lifecycle_status === "string"
      ? member.lifecycle_status
      : "current";

  if (!memberId) {
    redirect("/portal?error=member-not-linked");
  }

  if (lifecycleStatus === "alumni") {
    redirect("/portal?message=already-alumni");
  }

  if (
    await hasPendingAccountRequest(admin, memberId, "alumni_conversion")
  ) {
    redirect("/portal?message=alumni-conversion-pending");
  }

  const note = readOptionalNote(formData);
  const { error } = await asFlexibleClient(admin)
    .from("profile_update_requests" as string)
    .insert({
      member_id: memberId,
      payload: {
        note,
        requestedBy: "member",
      },
      request_type: "alumni_conversion",
      status: "pending",
    });

  if (error) {
    logServerError("alumni conversion request insert", error);
    redirect("/portal?error=account-request-failed");
  }

  await recordSecurityEvent(admin, {
    actorUserId: auth.user.id,
    eventType: "member.alumni_conversion_requested",
    payload: { memberId },
    targetUserId: auth.user.id,
  });

  revalidatePath("/portal");
  revalidatePath("/portal/profile");
  redirect("/portal?message=alumni-conversion-requested");
}

export async function requestProfileDeletionAction(formData: FormData) {
  const auth = await requirePortalUser({ fallbackPath: "/portal" });

  if (!auth.user) {
    redirect("/portal/login?next=%2Fportal");
  }

  const { admin, member } = await loadLifecycleActionMember(auth.user.id);
  const memberId = typeof member?.id === "string" ? member.id : null;

  if (!memberId) {
    redirect("/portal?error=member-not-linked");
  }

  if (await hasPendingAccountRequest(admin, memberId, "account_deletion")) {
    redirect("/portal?message=profile-deletion-pending");
  }

  const note = readOptionalNote(formData);
  const { error } = await asFlexibleClient(admin)
    .from("profile_update_requests" as string)
    .insert({
      member_id: memberId,
      payload: {
        note,
        requestedBy: "member",
      },
      request_type: "account_deletion",
      status: "pending",
    });

  if (error) {
    logServerError("profile deletion request insert", error);
    redirect("/portal?error=account-request-failed");
  }

  await recordSecurityEvent(admin, {
    actorUserId: auth.user.id,
    eventType: "member.profile_deletion_requested",
    payload: { memberId },
    severity: "warning",
    targetUserId: auth.user.id,
  });

  revalidatePath("/portal");
  revalidatePath("/portal/profile");
  redirect("/portal?message=profile-deletion-requested");
}
