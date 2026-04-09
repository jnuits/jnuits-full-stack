import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const profileChangeSchema = z
  .object({
    fullName: z.string().trim().max(160).optional(),
    phone: z.string().trim().max(40).optional(),
    linkedinUrl: z.string().trim().url().optional().or(z.literal("")),
    websiteUrl: z.string().trim().url().optional().or(z.literal("")),
  })
  .refine((value) => Object.values(value).some(Boolean), {
    message: "Provide at least one profile field to change.",
  });

async function requireLinkedMemberUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as Record<string, unknown> | undefined;

  const userId = typeof claims?.sub === "string" ? claims.sub : null;

  if (!userId) {
    return {
      admin: null,
      error: NextResponse.json(
        { message: "Sign in with your claimed member account." },
        { status: 401 }
      ),
      member: null,
      userId: null,
    };
  }

  const admin = createAdminClient();
  const { data: member, error } = await admin
    .from("members")
    .select("id, jnuits_id, full_name, member_type")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !member) {
    return {
      admin: null,
      error: NextResponse.json(
        { message: "No linked member profile exists for this account." },
        { status: 404 }
      ),
      member: null,
      userId: null,
    };
  }

  return {
    admin,
    error: null,
    member,
    userId,
  };
}

export async function GET() {
  const viewer = await requireLinkedMemberUser();

  if (viewer.error || !viewer.member || !viewer.admin) {
    return viewer.error;
  }

  const { data, error } = await viewer.admin
    .from("profile_update_requests")
    .select("id, request_type, payload, status, requested_at, reviewed_at, review_note, reviewed_by_user_id")
    .eq("member_id", viewer.member.id)
    .eq("request_type", "profile_change")
    .order("requested_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json(
      { message: "Unable to retrieve profile change requests." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      data: data || [],
      meta: {
        member: viewer.member,
      },
    },
    { status: 200 }
  );
}

export async function POST(request: NextRequest) {
  const viewer = await requireLinkedMemberUser();

  if (viewer.error || !viewer.member || !viewer.admin) {
    return viewer.error;
  }

  const payload = await request.json().catch(() => null);
  const parsed = profileChangeSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message:
          parsed.error.flatten().formErrors[0] ||
          "Provide at least one valid profile field.",
      },
      { status: 400 }
    );
  }

  const { data, error } = await viewer.admin
    .from("profile_update_requests")
    .insert({
      member_id: viewer.member.id,
      payload: parsed.data,
      request_type: "profile_change",
      status: "pending",
    })
    .select("id, request_type, payload, status, requested_at")
    .single();

  if (error) {
    return NextResponse.json(
      { message: "Unable to submit profile change request." },
      { status: 500 }
    );
  }

  await viewer.admin.from("audit_events").insert({
    action: "member.requested_profile_change",
    actor_user_id: viewer.userId,
    entity_type: "profile_update_request",
    entity_id: data.id,
    metadata: {
      memberId: viewer.member.id,
      requestType: "profile_change",
    },
  });

  return NextResponse.json(
    {
      data,
      message: "Profile change request submitted for moderation.",
    },
    { status: 201 }
  );
}
