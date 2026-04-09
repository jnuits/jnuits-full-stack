import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const workplacePayloadSchema = z
  .object({
    currentOrganization: z.string().trim().max(160).optional(),
    designation: z.string().trim().max(160).optional(),
    workLocation: z.string().trim().max(160).optional(),
    linkedinUrl: z.string().trim().url().optional().or(z.literal("")),
    websiteUrl: z.string().trim().url().optional().or(z.literal("")),
    professionalVisibility: z
      .enum(["public", "members-only", "private"])
      .optional(),
  })
  .refine((value) => Object.values(value).some(Boolean), {
    message: "Provide at least one workplace field.",
  });

async function requireLinkedAlumniUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as Record<string, unknown> | undefined;

  const userId = typeof claims?.sub === "string" ? claims.sub : null;

  if (!userId) {
    return {
      error: NextResponse.json(
        { message: "Sign in with your claimed member account." },
        { status: 401 }
      ),
      member: null,
      admin: null,
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
      error: NextResponse.json(
        { message: "No linked member profile exists for this account." },
        { status: 404 }
      ),
      member: null,
      admin: null,
      userId: null,
    };
  }

  if (member.member_type !== "alumni") {
    return {
      error: NextResponse.json(
        {
          message: "Workplace self-updates are currently limited to alumni accounts.",
        },
        { status: 403 }
      ),
      member: null,
      admin: null,
      userId: null,
    };
  }

  return {
    error: null,
    member,
    admin,
    userId,
  };
}

export async function GET() {
  const viewer = await requireLinkedAlumniUser();

  if (viewer.error || !viewer.member || !viewer.admin) {
    return viewer.error;
  }

  const { data, error } = await viewer.admin
    .from("profile_update_requests")
    .select("id, request_type, payload, status, requested_at, reviewed_at, review_note, reviewed_by_user_id")
    .eq("member_id", viewer.member.id)
    .eq("request_type", "workplace_update")
    .order("requested_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json(
      { message: "Unable to retrieve workplace update requests." },
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
  const viewer = await requireLinkedAlumniUser();

  if (viewer.error || !viewer.member || !viewer.admin) {
    return viewer.error;
  }

  const payload = await request.json().catch(() => null);
  const parsed = workplacePayloadSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message:
          parsed.error.flatten().formErrors[0] ||
          "Provide at least one valid workplace field.",
      },
      { status: 400 }
    );
  }

  const { data, error } = await viewer.admin
    .from("profile_update_requests")
    .insert({
      member_id: viewer.member.id,
      request_type: "workplace_update",
      payload: parsed.data,
      status: "pending",
    })
    .select("id, request_type, payload, status, requested_at")
    .single();

  if (error) {
    return NextResponse.json(
      { message: "Unable to submit workplace update request." },
      { status: 500 }
    );
  }

  await viewer.admin.from("audit_events").insert({
    action: "member.requested_workplace_update",
    actor_user_id: viewer.userId,
    entity_type: "profile_update_request",
    entity_id: data.id,
    metadata: {
      memberId: viewer.member.id,
      requestType: "workplace_update",
    },
  });

  return NextResponse.json(
    {
      message: "Workplace update request submitted for moderation.",
      data,
    },
    { status: 201 }
  );
}
