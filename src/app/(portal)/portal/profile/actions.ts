"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePortalPermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { asFlexibleClient } from "@/lib/supabase/flexible";

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
    redirect(
      `/portal/profile?error=${encodeURIComponent(
        error.message || "preferences-save"
      )}`
    );
  }

  revalidatePath("/portal/profile");
  redirect("/portal/profile?message=preferences-saved");
}
