"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { setAdminFlash } from "@/lib/admin/flash";
import { requireAdminPermission, requireAdminUser } from "@/lib/auth/session";
import type { TablesInsert } from "@/lib/db/types";
import {
  buildAlumniConversionDecisionEmail,
  buildDeletionRequestStatusEmail,
} from "@/lib/notifications/email-builders";
import { sendEmail } from "@/lib/notifications/send-email";
import { recordSecurityEvent } from "@/lib/security/security-events";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";
import { formatMembershipIdForDisplay } from "@/lib/members/jnuits-id";

type AdminClient = ReturnType<typeof createAdminClient>;
type AuditEventInsert = TablesInsert<"audit_events">;

const CYCLE_STATUSES = ["draft", "active", "closed", "archived"] as const;
const CYCLE_MEMBER_STATES = [
  "active",
  "pending_renewal",
  "renewed",
  "expired",
  "lapsed",
] as const;
const cycleStatusSchema = z.enum(CYCLE_STATUSES);
const cycleMemberStateSchema = z.enum(CYCLE_MEMBER_STATES);

const createCycleSchema = z.object({
  code: z.string().trim().min(1, "Code is required.").max(80).transform((value) => value.toLowerCase()),
  endsOn: z.string().trim().max(40).optional().default(""),
  renewalCloseOn: z.string().trim().max(40).optional().default(""),
  renewalOpenOn: z.string().trim().max(40).optional().default(""),
  startsOn: z.string().trim().min(1, "Start date is required.").max(40),
  status: cycleStatusSchema.optional().default("draft"),
  title: z.string().trim().min(1, "Title is required.").max(180),
});

const cycleStatusUpdateSchema = z.object({
  cycleId: z.string().trim().min(1, "Missing cycle identifier.").max(80),
  nextStatus: cycleStatusSchema.optional().default("draft"),
});

const enrollMemberSchema = z.object({
  cycleId: z.string().trim().min(1, "Cycle is required.").max(80),
  expiresOn: z.string().trim().max(40).optional().default(""),
  memberJnuitsId: z.string().trim().min(1, "Member JnUITS ID is required.").max(80).transform((value) => value.toUpperCase()),
  memberState: cycleMemberStateSchema.optional().default("pending_renewal"),
  note: z.string().trim().max(1000).optional().default(""),
});

const cycleMemberStateUpdateSchema = z.object({
  nextState: cycleMemberStateSchema.optional().default("pending_renewal"),
  note: z.string().trim().max(1000).optional().default(""),
  rowId: z.string().trim().min(1, "Cycle membership row identifier is missing.").max(80),
});

const lifecycleStatusSchema = z.enum(["current", "former", "alumni", "deleted"]);
const portalAccessStatusSchema = z.enum([
  "active",
  "frozen",
  "suspended",
  "deletion_requested",
  "deactivated",
]);
const memberLifecycleUpdateSchema = z.object({
  memberId: z.string().trim().min(1, "Missing member identifier.").max(80),
  nextLifecycleStatus: lifecycleStatusSchema,
  nextPortalAccessStatus: portalAccessStatusSchema,
  note: z.string().trim().max(1000).optional().default(""),
});
const portalRoleUpdateSchema = z.object({
  memberId: z.string().trim().min(1, "Missing member identifier.").max(80),
  nextPortalRole: z.enum(["member", "alumni", "executive", "alumni_ambassador"]),
  note: z.string().trim().max(1000).optional().default(""),
});
const accountRequestReviewSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  requestId: z.string().trim().min(1, "Missing request identifier.").max(80),
  reviewNote: z.string().trim().max(1500).optional().default(""),
});
const accountRequestBulkReviewSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  requestIds: z.array(z.string().trim().min(1).max(80)).min(1).max(50),
  reviewNote: z.string().trim().max(1500).optional().default(""),
});
const memberOperationsSaveSchema = z.object({
  lifecycleNote: z.string().trim().max(1000).optional().default(""),
  memberId: z.string().trim().min(1, "Missing member identifier.").max(80),
  nextLifecycleStatus: lifecycleStatusSchema,
  nextPortalAccessStatus: portalAccessStatusSchema,
  nextPortalRole: z.enum(["member", "alumni", "executive", "alumni_ambassador"]),
  roleNote: z.string().trim().max(1000).optional().default(""),
  updateLifecycle: z.boolean().optional().default(false),
  updatePortalRole: z.boolean().optional().default(false),
});
const memberLookupSchema = z.object({
  jnuitsId: z.string().trim().min(1, "Member JnUITS ID is required.").max(80),
});

