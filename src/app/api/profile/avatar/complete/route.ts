import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isCloudinaryAssetUrl } from "@/lib/cloudinary/config";
import {
  authorizeAvatarTarget,
  PROFILE_AVATAR_MAX_BYTES,
  PROFILE_AVATAR_STORED_DIMENSION,
} from "@/lib/profile/avatar-access";
import { recordSecurityEvent } from "@/lib/security/security-events";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { withApiGuard } from "@/lib/security/with-api-guard";
import { asFlexibleClient } from "@/lib/supabase/flexible";

const completeSchema = z.object({
  bytes: z.number().int().min(0).max(PROFILE_AVATAR_MAX_BYTES),
  format: z.string().trim().min(1).max(24).regex(/^[a-z0-9]+$/i),
  height: z.number().int().positive(),
  publicId: z.string().trim().min(1).max(300),
  secureUrl: z.string().trim().url().max(600),
  targetId: z.string().trim().uuid("Provide a valid profile identifier."),
  targetType: z.enum(["admin_profile", "member"]),
  width: z.number().int().positive(),
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

  if (!isCloudinaryAssetUrl(parsed.data.secureUrl)) {
    return NextResponse.json(
      { message: "Uploaded avatar must use a Cloudinary delivery URL." },
      { status: 400 }
    );
  }

  if (
    parsed.data.width !== PROFILE_AVATAR_STORED_DIMENSION ||
    parsed.data.height !== PROFILE_AVATAR_STORED_DIMENSION
  ) {
    return NextResponse.json(
      { message: "Stored avatar must be exactly 400x400 pixels." },
      { status: 400 }
    );
  }

  const nowIso = new Date().toISOString();
  const updatePayload = {
    avatar_bytes: parsed.data.bytes,
    avatar_format: parsed.data.format.toLowerCase(),
    avatar_height: parsed.data.height,
    avatar_public_id: parsed.data.publicId,
    avatar_secure_url: parsed.data.secureUrl,
    avatar_updated_at: nowIso,
    avatar_updated_by_user_id: authorization.target.actorUserId,
    avatar_width: parsed.data.width,
    updated_at: nowIso,
  };
  const tableName =
    authorization.target.targetType === "member" ? "members" : "admin_profiles";
  const { error } = await asFlexibleClient(authorization.target.admin)
    .from(tableName)
    .update(updatePayload)
    .eq("id", authorization.target.targetId);

  if (error) {
    return NextResponse.json(
      { message: error.message || "Avatar metadata could not be saved." },
      { status: 500 }
    );
  }

  await recordSecurityEvent(authorization.target.admin, {
    actorUserId: authorization.target.actorUserId,
    eventType:
      authorization.target.targetType === "member"
        ? "member.avatar_updated"
        : "admin_profile.avatar_updated",
    payload: {
      bytes: parsed.data.bytes,
      format: parsed.data.format.toLowerCase(),
      publicId: parsed.data.publicId,
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
      secureUrl: parsed.data.secureUrl,
    },
    { status: 200 }
  );
}

export const POST = withApiGuard(handlePost, {
  rateLimit: RATE_LIMITS.profileDirect,
  requireAuth: true,
});
