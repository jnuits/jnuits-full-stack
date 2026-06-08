"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  SafeAdminActionError,
  getSafeAdminActionErrorMessage,
} from "@/lib/admin/action-error";
import { setAdminFlash } from "@/lib/admin/flash";
import { requireAdminPermission } from "@/lib/auth/session";
import {
  moveMediaAssetToCloudinaryTrash,
  restoreMediaAssetFromCloudinaryTrash,
} from "@/lib/content/media-assets";
import { createAdminClient } from "@/lib/supabase/admin";

const mediaLifecycleSchema = z.object({
  assetId: z.string().trim().uuid("Media asset ID is invalid."),
});

function pickFormFields(formData: FormData) {
  return {
    assetId: String(formData.get("assetId") || "").trim(),
  };
}

function safeMediaError(error: unknown, context: string, fallback: string) {
  return getSafeAdminActionErrorMessage(error, {
    context: `content.media.${context}`,
    fallback,
  });
}

async function loadMediaAsset(assetId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("media_assets")
    .select("*")
    .eq("id", assetId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new SafeAdminActionError("Media asset was not found.");
  }

  return { admin, asset: data };
}

async function handleMediaLifecycleAction(
  formData: FormData,
  intent: "restore" | "trash"
) {
  const auth = await requireAdminPermission("cms.media.manage", {
    fallbackPath: "/admin/content/media",
  });
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login");
  }

  const parsed = mediaLifecycleSchema.safeParse(pickFormFields(formData));

  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "Media action failed",
      message: parsed.error.issues[0]?.message || "The media asset identifier is missing.",
    });
    redirect("/admin/content/media");
  }

  try {
    const { admin, asset } = await loadMediaAsset(parsed.data.assetId);

    if (intent === "trash") {
      await moveMediaAssetToCloudinaryTrash(admin, { actorUserId, asset });
      await setAdminFlash({
        tone: "success",
        title: "Media moved to trash",
        message:
          "The Cloudinary asset was moved into the project trash folder and hidden from public use.",
      });
    } else {
      await restoreMediaAssetFromCloudinaryTrash(admin, { actorUserId, asset });
      await setAdminFlash({
        tone: "success",
        title: "Media restored",
        message: "The Cloudinary asset was moved back to its original public ID.",
      });
    }

    revalidatePath("/admin/content/media");
    revalidatePath("/admin/content/gallery");
    revalidatePath("/gallery");
  } catch (error) {
    await setAdminFlash({
      tone: "error",
      title: intent === "trash" ? "Media was not moved" : "Media was not restored",
      message: safeMediaError(
        error,
        intent,
        "The media lifecycle action could not be completed safely."
      ),
    });
  }

  redirect("/admin/content/media");
}

export async function moveMediaAssetToTrashAction(formData: FormData) {
  await handleMediaLifecycleAction(formData, "trash");
}

export async function restoreMediaAssetFromTrashAction(formData: FormData) {
  await handleMediaLifecycleAction(formData, "restore");
}