type LifecycleStatus = z.infer<typeof lifecycleStatusSchema>;
type PortalAccessStatus = z.infer<typeof portalAccessStatusSchema>;
type PortalRoleCode = z.infer<typeof portalRoleUpdateSchema>["nextPortalRole"];
type AccountRequestDecision = z.infer<typeof accountRequestReviewSchema>["decision"];
type MembershipActionResult = {
  message: string;
  ok: true;
};

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function pickFormFields(formData: FormData, fields: string[]) {
  return Object.fromEntries(
    fields.map((field) => [field, asString(formData.get(field))])
  );
}

async function persistAudit(admin: AdminClient, payload: AuditEventInsert) {
  await admin.from("audit_events").insert(payload);
}

function redirectMembership(): never {
  redirect("/admin/membership");
}

async function assignPortalRole(options: {
  actorUserId: string;
  admin: AdminClient;
  note: string;
  roleCode: "alumni" | "alumni_ambassador" | "executive" | "member";
  targetUserId: string;
}) {
  const flexibleAdmin = asFlexibleClient(options.admin);
  const { data: role, error: roleError } = await flexibleAdmin
    .from("rbac_platform_roles" as string)
    .select("id, code")
    .eq("scope", "portal")
    .eq("code", options.roleCode)
    .eq("is_assignable", true)
    .maybeSingle();

  if (roleError || !role?.id) {
    throw new Error(roleError?.message || "The selected portal role is not assignable.");
  }

  await flexibleAdmin
    .from("rbac_user_platform_roles" as string)
    .update({
      note: options.note || "Replaced by portal role assignment.",
      revoked_at: new Date().toISOString(),
    })
    .eq("user_id", options.targetUserId)
    .eq("scope", "portal")
    .is("revoked_at", null);

  const { error: insertError } = await flexibleAdmin
    .from("rbac_user_platform_roles" as string)
    .insert({
      granted_by: options.actorUserId,
      note: options.note || null,
      role_id: role.id,
      scope: "portal",
      user_id: options.targetUserId,
    });

  if (insertError) {
    throw new Error(insertError.message);
  }
}

export async function updateMemberLifecycle(
  memberId: string,
  lifecycleStatus: LifecycleStatus,
  portalAccessStatus: PortalAccessStatus,
  note = ""
): Promise<MembershipActionResult> {
  const auth = await requireAdminPermission("admin.membership.manage", {
    fallbackPath: "/admin/membership",
  });
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login?next=%2Fadmin%2Fmembership");
  }

  const parsed = memberLifecycleUpdateSchema.safeParse({
    memberId,
    nextLifecycleStatus: lifecycleStatus,
    nextPortalAccessStatus: portalAccessStatus,
    note,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message || "Invalid lifecycle update.");
  }

  const admin = createAdminClient();
  const { error } = await asFlexibleClient(admin).rpc(
    "set_member_lifecycle_status" as string,
    {
      next_lifecycle_status: parsed.data.nextLifecycleStatus,
      next_portal_access_status: parsed.data.nextPortalAccessStatus,
      reason: parsed.data.note || null,
      target_member_id: parsed.data.memberId,
    }
  );

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/membership");
  revalidatePath("/members");

  return {
    message: "Member lifecycle and portal access status were updated.",
    ok: true,
  };
}

