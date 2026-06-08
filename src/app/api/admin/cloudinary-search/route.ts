import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApiPermission } from "@/lib/admin/api-auth";
import { searchSliderCloudinaryFolder } from "@/lib/cloudinary/slider";
import { apiError } from "@/lib/errors/api-error";
import { withApiGuard } from "@/lib/security/with-api-guard";

const querySchema = z.object({
  q: z.string().trim().max(80).optional().default(""),
});

async function handleGet(request: NextRequest) {
  const permission = await requireAdminApiPermission("cms.media.manage", {
    forbiddenMessage: "Only media managers can search Cloudinary assets.",
    unauthenticatedMessage: "Sign in before searching Cloudinary.",
  });

  if (permission.response) {
    return permission.response;
  }

  const parsed = querySchema.safeParse({
    q: request.nextUrl.searchParams.get("q") || "",
  });

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Provide a valid Cloudinary search query." },
      { status: 400 }
    );
  }

  try {
    const results = await searchSliderCloudinaryFolder(parsed.data.q);

    return NextResponse.json(results);
  } catch (error) {
    return apiError(error, {
      context: "admin.cloudinarySearch",
      fallback: "Cloudinary search failed. Please try again.",
    });
  }
}

export const GET = withApiGuard(handleGet);
