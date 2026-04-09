import { NextRequest, NextResponse } from "next/server";
import { getPublicMemberDirectory } from "@/lib/members/directory";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const directory = await getPublicMemberDirectory({
      type: request.nextUrl.searchParams.get("type") || undefined,
      search: request.nextUrl.searchParams.get("search") || undefined,
      letter: request.nextUrl.searchParams.get("letter") || undefined,
      page: request.nextUrl.searchParams.get("page") || undefined,
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