export async function updateMemberLifecycleAction(formData: FormData) {
  const parsed = memberLifecycleUpdateSchema.safeParse(
    pickFormFields(formData, [
      "memberId",
      "nextLifecycleStatus",
      "nextPortalAccessStatus",
      "note",
    ])
  );

  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "Lifecycle update failed",
      message: parsed.error.issues[0]?.message || "Invalid lifecycle update.",
    });
    redirectMembership();
  }

  try {
    await updateMemberLifecycle(
      parsed.data.memberId,
      parsed.data.nextLifecycleStatus,
      parsed.data.nextPortalAccessStatus,
      parsed.data.note
    );
  } catch (error) {
    await setAdminFlash({
      tone: "error",
      title: "Lifecycle update failed",
      message:
        error instanceof Error
          ? error.message
          : "Member lifecycle could not be updated.",
    });
    redirectMembership();
  }

  await setAdminFlash({
    tone: "success",
    title: "Lifecycle updated",
    message: "Member lifecycle and portal access status were updated.",
  });
  redirectMembership();
}

export async function updateMemberPortalRole(
  memberId: string,
  role: PortalRoleCode,
  note = ""
): Promise<MembershipActionResult> {
  const auth = await requireAdminPermission("admin.roles.manage_portal", {
    fallbackPath: "/admin/membership",
  });
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login?next=%2Fadmin%2Fmembership");
  }

  const parsed = portalRoleUpdateSchema.safeParse({
    memberId,
    nextPortalRole: role,
    note,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message || "Invalid portal role update.");
  }

  const admin = createAdminClient();
  const { data: member, error: memberError } = await asFlexibleClient(admin)
    .from("members" as string)
    .select("id, user_id, full_name, jnuits_id")
    .eq("id", parsed.data.memberId)
    .maybeSingle();

  if (memberError || !member?.user_id) {
    throw new Error(
      memberError?.message || "This member does not have a linked portal account."
    );
  }

  await assignPortalRole({
    actorUserId,
    admin,
    note: parsed.data.note,
    roleCode: parsed.data.nextPortalRole,
    targetUserId: member.user_id,
  });

  await persistAudit(admin, {
    actor_user_id: actorUserId,
    action: "member.portal_role_updated",
    entity_id: parsed.data.memberId,
    entity_type: "member",
    metadata: {
      jnuitsId: member.jnuits_id,
      nextPortalRole: parsed.data.nextPortalRole,
      targetUserId: member.user_id,
    },
  });

  await recordSecurityEvent(admin, {
    actorUserId,
    eventType: "member.portal_role_updated",
    payload: {
      memberId: parsed.data.memberId,
      nextPortalRole: parsed.data.nextPortalRole,
    },
    targetUserId: member.user_id,
  });

  revalidatePath("/admin/membership");
  revalidatePath("/members");

  return {
    message: `${member.full_name || formatMembershipIdForDisplay(member.jnuits_id)} now has the ${parsed.data.nextPortalRole} portal role.`,
    ok: true,
  };
}

export async function updateMemberPortalRoleAction(formData: FormData) {
  const parsed = portalRoleUpdateSchema.safeParse(
    pickFormFields(formData, ["memberId", "nextPortalRole", "note"])
  );

  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "Portal role update failed",
      message: parsed.error.issues[0]?.message || "Invalid portal role update.",
    });
    redirectMembership();
  }

  let result: MembershipActionResult;

  try {
    result = await updateMemberPortalRole(
      parsed.data.memberId,
      parsed.data.nextPortalRole,
      parsed.data.note
    );
  } catch (error) {
    await setAdminFlash({
      tone: "error",
      title: "Portal role update failed",
      message: error instanceof Error ? error.message : "Unable to update portal role.",
    });
    redirectMembership();
  }

  await setAdminFlash({
    tone: "success",
    title: "Portal role updated",
    message: result.message,
  });
  redirectMembership();
}

export async function saveMemberOperationsAction(
  input: unknown
): Promise<MembershipActionResult> {
  const parsed = memberOperationsSaveSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message || "Invalid member update.");
  }

  const updates: string[] = [];

  if (parsed.data.updateLifecycle) {
    await updateMemberLifecycle(
      parsed.data.memberId,
      parsed.data.nextLifecycleStatus,
      parsed.data.nextPortalAccessStatus,
      parsed.data.lifecycleNote
    );
    updates.push("lifecycle");
  }

  if (parsed.data.updatePortalRole) {
    await updateMemberPortalRole(
      parsed.data.memberId,
      parsed.data.nextPortalRole,
      parsed.data.roleNote
    );
    updates.push("portal role");
  }

  if (updates.length === 0) {
    return {
      message: "No changes to save.",
      ok: true,
    };
  }

  return {
    message: `Saved ${updates.join(" and ")} changes.`,
    ok: true,
  };
}

