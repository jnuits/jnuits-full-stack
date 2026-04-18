import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthContext, hasOperatorRole } from "@/lib/auth/session";
import { upsertCloudinaryMediaAsset } from "@/lib/content/media-assets";
import type { Json } from "@/lib/db/types";
import { withApiGuard } from "@/lib/security/with-api-guard";
import { createAdminClient } from "@/lib/supabase/admin";

const mediaAssetSchema = z.object({
  altText: z.string().trim().max(300).optional(),
  bytes: z.number().int().nonnegative().nullable().optional(),
  durationSeconds: z.number().nonnegative().nullable().optional(),
  format: z.string().trim().max(20).nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  isPublic: z.boolean(),
  mediaKind: z.enum(["image", "video"]),
  metadata: z.record(z.string(), z.unknown()).optional(),
  publicId: z.string().trim().min(1),
  resourceType: z.string().trim().min(1),
  secureUrl: z.string().trim().url(),
  thumbnailUrl: z.string().trim().url().nullable().optional(),
  title: z.string().trim().max(160).optional(),
  width: z.number().int().positive().nullable().optional(),
});

async function handlePost(request: NextRequest) {
  const auth = await getAuthContext();

  if (!auth.user) {
    return NextResponse.json(
      { message: "Sign in before registering media assets." },
      { status: 401 }
    );
  }

  if (!hasOperatorRole(auth.roles)) {
    return NextResponse.json(
      { message: "Only operators can register media assets." },
      { status: 403 }
    );
  }

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
    revalidatePath("/gallery");

    return NextResponse.json(
      {
        data: {
          id: result.id,
        },
        message: "Cloudinary media uploaded and registered successfully.",
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "The Cloudinary asset could not be registered.",
      },
      { status: 500 }
    );
  }
}

export const POST = withApiGuard(handlePost);
