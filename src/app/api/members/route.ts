import { NextRequest, NextResponse } from "next/server";
import { getPublicMemberDirectory } from "@/lib/members/directory";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { withApiGuard } from "@/lib/security/with-api-guard";

export const dynamic = "force-dynamic";

async function handleGet(request: NextRequest) {
  try {
    const directory = await getPublicMemberDirectory({
      type: request.nextUrl.searchParams.get("type") || undefined,
      search: request.nextUrl.searchParams.get("search") || undefined,
      letter: request.nextUrl.searchParams.get("letter") || undefined,
      department: request.nextUrl.searchParams.get("department") || undefined,
      page: request.nextUrl.searchParams.get("page") || undefined,
      perPage: request.nextUrl.searchParams.get("perPage") || undefined,
      pageSize: request.nextUrl.searchParams.get("pageSize") || undefined,
    });

    return NextResponse.json(directory, { status: 200 });
  } catch {
    return NextResponse.json(
      { message: "Unable to load members directory right now." },
      { status: 500 }
    );
  }
}

export const GET = withApiGuard(handleGet, {
  rateLimit: RATE_LIMITS.publicDirectory,
});
