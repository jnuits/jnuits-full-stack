"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { setAdminFlash } from "@/lib/admin/flash";
import { requireAdminPermission } from "@/lib/auth/session";
import { recordSecurityEvent } from "@/lib/security/security-events";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";

const adminProfileUpdateSchema = z.object({
  adminProfileId: z.string().trim().min(1, "Missing admin profile identifier."),
  displayName: z.string().trim().min(1, "Display name is required.").max(160),
  isActive: z.enum(["true", "false"]).transform((value) => value === "true"),
  title: z.string().trim().max(120).optional().default(""),
});

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function pickFormFields(formData: FormData, fields: string[]) {
  return Object.fromEntries(
    fields.map((field) => [field, asString(formData.get(field))])
  );
}

async function isTargetSuperAdmin(
  admin: ReturnType<typeof createAdminClient>,
  userId: string
) {
  const { data } = await asFlexibleClient(admin).rpc(
    "is_super_admin_user" as string,
    { target_user_id: userId }
  );

  return data === true;
}

export async function updateAdminProfileAction(formData: FormData) {
  const auth = await requireAdminPermission("admin.admin_profiles.manage", {
    fallbackPath: "/admin/admin-profiles",
  });
  const actorUserId = auth.user?.id;
  const actorIsSuperAdmin = auth.user?.adminRole === "super_admin";

  if (!actorUserId) {
    redirect("/admin/login?next=%2Fadmin%2Fadmin-profiles");
  }

  const parsed = adminProfileUpdateSchema.safeParse(
    pickFormFields(formData, ["adminProfileId", "displayName", "title", "isActive"])
  );

  if (!parsed.success) {
    await setAdminFlash(
      {
        tone: "error",
        title: "Admin profile update failed",
        message: parsed.error.issues[0]?.message || "Invalid admin profile update.",
      },
      "/admin"
    );
    redirect("/admin/admin-profiles");
  }

  const admin = createAdminClient();
  const flexibleAdmin = asFlexibleClient(admin);
  const { data: profile, error: profileError } = await flexibleAdmin
    .from("admin_profiles" as string)
    .select("id, user_id, admin_code")
    .eq("id", parsed.data.adminProfileId)
    .maybeSingle();

  if (profileError || !profile) {
    await setAdminFlash(
      {
        tone: "error",
        title: "Admin profile update failed",
        message: profileError?.message || "Admin profile was not found.",
      },
      "/admin"
    );
    redirect("/admin/admin-profiles");
  }

  if (!actorIsSuperAdmin && (await isTargetSuperAdmin(admin, profile.user_id))) {
    await setAdminFlash(
      {
        tone: "error",
        title: "Admin profile update blocked",
        message: "Only super admins can manage super admin profiles.",
      },
      "/admin"
    );
    redirect("/admin/admin-profiles");
  }

  const { error } = await flexibleAdmin
    .from("admin_profiles" as string)
    .update({
      display_name: parsed.data.displayName,
      is_active: parsed.data.isActive,
      title: parsed.data.title || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profile.id);

  if (error) {
    await setAdminFlash(
      {
        tone: "error",
        title: "Admin profile update failed",
        message: error.message,
      },
      "/admin"
    );
    redirect("/admin/admin-profiles");
  }

  await admin.from("audit_events").insert({
    action: "admin_profile.updated",
    actor_user_id: actorUserId,
    entity_id: profile.id,
    entity_type: "admin_profile",
    metadata: {
      adminCode: profile.admin_code,
      isActive: parsed.data.isActive,
    },
  });

  await recordSecurityEvent(admin, {
    actorUserId,
    eventType: "admin_profile.updated",
    payload: {
      adminProfileId: profile.id,
      isActive: parsed.data.isActive,
    },
    targetUserId: profile.user_id,
  });

  revalidatePath("/admin/admin-profiles");
  await setAdminFlash(
    {
      tone: "success",
      title: "Admin profile updated",
      message: "Admin profile metadata was updated.",
    },
    "/admin"
  );
  redirect("/admin/admin-profiles");
}
