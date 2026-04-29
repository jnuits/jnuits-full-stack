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
  buildMemberInvitationEmail,
} from "@/lib/notifications/email-builders";
import { sendEmail } from "@/lib/notifications/send-email";
import { recordSecurityEvent } from "@/lib/security/security-events";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";
import {
  DEFAULT_INVITATION_EXPIRY_DAYS,
  generateInvitationCode,
  getInvitationExpiryIso,
  hashInvitationCode,
} from "@/lib/members/invitation-code";
import { formatMembershipIdForDisplay } from "@/lib/members/jnuits-id";

type AdminClient = ReturnType<typeof createAdminClient>;
type AuditEventInsert = TablesInsert<"audit_events">;
type OperatorReportInsert = TablesInsert<"operator_reports">;

const CYCLE_STATUSES = ["draft", "active", "closed", "archived"] as const;
const CYCLE_MEMBER_STATES = [
  "active",
  "pending_renewal",
  "renewed",
  "expired",
  "lapsed",
] as const;
const BATCH_STATUSES = ["draft", "active", "closed", "archived"] as const;
const BATCH_SOURCES = [
  "manual",
  "csv_onboarding",
  "reconciliation",
  "renewal",
] as const;

const cycleStatusSchema = z.enum(CYCLE_STATUSES);
const cycleMemberStateSchema = z.enum(CYCLE_MEMBER_STATES);
const batchStatusSchema = z.enum(BATCH_STATUSES);
const batchSourceSchema = z.enum(BATCH_SOURCES);
const booleanStringSchema = z
  .enum(["true", "false"])
  .optional()
  .default("false")
  .transform((value) => value === "true");
const optionalPositiveInt = (fallback: number, max: number) =>
  z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().int().min(1).max(max).optional().default(fallback)
  );

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

const createInvitationBatchSchema = z.object({
  cycleId: z.string().trim().max(80).optional().default(""),
  expiresAt: z.string().trim().max(80).optional().default(""),
  label: z.string().trim().min(1, "Batch label is required.").max(180),
  source: batchSourceSchema.optional().default("manual"),
  status: batchStatusSchema.optional().default("draft"),
});

const issueInvitationBatchSchema = z.object({
  batchId: z.string().trim().min(1, "Missing invitation batch identifier.").max(80),
  invitationExpiresInDays: optionalPositiveInt(DEFAULT_INVITATION_EXPIRY_DAYS, 365),
  maxUses: optionalPositiveInt(1, 20),
  onlyPendingRenewal: booleanStringSchema,
});

const batchIdSchema = z.object({
  batchId: z.string().trim().min(1, "Missing invitation batch identifier.").max(80),
});

const batchStatusUpdateSchema = z.object({
  batchId: z.string().trim().min(1, "Missing invitation batch identifier.").max(80),
  nextStatus: batchStatusSchema.optional().default("draft"),
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

type LifecycleStatus = z.infer<typeof lifecycleStatusSchema>;
type PortalAccessStatus = z.infer<typeof portalAccessStatusSchema>;
type PortalRoleCode = z.infer<typeof portalRoleUpdateSchema>["nextPortalRole"];
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

async function getNextInvitationCode(admin: AdminClient) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateInvitationCode();
    const codeHash = hashInvitationCode(code);

    const { data: existingInvite } = await admin
      .from("member_invitations")
      .select("id")
      .eq("code_hash", codeHash)
      .maybeSingle();

    if (!existingInvite) {
      return {
        code,
        codeHash,
      };
    }
  }

  throw new Error("Unable to generate a unique invitation code.");
}

async function persistAudit(admin: AdminClient, payload: AuditEventInsert) {
  await admin.from("audit_events").insert(payload);
}

