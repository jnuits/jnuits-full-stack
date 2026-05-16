import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAuthContext, hasOperatorRole } from "@/lib/auth/session";
import { searchSliderCloudinaryFolder } from "@/lib/cloudinary/slider";
import { withApiGuard } from "@/lib/security/with-api-guard";

const querySchema = z.object({
  q: z.string().trim().max(80).optional().default(""),
});

async function handleGet(request: NextRequest) {
  const auth = await getAuthContext();

  if (!auth.user) {
    return NextResponse.json(
      { message: "Sign in before searching Cloudinary." },
      { status: 401 }
    );
  }

  if (!hasOperatorRole(auth.roles)) {
    return NextResponse.json(
      { message: "Only operators can search Cloudinary assets." },
      { status: 403 }
    );
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
    console.error("[admin/cloudinary-search] Cloudinary search failed", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Cloudinary search failed.",
      },
      { status: 500 }
    );
  }
}

export const GET = withApiGuard(handleGet);
