import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isCloudinaryAssetUrl } from "@/lib/cloudinary/config";
import { getCloudinaryImageResource } from "@/lib/cloudinary/admin";
import {
  authorizeAvatarTarget,
  PROFILE_AVATAR_ALLOWED_FORMATS,
  PROFILE_AVATAR_MAX_BYTES,
  PROFILE_AVATAR_STORED_DIMENSION,
} from "@/lib/profile/avatar-access";
import { recordSecurityEvent } from "@/lib/security/security-events";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { withApiGuard } from "@/lib/security/with-api-guard";
import { apiError } from "@/lib/errors/api-error";
import { asFlexibleClient } from "@/lib/supabase/flexible";

const completeSchema = z.object({
  publicId: z.string().trim().min(1).max(300),
  targetId: z.string().trim().uuid("Provide a valid profile identifier."),
  targetType: z.enum(["admin_profile", "member"]),
});

async function handlePost(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = completeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message || "Invalid avatar metadata." },
      { status: 400 }
    );
  }

  const authorization = await authorizeAvatarTarget(
    parsed.data.targetType,
    parsed.data.targetId
  );

  if (!authorization.ok) {
    return NextResponse.json(
      { message: authorization.message },
      { status: authorization.status }
    );
  }

  if (parsed.data.publicId !== authorization.target.publicId) {
    return NextResponse.json(
      { message: "Uploaded avatar public ID does not match the signed target." },
      { status: 400 }
    );
  }

  let resource;

  try {
    resource = await getCloudinaryImageResource(parsed.data.publicId);
  } catch (error) {
    return apiError(error, {
      context: "avatar/complete cloudinary metadata",
      fallback: "The uploaded avatar could not be verified. Please try again.",
    });
  }

  if (
    resource.publicId !== authorization.target.publicId ||
    resource.resourceType !== "image" ||
    resource.type !== "upload" ||
    !PROFILE_AVATAR_ALLOWED_FORMATS.includes(
      resource.format as (typeof PROFILE_AVATAR_ALLOWED_FORMATS)[number]
    ) ||
    resource.bytes <= 0 ||
    resource.bytes > PROFILE_AVATAR_MAX_BYTES ||
    !isCloudinaryAssetUrl(resource.secureUrl)
  ) {
    return NextResponse.json(
      { message: "Uploaded avatar metadata did not match the signed image policy." },
      { status: 400 }
    );
  }

  if (
    resource.width !== PROFILE_AVATAR_STORED_DIMENSION ||
    resource.height !== PROFILE_AVATAR_STORED_DIMENSION
  ) {
    return NextResponse.json(
      { message: "Stored avatar must be exactly 400x400 pixels." },
      { status: 400 }
    );
  }

  const nowIso = new Date().toISOString();
  const updatePayload = {
    avatar_bytes: resource.bytes,
    avatar_format: resource.format,
    avatar_height: resource.height,
    avatar_public_id: resource.publicId,
    avatar_secure_url: resource.secureUrl,
    avatar_updated_at: nowIso,
    avatar_updated_by_user_id: authorization.target.actorUserId,
    avatar_width: resource.width,
    updated_at: nowIso,
  };
  const tableName =
    authorization.target.targetType === "member" ? "members" : "admin_profiles";
  const { error } = await asFlexibleClient(authorization.target.admin)
    .from(tableName)
    .update(updatePayload)
    .eq("id", authorization.target.targetId);

  if (error) {
    return apiError(error, {
      context: "avatar/complete metadata save",
      fallback: "Avatar metadata could not be saved.",
    });
  }

  await recordSecurityEvent(authorization.target.admin, {
    actorUserId: authorization.target.actorUserId,
    eventType:
      authorization.target.targetType === "member"
        ? "member.avatar_updated"
        : "admin_profile.avatar_updated",
    payload: {
      bytes: resource.bytes,
      format: resource.format,
      publicId: resource.publicId,
      targetId: authorization.target.targetId,
      targetType: authorization.target.targetType,
    },
    targetUserId: authorization.target.targetUserId,
  });

  revalidatePath("/members");
  revalidatePath("/portal/profile");
  revalidatePath("/portal/profile/edit");

  return NextResponse.json(
    {
      message: "Profile photo updated.",
      secureUrl: resource.secureUrl,
    },
    { status: 200 }
  );
}

export const POST = withApiGuard(handlePost, {
  rateLimit: RATE_LIMITS.profileDirect,
  requireAuth: true,
});