async function persistOperatorReport(
  admin: AdminClient,
  payload: OperatorReportInsert
) {
  await admin.from("operator_reports").insert(payload);
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
  const flexibleAdmin = asFlexibleClient(admin);
  const { data: request, error: requestError } = await flexibleAdmin
    .from("profile_update_requests" as string)
    .select("id, member_id, request_type, status")
    .eq("id", parsed.data.requestId)
    .maybeSingle();

  if (
    requestError ||
    !request ||
    request.status !== "pending" ||
    !["alumni_conversion", "account_deletion"].includes(request.request_type)
  ) {
    await setAdminFlash({
      tone: "error",
      title: "Account request review failed",
      message: requestError?.message || "Pending alumni/deletion request could not be loaded.",
    });
    redirectMembership();
  }

  const { data: member, error: memberError } = await flexibleAdmin
    .from("members" as string)
    .select("id, user_id, jnuits_id, full_name, email")
    .eq("id", request.member_id)
    .maybeSingle();

  if (memberError || !member) {
    await setAdminFlash({
      tone: "error",
      title: "Account request review failed",
      message: memberError?.message || "The linked member record was not found.",
    });
    redirectMembership();
  }

  const nowIso = new Date().toISOString();
  const memberEmail = typeof member.email === "string" ? member.email : null;
  const memberName = typeof member.full_name === "string" ? member.full_name : "JnUITS member";

  if (parsed.data.decision === "approved") {
    if (request.request_type === "alumni_conversion") {
      const { error: lifecycleError } = await flexibleAdmin.rpc(
        "set_member_lifecycle_status" as string,
        {
          next_lifecycle_status: "alumni",
          next_portal_access_status: "active",
          reason: parsed.data.reviewNote || "Approved alumni conversion request.",
          target_member_id: member.id,
        }
      );

      if (lifecycleError) {
        await setAdminFlash({
          tone: "error",
          title: "Alumni conversion failed",
          message: lifecycleError.message,
        });
        redirectMembership();
      }

      if (member.user_id) {
        await assignPortalRole({
          actorUserId,
          admin,
          note: parsed.data.reviewNote,
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
          reason: parsed.data.reviewNote || "Approved profile deletion request.",
          target_member_id: member.id,
        }
      );

      if (lifecycleError) {
        await setAdminFlash({
          tone: "error",
          title: "Profile deletion failed",
          message: lifecycleError.message,
        });
        redirectMembership();
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
      review_note: parsed.data.reviewNote || null,
      reviewed_at: nowIso,
      reviewed_by_user_id: actorUserId,
      status: parsed.data.decision,
      updated_at: nowIso,
    })
    .eq("id", request.id);

  if (updateError) {
    await setAdminFlash({
      tone: "error",
      title: "Account request review failed",
      message: updateError.message,
    });
    redirectMembership();
  }

  await recordSecurityEvent(admin, {
    actorUserId,
    eventType: `member.${request.request_type}_${parsed.data.decision}`,
    payload: {
      memberId: member.id,
      requestId: request.id,
    },
    severity: request.request_type === "account_deletion" ? "warning" : "info",
    targetUserId: member.user_id,
  });

  if (memberEmail) {
    const approved = parsed.data.decision === "approved";
    const isAlumniConversion = request.request_type === "alumni_conversion";

    void sendEmail({
      html: isAlumniConversion
        ? buildAlumniConversionDecisionEmail({
            approved,
            memberName,
            reviewNote: parsed.data.reviewNote || null,
          })
        : buildDeletionRequestStatusEmail({
            approved,
            memberName,
            reviewNote: parsed.data.reviewNote || null,
          }),
      subject: isAlumniConversion
        ? `JnUITS alumni conversion ${parsed.data.decision}`
        : `JnUITS profile deletion request ${parsed.data.decision}`,
      to: memberEmail,
    });
  }

  revalidatePath("/admin/membership");
  revalidatePath("/admin/profile-changes");
  await setAdminFlash({
    tone: "success",
    title: "Account request reviewed",
    message: `${request.request_type.replaceAll("_", " ")} request ${parsed.data.decision}.`,
  });
  redirectMembership();
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

export async function createInvitationBatchAction(formData: FormData) {
  const auth = await requireAdminUser({ fallbackPath: "/admin/membership" });
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login?next=%2Fadmin%2Fmembership");
  }

  const parsed = createInvitationBatchSchema.safeParse(
    pickFormFields(formData, ["label", "cycleId", "source", "status", "expiresAt"])
  );

  if (!parsed.success) {
    await setAdminFlash(
      {
        tone: "error",
        title: "Batch creation failed",
        message: parsed.error.issues[0]?.message || "Batch label is required.",
      },
      "/admin"
    );
    redirectMembership();
  }

  const { cycleId, expiresAt, label, source, status } = parsed.data;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("invitation_batches")
    .insert({
      created_by_user_id: actorUserId,
      cycle_id: cycleId || null,
      expires_at: expiresAt || null,
      label,
      source,
      status,
    })
    .select("id")
    .single();

  if (error || !data) {
    await setAdminFlash(
      {
        tone: "error",
        title: "Batch creation failed",
        message: error?.message || "Unable to create invitation batch.",
      },
      "/admin"
    );
    redirectMembership();
  }

  await persistAudit(admin, {
    actor_user_id: actorUserId,
    action: "membership.invitation_batch_created",
    entity_type: "invitation_batch",
    entity_id: data.id,
    metadata: {
      cycleId: cycleId || null,
      label,
      source,
      status,
    },
  });

  revalidatePath("/admin/membership");
  await setAdminFlash(
    {
      tone: "success",
      title: "Invitation batch created",
      message: `${label} is ready for issuance workflow.`,
    },
    "/admin"
  );
  redirectMembership();
}

export async function issueInvitationsFromBatchAction(formData: FormData) {
  const auth = await requireAdminUser({ fallbackPath: "/admin/membership" });
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login?next=%2Fadmin%2Fmembership");
  }

  const parsed = issueInvitationBatchSchema.safeParse(
    pickFormFields(formData, [
      "batchId",
      "onlyPendingRenewal",
      "maxUses",
      "invitationExpiresInDays",
    ])
  );

  if (!parsed.success) {
    await setAdminFlash(
      {
        tone: "error",
        title: "Batch issuance failed",
        message:
          parsed.error.issues[0]?.message ||
          "Missing invitation batch identifier.",
      },
      "/admin"
    );
    redirectMembership();
  }

  const {
    batchId,
    invitationExpiresInDays: expiryDays,
    maxUses,
    onlyPendingRenewal,
  } = parsed.data;

  const admin = createAdminClient();
  const { data: batch, error: batchError } = await admin
    .from("invitation_batches")
    .select("id, cycle_id, label")
    .eq("id", batchId)
    .maybeSingle();

  if (batchError || !batch) {
    await setAdminFlash(
      {
        tone: "error",
        title: "Batch issuance failed",
        message: "Invitation batch could not be loaded.",
      },
      "/admin"
    );
    redirectMembership();
  }

  if (!batch.cycle_id) {
    await setAdminFlash(
      {
        tone: "error",
        title: "Batch issuance failed",
        message: "This batch is not linked to a cycle.",
      },
      "/admin"
    );
    redirectMembership();
  }

  let queue = admin
    .from("membership_cycle_memberships")
    .select(
      "id, member_id, state, members(id, is_profile_claimed, full_name, jnuits_id, email)"
    )
    .eq("cycle_id", batch.cycle_id);

  if (onlyPendingRenewal) {
    queue = queue.eq("state", "pending_renewal");
  } else {
    queue = queue.in("state", ["active", "pending_renewal", "renewed"]);
  }

  const { data: rows, error: queueError } = await queue.limit(200);

  if (queueError) {
    await setAdminFlash(
      {
        tone: "error",
        title: "Batch issuance failed",
        message: queueError.message,
      },
      "/admin"
    );
    redirectMembership();
  }

  let issued = 0;
  const nowIso = new Date().toISOString();

  for (const row of rows || []) {
    const relation = Array.isArray(row.members) ? row.members[0] : row.members;

    if (!relation || relation.is_profile_claimed) {
      continue;
    }

    const code = await getNextInvitationCode(admin);
    const expiresAt = getInvitationExpiryIso(expiryDays);

    const { error: inviteError } = await admin.from("member_invitations").insert({
      code_hash: code.codeHash,
      created_by_user_id: actorUserId,
      expires_at: expiresAt,
      max_uses: maxUses,
      member_id: relation.id,
      notes: `[batch:${batch.id}] ${batch.label}`,
    });

    if (!inviteError) {
      issued += 1;
      if (typeof relation.email === "string" && relation.email) {
        void sendEmail({
          html: buildMemberInvitationEmail({
            invitationCode: code.code,
            invitationExpiresAt: expiresAt,
            jnuitsId: relation.jnuits_id || "JnUITS member",
            memberName: relation.full_name || "JnUITS member",
          }),
          subject: "Claim your JnUITS member account",
          to: relation.email,
        });
      }
    }
  }

  const { data: invitationRows } = await admin
    .from("member_invitations")
    .select("id, used_count")
    .ilike("notes", `%[batch:${batch.id}]%`);

  const issuedCount = (invitationRows || []).length;
  const claimedCount = (invitationRows || []).filter(
    (row: { used_count?: number }) => (row.used_count || 0) > 0
  ).length;

  await admin
    .from("invitation_batches")
    .update({
      claimed_count: claimedCount,
      issued_count: issuedCount,
      metadata: {
        generatedAt: nowIso,
        onlyPendingRenewal,
      },
      status: issuedCount > 0 ? "active" : "draft",
    })
    .eq("id", batch.id);

  await persistOperatorReport(admin, {
    created_by_user_id: actorUserId,
    report: {
      batchId: batch.id,
      claimedCount,
      cycleId: batch.cycle_id,
      issuedCount,
      issuedThisRun: issued,
      onlyPendingRenewal,
    },
    report_type: "membership_reconciliation",
    status: "completed",
    summary: `Invitation batch run completed for ${batch.label} (${issued} newly issued).`,
    title: `Invitation batch run: ${batch.label}`,
  });

  await persistAudit(admin, {
    actor_user_id: actorUserId,
    action: "membership.invitation_batch_issued",
    entity_type: "invitation_batch",
    entity_id: batch.id,
    metadata: {
      claimedCount,
      issuedCount,
      issuedThisRun: issued,
      onlyPendingRenewal,
    },
  });

  revalidatePath("/admin/membership");
  await setAdminFlash(
    {
      tone: "success",
      title: "Batch issuance completed",
      message: `${issued} new invitations issued in ${batch.label}.`,
    },
    "/admin"
  );
  redirectMembership();
}

export async function syncInvitationBatchMetricsAction(formData: FormData) {
  const auth = await requireAdminUser({ fallbackPath: "/admin/membership" });
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login?next=%2Fadmin%2Fmembership");
  }

  const parsed = batchIdSchema.safeParse(pickFormFields(formData, ["batchId"]));

  if (!parsed.success) {
    await setAdminFlash(
      {
        tone: "error",
        title: "Batch sync failed",
        message:
          parsed.error.issues[0]?.message ||
          "Missing invitation batch identifier.",
      },
      "/admin"
    );
    redirectMembership();
  }

  const { batchId } = parsed.data;

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("member_invitations")
    .select("id, used_count")
    .ilike("notes", `%[batch:${batchId}]%`);

  if (error) {
    await setAdminFlash(
      {
        tone: "error",
        title: "Batch sync failed",
        message: error.message,
      },
      "/admin"
    );
    redirectMembership();
  }

  const issuedCount = (rows || []).length;
  const claimedCount = (rows || []).filter(
    (row: { used_count?: number }) => (row.used_count || 0) > 0
  ).length;

  const { error: updateError } = await admin
    .from("invitation_batches")
    .update({
      claimed_count: claimedCount,
      issued_count: issuedCount,
      metadata: {
        lastSyncedAt: new Date().toISOString(),
      },
    })
    .eq("id", batchId);

  if (updateError) {
    await setAdminFlash(
      {
        tone: "error",
        title: "Batch sync failed",
        message: updateError.message,
      },
      "/admin"
    );
    redirectMembership();
  }

  await persistAudit(admin, {
    actor_user_id: actorUserId,
    action: "membership.invitation_batch_synced",
    entity_type: "invitation_batch",
    entity_id: batchId,
    metadata: {
      claimedCount,
      issuedCount,
    },
  });

  revalidatePath("/admin/membership");
  await setAdminFlash(
    {
      tone: "success",
      title: "Batch metrics synced",
      message: `Issued ${issuedCount}, claimed ${claimedCount}.`,
    },
    "/admin"
  );
  redirectMembership();
}