export async function lookupMemberForCycleAction(input: unknown): Promise<{
  displayJnuitsId: string;
  fullName: string;
  id: string;
} | null> {
  await requireAdminUser({ fallbackPath: "/admin/membership" });

  const parsed = memberLookupSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message || "Invalid member ID.");
  }

  const normalizedId = parsed.data.jnuitsId.toUpperCase();
  const admin = createAdminClient();
  const { data, error } = await asFlexibleClient(admin)
    .from("members" as string)
    .select("id, jnuits_id, full_name")
    .eq("jnuits_id", normalizedId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.id) {
    return null;
  }

  return {
    displayJnuitsId: formatMembershipIdForDisplay(
      typeof data.jnuits_id === "string" ? data.jnuits_id : normalizedId
    ),
    fullName:
      typeof data.full_name === "string" && data.full_name.trim()
        ? data.full_name
        : "Member record",
    id: String(data.id),
  };
}

async function reviewMemberAccountRequest(options: {
  actorUserId: string;
  admin: AdminClient;
  decision: AccountRequestDecision;
  requestId: string;
  reviewNote: string;
}) {
  const flexibleAdmin = asFlexibleClient(options.admin);
  const { data: request, error: requestError } = await flexibleAdmin
    .from("profile_update_requests" as string)
    .select("id, member_id, request_type, status")
    .eq("id", options.requestId)
    .maybeSingle();

  if (
    requestError ||
    !request ||
    request.status !== "pending" ||
    !["alumni_conversion", "account_deletion"].includes(request.request_type)
  ) {
    throw new Error(
      requestError?.message ||
        "Pending alumni/deletion request could not be loaded."
    );
  }

  const { data: member, error: memberError } = await flexibleAdmin
    .from("members" as string)
    .select("id, user_id, jnuits_id, full_name, email")
    .eq("id", request.member_id)
    .maybeSingle();

  if (memberError || !member) {
    throw new Error(memberError?.message || "The linked member record was not found.");
  }

  const nowIso = new Date().toISOString();
  const memberEmail = typeof member.email === "string" ? member.email : null;
  const memberName = typeof member.full_name === "string" ? member.full_name : "JnUITS member";

  if (options.decision === "approved") {
    if (request.request_type === "alumni_conversion") {
      const { error: lifecycleError } = await flexibleAdmin.rpc(
        "set_member_lifecycle_status" as string,
        {
          next_lifecycle_status: "alumni",
          next_portal_access_status: "active",
          reason: options.reviewNote || "Approved alumni conversion request.",
          target_member_id: member.id,
        }
      );

      if (lifecycleError) {
        throw new Error(lifecycleError.message);
      }

      if (member.user_id) {
        await assignPortalRole({
          actorUserId: options.actorUserId,
          admin: options.admin,
          note: options.reviewNote,
          roleCode: "alumni",
          targetUserId: member.user_id,
        });
      }
    } else {
      const targetUserId = typeof member.user_id === "string" ? member.user_id : null;
      const { error: lifecycleError } = await flexibleAdmin.rpc(
        "set_member_lifecycle_status" as string,
        {
          next_lifecycle_status: "deleted",
          next_portal_access_status: "deactivated",
          reason: options.reviewNote || "Approved profile deletion request.",
          target_member_id: member.id,
        }
      );

      if (lifecycleError) {
        throw new Error(lifecycleError.message);
      }

      if (targetUserId) {
        await flexibleAdmin
          .from("rbac_user_platform_roles" as string)
          .update({
            note: "Revoked after approved profile deletion request.",
            revoked_at: nowIso,
          })
          .eq("user_id", targetUserId)
          .eq("scope", "portal")
          .is("revoked_at", null);
      }

      await flexibleAdmin
        .from("members" as string)
        .update({
          current_organization: null,
          designation: null,
          email: null,
          full_name: "Deleted JnUITS profile",
          is_profile_claimed: false,
          linkedin_url: null,
          phone: null,
          profile_claimed_at: null,
          user_id: null,
          website_url: null,
          work_location: null,
        })
        .eq("id", member.id);
    }
  }

  const { error: updateError } = await flexibleAdmin
    .from("profile_update_requests" as string)
    .update({
      review_note: options.reviewNote || null,
      reviewed_at: nowIso,
      reviewed_by_user_id: options.actorUserId,
      status: options.decision,
      updated_at: nowIso,
    })
    .eq("id", request.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  await recordSecurityEvent(options.admin, {
    actorUserId: options.actorUserId,
    eventType: `member.${request.request_type}_${options.decision}`,
    payload: {
      memberId: member.id,
      requestId: request.id,
    },
    severity: request.request_type === "account_deletion" ? "warning" : "info",
    targetUserId: member.user_id,
  });

  if (memberEmail) {
    const approved = options.decision === "approved";
    const isAlumniConversion = request.request_type === "alumni_conversion";

    void sendEmail({
      html: isAlumniConversion
        ? buildAlumniConversionDecisionEmail({
            approved,
            memberName,
            reviewNote: options.reviewNote || null,
          })
        : buildDeletionRequestStatusEmail({
            approved,
            memberName,
            reviewNote: options.reviewNote || null,
          }),
      subject: isAlumniConversion
        ? `JnUITS alumni conversion ${options.decision}`
        : `JnUITS profile deletion request ${options.decision}`,
      to: memberEmail,
    });
  }

  return request.request_type as string;
}

export async function reviewMemberAccountRequestAction(formData: FormData) {
  const auth = await requireAdminPermission("admin.membership.manage", {
    fallbackPath: "/admin/membership",
  });
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login?next=%2Fadmin%2Fmembership");
  }

  const parsed = accountRequestReviewSchema.safeParse(
    pickFormFields(formData, ["requestId", "decision", "reviewNote"])
  );

  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "Account request review failed",
      message: parsed.error.issues[0]?.message || "Invalid account request review.",
    });
    redirectMembership();
  }

  const admin = createAdminClient();
  let requestType = "account";

  try {
    requestType = await reviewMemberAccountRequest({
      actorUserId,
      admin,
      decision: parsed.data.decision,
      requestId: parsed.data.requestId,
      reviewNote: parsed.data.reviewNote,
    });
  } catch (error) {
    await setAdminFlash({
      tone: "error",
      title: "Account request review failed",
      message:
        error instanceof Error
          ? error.message
          : "Pending alumni/deletion request could not be reviewed.",
    });
    redirectMembership();
  }

  revalidatePath("/admin/membership");
  revalidatePath("/admin/profile-changes");
  await setAdminFlash({
    tone: "success",
    title: "Account request reviewed",
    message: `${requestType.replaceAll("_", " ")} request ${parsed.data.decision}.`,
  });
  redirectMembership();
}

