import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase() || "";

  if (!email) {
    return NextResponse.json({ message: "Email is required." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("membership_applications")
    .select("status, updated_at")
    .eq("email", email)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) {
    return NextResponse.json(
      { message: "Unable to check membership application status right now." },
      { status: 500 }
    );
  }

  const application = data?.[0];

  if (!application) {
    return NextResponse.json(
      { found: false, status: null, updatedAt: null },
      { status: 200 }
    );
  }

  return NextResponse.json(
    {
      found: true,
      status: application.status,
      updatedAt: application.updated_at,
    },
    { status: 200 }
  );
}