export async function updateInvitationBatchStatusAction(formData: FormData) {
  const auth = await requireAdminUser({ fallbackPath: "/admin/membership" });
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login?next=%2Fadmin%2Fmembership");
  }

  const parsed = batchStatusUpdateSchema.safeParse(
    pickFormFields(formData, ["batchId", "nextStatus"])
  );

  if (!parsed.success) {
    await setAdminFlash(
      {
        tone: "error",
        title: "Batch status update failed",
        message:
          parsed.error.issues[0]?.message ||
          "Missing invitation batch identifier.",
      },
      "/admin"
    );
    redirectMembership();
  }

  const { batchId, nextStatus } = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin
    .from("invitation_batches")
    .update({
      status: nextStatus,
    })
    .eq("id", batchId);

  if (error) {
    await setAdminFlash(
      {
        tone: "error",
        title: "Batch status update failed",
        message: error.message,
      },
      "/admin"
    );
    redirectMembership();
  }

  await persistAudit(admin, {
    actor_user_id: actorUserId,
    action: "membership.invitation_batch_status_updated",
    entity_type: "invitation_batch",
    entity_id: batchId,
    metadata: {
      nextStatus,
    },
  });

  revalidatePath("/admin/membership");
  await setAdminFlash(
    {
      tone: "success",
      title: "Batch status updated",
      message: `Invitation batch is now ${nextStatus}.`,
    },
    "/admin"
  );
  redirectMembership();
}
