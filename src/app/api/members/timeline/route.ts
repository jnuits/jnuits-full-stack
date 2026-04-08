import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: claimsResult } = await supabase.auth.getClaims();
  const claims = claimsResult?.claims as Record<string, unknown> | undefined;

  const userId = typeof claims?.sub === "string" ? claims.sub : null;

  if (!userId) {
    return NextResponse.json(
      { message: "Sign in before requesting the member timeline." },
      { status: 401 }
    );
  }

  const limit = Math.min(
    Number.parseInt(request.nextUrl.searchParams.get("limit") || "25", 10) || 25,
    100
  );
  const eventType = request.nextUrl.searchParams.get("eventType")?.trim() || "";

  const admin = createAdminClient();
  const { data: member, error: memberError } = await admin
    .from("members")
    .select("id, jnuits_id, full_name, member_type")
    .eq("user_id", userId)
    .maybeSingle();

  if (memberError || !member) {
    return NextResponse.json(
      { message: "No linked member profile exists for this account." },
      { status: 404 }
    );
  }

  let query = admin
    .from("membership_lifecycle_events")
    .select("id, event_type, occurred_at, summary, metadata, created_at")
    .eq("member_id", member.id)
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (eventType) {
    query = query.eq("event_type", eventType);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { message: "Unable to load timeline data right now." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      data: data || [],
      meta: {
        member: {
          id: member.id,
          jnuitsId: member.jnuits_id,
          fullName: member.full_name,
          memberType: member.member_type,
        },
        filters: {
          eventType: eventType || null,
          limit,
        },
      },
    },
    { status: 200 }
  );
}
