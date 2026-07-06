"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSafeAdminActionErrorMessage } from "@/lib/admin/action-error";
import { requireAdminPermission } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";
import { createClient } from "@/lib/supabase/server";

const notificationSettingsSchema = z.object({
  notificationEmailOptIn: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  ticketDigestOptIn: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

const securitySettingsSchema = z.object({
  adminTotpEnforced: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

function readCheckbox(formData: FormData, name: string) {
  return formData.get(name) ? "true" : "false";
}

export async function saveAdminNotificationSettings(formData: FormData) {
  const auth = await requireAdminPermission("admin.settings.write", {
    fallbackPath: "/admin/settings/notifications",
  });

  if (!auth.user) {
    redirect("/admin/login?next=%2Fadmin%2Fsettings%2Fnotifications");
  }

  const parsed = notificationSettingsSchema.safeParse({
    notificationEmailOptIn: readCheckbox(formData, "notificationEmailOptIn"),
    ticketDigestOptIn: readCheckbox(formData, "ticketDigestOptIn"),
  });

  if (!parsed.success) {
    redirect("/admin/settings/notifications?error=settings-invalid");
  }

  const supabase = asFlexibleClient(await createClient());
  const { error } = await supabase.from("portal_user_settings").upsert(
    {
      member_id: auth.user.memberId,
      notification_email_opt_in: parsed.data.notificationEmailOptIn,
      ticket_digest_opt_in: parsed.data.ticketDigestOptIn,
      user_id: auth.user.id,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    const message = getSafeAdminActionErrorMessage(error, {
      context: "settings.notifications.save",
      fallback: "Notification settings could not be saved.",
    });

    redirect(
      `/admin/settings/notifications?error=${encodeURIComponent(message)}`
    );
  }

  revalidatePath("/admin/settings/notifications");
  redirect("/admin/settings/notifications?message=settings-saved");
}

export async function saveAdminSecuritySettings(formData: FormData) {
  const auth = await requireAdminPermission("admin.security.write", {
    fallbackPath: "/admin/settings/security",
  });

  if (!auth.user) {
    redirect("/admin/login?next=%2Fadmin%2Fsettings%2Fsecurity");
  }

  const parsed = securitySettingsSchema.safeParse({
    adminTotpEnforced: readCheckbox(formData, "adminTotpEnforced"),
  });

  if (!parsed.success) {
    redirect("/admin/settings/security?error=security-settings-invalid");
  }

  if (!parsed.data.adminTotpEnforced && auth.user.adminRole !== "super_admin") {
    redirect("/admin/settings/security?error=super-admin-required");
  }

  const admin = asFlexibleClient(createAdminClient());
  const { error } = await admin
    .from("security_settings" as string)
    .update({
      admin_totp_enforced: parsed.data.adminTotpEnforced,
      updated_by_user_id: auth.user.id,
    })
    .eq("id", true);

  if (error) {
    const message = getSafeAdminActionErrorMessage(error, {
      context: "settings.security.save",
      fallback: "Security settings could not be saved.",
    });

    redirect(
      `/admin/settings/security?error=${encodeURIComponent(message)}`
    );
  }

  revalidatePath("/admin/settings/security");
  redirect("/admin/settings/security?message=security-settings-saved");
}