export async function bulkReviewMemberAccountRequestsAction(
  input: unknown
): Promise<MembershipActionResult> {
  const auth = await requireAdminPermission("admin.membership.manage", {
    fallbackPath: "/admin/membership",
  });
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login?next=%2Fadmin%2Fmembership");
  }

  const parsed = accountRequestBulkReviewSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message || "Invalid bulk review.");
  }

  const admin = createAdminClient();
  let reviewedCount = 0;

  for (const requestId of parsed.data.requestIds) {
    await reviewMemberAccountRequest({
      actorUserId,
      admin,
      decision: parsed.data.decision,
      requestId,
      reviewNote: parsed.data.reviewNote,
    });
    reviewedCount += 1;
  }

  revalidatePath("/admin/membership");
  revalidatePath("/admin/profile-changes");

  return {
    message: `${reviewedCount} request${reviewedCount === 1 ? "" : "s"} ${parsed.data.decision}.`,
    ok: true,
  };
}

export async function createMembershipCycleAction(formData: FormData) {
  const auth = await requireAdminUser({ fallbackPath: "/admin/membership" });
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login?next=%2Fadmin%2Fmembership");
  }

  const parsed = createCycleSchema.safeParse(
    pickFormFields(formData, [
      "code",
      "title",
      "startsOn",
      "endsOn",
      "renewalOpenOn",
      "renewalCloseOn",
      "status",
    ])
  );

  if (!parsed.success) {
    await setAdminFlash(
      {
        tone: "error",
        title: "Cycle creation failed",
        message: parsed.error.issues[0]?.message || "Code, title, and start date are required.",
      },
      "/admin"
    );
    redirectMembership();
  }

  const { code, endsOn, renewalCloseOn, renewalOpenOn, startsOn, status, title } =
    parsed.data;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("membership_cycles")
    .insert({
      code,
      created_by_user_id: actorUserId,
      ends_on: endsOn || null,
      renewal_close_on: renewalCloseOn || null,
      renewal_open_on: renewalOpenOn || null,
      starts_on: startsOn,
      status,
      title,
    })
    .select("id")
    .single();

  if (error || !data) {
    await setAdminFlash(
      {
        tone: "error",
        title: "Cycle creation failed",
        message: error?.message || "Unable to save membership cycle.",
      },
      "/admin"
    );
    redirectMembership();
  }

  await persistAudit(admin, {
    actor_user_id: actorUserId,
    action: "membership.cycle_created",
    entity_type: "membership_cycle",
    entity_id: data.id,
    metadata: {
      code,
      status,
      title,
    },
  });

  revalidatePath("/admin/membership");
  await setAdminFlash(
    {
      tone: "success",
      title: "Membership cycle created",
      message: `${title} is now available for renewal and enrollment operations.`,
    },
    "/admin"
  );
  redirectMembership();
}

