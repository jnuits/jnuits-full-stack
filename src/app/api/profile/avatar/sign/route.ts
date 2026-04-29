import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createCloudinarySignature, getCloudinaryConfig } from "@/lib/cloudinary/config";
import {
  authorizeAvatarTarget,
  PROFILE_AVATAR_UPLOAD_PRESET,
} from "@/lib/profile/avatar-access";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { withApiGuard } from "@/lib/security/with-api-guard";

const requestSchema = z.object({
  targetId: z.string().trim().uuid("Provide a valid profile identifier."),
  targetType: z.enum(["admin_profile", "member"]),
});

async function handlePost(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message || "Invalid avatar request." },
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

  try {
    const config = getCloudinaryConfig();
    const timestamp = Math.floor(Date.now() / 1000);
    const paramsToSign = {
      invalidate: true,
      overwrite: true,
      public_id: authorization.target.publicId,
      timestamp,
      upload_preset: PROFILE_AVATAR_UPLOAD_PRESET,
    };
    const signature = createCloudinarySignature(paramsToSign, config.apiSecret);

    return NextResponse.json(
      {
        apiKey: config.apiKey,
        cloudName: config.cloudName,
        invalidate: true,
        overwrite: true,
        publicId: authorization.target.publicId,
        signature,
        timestamp,
        uploadPreset: PROFILE_AVATAR_UPLOAD_PRESET,
        uploadUrl: `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Cloudinary is not fully configured.",
      },
      { status: 500 }
    );
  }
}

export const POST = withApiGuard(handlePost, {
  rateLimit: RATE_LIMITS.profileDirect,
  requireAuth: true,
});
