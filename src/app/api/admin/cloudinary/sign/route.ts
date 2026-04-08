import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CLOUDINARY_PROJECT_ROOT_FOLDER } from "@/lib/branding";
import {
  createCloudinarySignature,
  getCloudinaryPublicConfig,
  normalizeCloudinaryFolder,
} from "@/lib/cloudinary/config";
import { getAuthContext, hasOperatorRole } from "@/lib/auth/session";

const requestSchema = z.object({
  folder: z.string().trim().max(180).optional(),
  resourceType: z.enum(["auto", "image", "video"]).optional(),
});

export async function POST(request: NextRequest) {
  const auth = await getAuthContext();

  if (!auth.user) {
    return NextResponse.json(
      { message: "Sign in before generating an upload signature." },
      { status: 401 }
    );
  }

  if (!hasOperatorRole(auth.roles)) {
    return NextResponse.json(
      { message: "Only operators can sign Cloudinary uploads." },
      { status: 403 }
    );
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
    const config = getCloudinaryPublicConfig();
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
    const signature = createCloudinarySignature(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET || ""
    );

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