export async function updateMembershipCycleStatusAction(formData: FormData) {
  const auth = await requireAdminUser({ fallbackPath: "/admin/membership" });
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login?next=%2Fadmin%2Fmembership");
  }

  const parsed = cycleStatusUpdateSchema.safeParse(
    pickFormFields(formData, ["cycleId", "nextStatus"])
  );

  if (!parsed.success) {
    await setAdminFlash(
      {
        tone: "error",
        title: "Cycle status update failed",
        message: parsed.error.issues[0]?.message || "Missing cycle identifier.",
      },
      "/admin"
    );
    redirectMembership();
  }

  const { cycleId, nextStatus } = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin
    .from("membership_cycles")
    .update({
      status: nextStatus,
    })
    .eq("id", cycleId);

  if (error) {
    await setAdminFlash(
      {
        tone: "error",
        title: "Cycle status update failed",
        message: error.message,
      },
      "/admin"
    );
    redirectMembership();
  }

  await persistAudit(admin, {
    actor_user_id: actorUserId,
    action: "membership.cycle_status_updated",
    entity_type: "membership_cycle",
    entity_id: cycleId,
    metadata: {
      nextStatus,
    },
  });

  revalidatePath("/admin/membership");
  await setAdminFlash(
    {
      tone: "success",
      title: "Cycle status updated",
      message: `Membership cycle is now marked as ${nextStatus}.`,
    },
    "/admin"
  );
  redirectMembership();
}

