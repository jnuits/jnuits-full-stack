import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { isActiveDepartmentCode } from "@/lib/departments.server";
import { withApiGuard } from "@/lib/security/with-api-guard";
import { normalizeJnuitsIdForCreation } from "@/lib/members/jnuits-id";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";
import { createClient } from "@/lib/supabase/server";

const profileChangePayloadSchema = z
  .object({
    departmentCode: z.string().trim().max(80).optional(),
    requestType: z.literal("profile_change").optional(),
    facebookUrl: z.string().trim().url().optional().or(z.literal("")),
    fullName: z.string().trim().max(160).optional(),
    phone: z.string().trim().max(40).optional(),
    linkedinUrl: z.string().trim().url().optional().or(z.literal("")),
    websiteUrl: z.string().trim().url().optional().or(z.literal("")),
  })
  .refine(
    (value) =>
      Boolean(
          value.departmentCode ||
          value.facebookUrl ||
          value.fullName ||
          value.phone ||
          value.linkedinUrl ||
          value.websiteUrl
      ),
    {
    message: "Provide at least one profile field to change.",
    }
  );

const emailChangePayloadSchema = z.object({
  newEmail: z.string().trim().email().max(254),
  requestType: z.literal("email_change"),
});

const jnuitsIdChangePayloadSchema = z
  .object({
    newJnuitsId: z.string().trim().max(80),
    requestType: z.literal("jnuits_id_change"),
  })
  .transform((value, context) => {
    const normalized = normalizeJnuitsIdForCreation(value.newJnuitsId);

    if (!normalized) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "JnUITS ID must use the JnUITS-YYYYSSS format.",
      });
    }

    return {
      newJnuitsId: normalized,
      requestType: value.requestType,
    };
  });

const changeRequestSchema = z.union([
  profileChangePayloadSchema,
  emailChangePayloadSchema,
  jnuitsIdChangePayloadSchema,
]);

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
  const { data: member, error } = await asFlexibleClient(admin)
    .from("members" as string)
    .select("id, email, jnuits_id, full_name, member_type, department_code, lifecycle_status, portal_access_status")
    .select("id, email, jnuits_id, full_name, member_type, lifecycle_status, portal_access_status")
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

  const lifecycleStatus =
    typeof member.lifecycle_status === "string" ? member.lifecycle_status : "current";
  const portalAccessStatus =
    typeof member.portal_access_status === "string" ? member.portal_access_status : "active";

  if (
    portalAccessStatus !== "active" ||
    (lifecycleStatus !== "current" && lifecycleStatus !== "alumni")
  ) {
    return {
      admin: null,
      error: NextResponse.json(
        { message: "This profile is frozen or restricted pending admin review." },
        { status: 423 }
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

  if (viewer.error) {
    return viewer.error;
  }

  if (!viewer.member || !viewer.admin) {
    return NextResponse.json(
      { message: "No linked member profile exists for this account." },
      { status: 404 }
    );
  }

  const { data, error } = await viewer.admin
    .from("profile_update_requests")
    .select("id, request_type, payload, status, requested_at, reviewed_at, review_note, reviewed_by_user_id")
    .eq("member_id", viewer.member.id)
    .in("request_type", ["profile_change", "email_change", "jnuits_id_change"])
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

async function handlePost(request: NextRequest) {
  const viewer = await requireLinkedMemberUser();

  if (viewer.error) {
    return viewer.error;
  }

  if (!viewer.member || !viewer.admin) {
    return NextResponse.json(
      { message: "No linked member profile exists for this account." },
      { status: 404 }
    );
  }

  const payload = await request.json().catch(() => null);
  const parsed = changeRequestSchema.safeParse(payload);

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

  if ("departmentCode" in parsed.data) {
    const departmentCode = parsed.data.departmentCode?.trim().toLowerCase() || "";

    if (departmentCode && !(await isActiveDepartmentCode(departmentCode))) {
      return NextResponse.json(
        { message: "Choose a valid active department." },
        { status: 400 }
      );
    }

    parsed.data.departmentCode = departmentCode;
  }

  const { data, error } = await viewer.admin
    .from("profile_update_requests")
    .insert({
      member_id: viewer.member.id,
      payload: parsed.data,
      request_type: parsed.data.requestType || "profile_change",
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
        requestType: parsed.data.requestType || "profile_change",
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

export const POST = withApiGuard(handlePost);
