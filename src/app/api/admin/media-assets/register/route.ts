import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminApiPermission } from "@/lib/admin/api-auth";
import { upsertCloudinaryMediaAsset } from "@/lib/content/media-assets";
import { isCloudinaryAssetUrl } from "@/lib/cloudinary/config";
import type { Json } from "@/lib/db/types";
import { apiError } from "@/lib/errors/api-error";
import { withApiGuard } from "@/lib/security/with-api-guard";
import { createAdminClient } from "@/lib/supabase/admin";

// Registered assets must live on the project's Cloudinary CDN — arbitrary
// hosts would let a media manager point public pages at off-origin content.
const cloudinaryAssetUrl = z.string().trim().url();

const mediaAssetSchema = z
  .object({
    altText: z.string().trim().max(300).optional(),
    bytes: z.number().int().nonnegative().nullable().optional(),
    durationSeconds: z.number().nonnegative().nullable().optional(),
    format: z.string().trim().max(20).nullable().optional(),
    height: z.number().int().positive().nullable().optional(),
    isPublic: z.boolean(),
    mediaKind: z.enum(["image", "video"]),
    metadata: z.record(z.string(), z.unknown()).optional(),
    publicId: z.string().trim().min(1),
    resourceType: z.enum(["image", "video"]),
    secureUrl: cloudinaryAssetUrl,
    thumbnailUrl: cloudinaryAssetUrl.nullable().optional(),
    title: z.string().trim().max(160).optional(),
    width: z.number().int().positive().nullable().optional(),
  })
  .superRefine((data, context) => {
    if (data.mediaKind !== data.resourceType) {
      context.addIssue({
        code: "custom",
        message: "The media kind must match the Cloudinary resource type.",
        path: ["resourceType"],
      });
    }

    for (const [field, value] of [
      ["secureUrl", data.secureUrl],
      ["thumbnailUrl", data.thumbnailUrl],
    ] as const) {
      if (value && !isCloudinaryAssetUrl(value, data.resourceType)) {
        context.addIssue({
          code: "custom",
          message: "Asset URLs must use the configured Cloudinary account and resource type.",
          path: [field],
        });
      }
    }
  });

async function handlePost(request: NextRequest) {
  const permission = await requireAdminApiPermission("cms.media.manage", {
    forbiddenMessage: "Only media managers can register media assets.",
    unauthenticatedMessage: "Sign in before registering media assets.",
  });

  if (permission.response) {
    return permission.response;
  }
  const auth = permission.auth;

  const body = await request.json().catch(() => null);
  const parsed = mediaAssetSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message:
          parsed.error.flatten().formErrors[0] ||
          "Provide a valid Cloudinary asset payload.",
      },
      { status: 400 }
    );
  }

  try {
    const admin = createAdminClient();
    const result = await upsertCloudinaryMediaAsset(admin, {
      actorUserId: auth.user.id,
      input: {
        ...parsed.data,
        metadata: (parsed.data.metadata || {}) as Json,
      },
    });

    revalidatePath("/admin/content");
    revalidatePath("/admin/content/media");

    return NextResponse.json(
      {
        data: {
          altText: result.alt_text,
          id: result.id,
          mediaKind: result.media_kind,
          publicId: result.public_id,
          secureUrl: result.secure_url,
          thumbnailUrl: result.thumbnail_url,
          title: result.title,
        },
        message: "Cloudinary media uploaded and registered successfully.",
      },
      { status: 201 }
    );
  } catch (error) {
    return apiError(error, {
      context: "admin.mediaAssetsRegister",
      fallback: "The Cloudinary asset could not be registered.",
    });
  }
}

export const POST = withApiGuard(handlePost);