export async function enrollMemberInCycleAction(formData: FormData) {
  const auth = await requireAdminUser({ fallbackPath: "/admin/membership" });
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login?next=%2Fadmin%2Fmembership");
  }

  const parsed = enrollMemberSchema.safeParse(
    pickFormFields(formData, [
      "cycleId",
      "memberJnuitsId",
      "memberState",
      "expiresOn",
      "note",
    ])
  );

  if (!parsed.success) {
    await setAdminFlash(
      {
        tone: "error",
        title: "Enrollment failed",
        message:
          parsed.error.issues[0]?.message ||
          "Cycle and member JnUITS ID are required.",
      },
      "/admin"
    );
    redirectMembership();
  }

  const {
    cycleId,
    expiresOn,
    memberJnuitsId,
    memberState: state,
    note,
  } = parsed.data;

  const admin = createAdminClient();
  const { data: member, error: memberError } = await admin
    .from("members")
    .select("id, jnuits_id, full_name")
    .eq("jnuits_id", memberJnuitsId)
    .maybeSingle();

  if (memberError || !member) {
    await setAdminFlash(
      {
        tone: "error",
        title: "Enrollment failed",
        message: "Member not found for the given JnUITS ID.",
      },
      "/admin"
    );
    redirectMembership();
  }

  const { error: upsertError } = await admin
    .from("membership_cycle_memberships")
    .upsert(
      {
        created_by_user_id: actorUserId,
        cycle_id: cycleId,
        enrolled_at: new Date().toISOString(),
        expires_on: expiresOn || null,
        member_id: member.id,
        note: note || null,
        renewed_at: state === "renewed" ? new Date().toISOString() : null,
        state,
      },
      {
        onConflict: "cycle_id,member_id",
      }
    );

  if (upsertError) {
    await setAdminFlash(
      {
        tone: "error",
        title: "Enrollment failed",
        message: upsertError.message,
      },
      "/admin"
    );
    redirectMembership();
  }

  await admin.from("membership_lifecycle_events").insert({
    created_by_user_id: actorUserId,
    event_type: "cycle_membership_updated",
    member_id: member.id,
    metadata: {
      cycleId,
      expiresOn: expiresOn || null,
      state,
    },
    summary: `Cycle membership set to ${state}.`,
  });

  await persistAudit(admin, {
    actor_user_id: actorUserId,
    action: "membership.cycle_member_upserted",
    entity_type: "membership_cycle_membership",
    entity_id: `${cycleId}:${member.id}`,
    metadata: {
      cycleId,
      jnuitsId: member.jnuits_id,
      state,
    },
  });

  revalidatePath("/admin/membership");
  await setAdminFlash(
    {
      tone: "success",
      title: "Member enrollment updated",
      message: `${member.full_name} is now tracked in the selected cycle as ${state}.`,
      jnuitsId: member.jnuits_id,
    },
    "/admin"
  );
  redirectMembership();
}

export async function updateCycleMemberStateAction(formData: FormData) {
  const auth = await requireAdminUser({ fallbackPath: "/admin/membership" });
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login?next=%2Fadmin%2Fmembership");
  }

  const parsed = cycleMemberStateUpdateSchema.safeParse(
    pickFormFields(formData, ["rowId", "nextState", "note"])
  );

  if (!parsed.success) {
    await setAdminFlash(
      {
        tone: "error",
        title: "State update failed",
        message:
          parsed.error.issues[0]?.message ||
          "Cycle membership row identifier is missing.",
      },
      "/admin"
    );
    redirectMembership();
  }

  const { nextState, note, rowId } = parsed.data;

  const admin = createAdminClient();
  const { data: row, error: rowError } = await admin
    .from("membership_cycle_memberships")
    .select("id, cycle_id, member_id")
    .eq("id", rowId)
    .maybeSingle();

  if (rowError || !row) {
    await setAdminFlash(
      {
        tone: "error",
        title: "State update failed",
        message: "Cycle membership row could not be loaded.",
      },
      "/admin"
    );
    redirectMembership();
  }

  const { error } = await admin
    .from("membership_cycle_memberships")
    .update({
      note: note || null,
      renewed_at: nextState === "renewed" ? new Date().toISOString() : null,
      state: nextState,
    })
    .eq("id", row.id);

  if (error) {
    await setAdminFlash(
      {
        tone: "error",
        title: "State update failed",
        message: error.message,
      },
      "/admin"
    );
    redirectMembership();
  }

  await admin.from("membership_lifecycle_events").insert({
    created_by_user_id: actorUserId,
    event_type: "cycle_membership_state_changed",
    member_id: row.member_id,
    metadata: {
      cycleId: row.cycle_id,
      nextState,
      note: note || null,
    },
    summary: `Cycle state changed to ${nextState}.`,
  });

  await persistAudit(admin, {
    actor_user_id: actorUserId,
    action: "membership.cycle_member_state_changed",
    entity_type: "membership_cycle_membership",
    entity_id: row.id,
    metadata: {
      cycleId: row.cycle_id,
      nextState,
    },
  });

  revalidatePath("/admin/membership");
  await setAdminFlash(
    {
      tone: "success",
      title: "Cycle member state updated",
      message: `Member state is now ${nextState}.`,
    },
    "/admin"
  );
  redirectMembership();
}

