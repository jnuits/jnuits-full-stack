import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CLOUDINARY_PROJECT_ROOT_FOLDER } from "@/lib/branding";
import {
  createCloudinarySignature,
  getCloudinaryConfig,
  normalizeCloudinaryFolder,
} from "@/lib/cloudinary/config";
import { requireAdminApiPermission } from "@/lib/admin/api-auth";
import { apiError } from "@/lib/errors/api-error";
import { withApiGuard } from "@/lib/security/with-api-guard";

const requestSchema = z.object({
  folder: z.string().trim().max(180).optional(),
  resourceType: z.enum(["auto", "image", "video"]).optional(),
});

async function handlePost(request: NextRequest) {
  const permission = await requireAdminApiPermission("cms.media.manage", {
    forbiddenMessage: "Only media managers can sign Cloudinary uploads.",
    unauthenticatedMessage: "Sign in before generating an upload signature.",
  });

  if (permission.response) {
    return permission.response;
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Provide a valid Cloudinary upload request." },
      { status: 400 }
    );
  }

  try {
    const config = getCloudinaryConfig();
    const folder = normalizeCloudinaryFolder(
      parsed.data.folder || CLOUDINARY_PROJECT_ROOT_FOLDER
    );
    const timestamp = Math.floor(Date.now() / 1000);
    const paramsToSign = {
      folder,
      timestamp,
      upload_preset: config.uploadPreset || undefined,
      use_filename: true,
      unique_filename: true,
    };
    const signature = createCloudinarySignature(paramsToSign, config.apiSecret);

    return NextResponse.json(
      {
        apiKey: config.apiKey,
        cloudName: config.cloudName,
        folder,
        resourceType: parsed.data.resourceType || "auto",
        signature,
        timestamp,
        uploadPreset: config.uploadPreset,
        uploadUrl: `https://api.cloudinary.com/v1_1/${config.cloudName}/${parsed.data.resourceType || "auto"}/upload`,
      },
      { status: 200 }
    );
  } catch (error) {
    return apiError(error, {
      context: "admin.cloudinarySign",
      fallback: "Cloudinary is not fully configured.",
    });
  }
}

export const POST = withApiGuard(handlePost);
