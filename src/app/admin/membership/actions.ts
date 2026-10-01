"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  SafeAdminActionError,
  getSafeAdminActionErrorMessage,
} from "@/lib/admin/action-error";
import { setAdminFlash } from "@/lib/admin/flash";
import { requireAdminPermission } from "@/lib/auth/session";
import { revalidatePublicCommitteeProjection } from "@/lib/committee/revalidation";
import type { TablesInsert } from "@/lib/db/types";
import { buildDeletionRequestStatusEmail } from "@/lib/notifications/email-builders";
import { sendEmail } from "@/lib/notifications/send-email";
import { recordSecurityEvent } from "@/lib/security/security-events";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";
import { formatMembershipIdForDisplay } from "@/lib/members/jnuits-id";

type AdminClient = ReturnType<typeof createAdminClient>;
type AuditEventInsert = TablesInsert<"audit_events">;


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

function safeMembershipError(error: unknown, context: string, fallback: string) {
  return getSafeAdminActionErrorMessage(error, {
    context: `membership.${context}`,
    fallback,
  });
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

  if (roleError) {
    throw new Error(
      safeMembershipError(
        roleError,
        "assignPortalRole.loadRole",
        "Unable to load the selected portal role."
      )
    );
  }

  if (!role?.id) {
    throw new SafeAdminActionError("The selected portal role is not assignable.");
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
    throw new Error(
      safeMembershipError(
        insertError,
        "assignPortalRole",
        "Portal role could not be assigned."
      )
    );
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
    throw new SafeAdminActionError(
      parsed.error.issues[0]?.message || "Invalid lifecycle update."
    );
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
    if (error.code === "22023" && parsed.data.nextLifecycleStatus === "current") {
      throw new SafeAdminActionError(
        "Current membership cannot be reactivated here. Use the renewal and membership decisions queue to confirm outstanding anniversaries or review a closed path."
      );
    }
    throw new Error(
      safeMembershipError(
        error,
        "updateLifecycle.rpc",
        "Member lifecycle could not be updated."
      )
    );
  }

  revalidatePath("/admin/membership");
  revalidatePublicCommitteeProjection();

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
      message: safeMembershipError(
        error,
        "updateLifecycle",
        "Member lifecycle could not be updated."
      ),
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
    throw new SafeAdminActionError(
      parsed.error.issues[0]?.message || "Invalid portal role update."
    );
  }

  const admin = createAdminClient();
  const { data: member, error: memberError } = await asFlexibleClient(admin)
    .from("members" as string)
    .select("id, user_id, full_name, jnuits_id")
    .eq("id", parsed.data.memberId)
    .maybeSingle();

  if (memberError) {
    throw new Error(
      safeMembershipError(
        memberError,
        "updatePortalRole.loadMember",
        "Unable to load the member account."
      )
    );
  }

  if (!member?.user_id) {
    throw new SafeAdminActionError("This member does not have a linked portal account.");
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
      message: safeMembershipError(error, "updatePortalRole", "Unable to update portal role."),
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
  try {
    const parsed = memberOperationsSaveSchema.safeParse(input);

    if (!parsed.success) {
      throw parsed.error;
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
  } catch (error) {
    throw new Error(
      safeMembershipError(error, "saveMemberOperations", "Unable to save member changes.")
    );
  }
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

  if (request?.request_type !== "account_deletion" && !requestError) {
    throw new SafeAdminActionError("Use the renewal and membership decisions queue for alumni, departure and appeal reviews.");
  }

  if (
    requestError ||
    !request ||
    request.status !== "pending" ||
    request.request_type !== "account_deletion"
  ) {
    if (requestError) {
      throw requestError;
    }

    throw new SafeAdminActionError("Pending deletion request could not be loaded.");
  }

  const { data: member, error: memberError } = await flexibleAdmin
    .from("members" as string)
    .select("id, user_id, jnuits_id, full_name, email")
    .eq("id", request.member_id)
    .maybeSingle();

  if (memberError) {
    throw memberError;
  }

  if (!member) {
    throw new SafeAdminActionError("The linked member record was not found.");
  }

  const nowIso = new Date().toISOString();
  const memberEmail = typeof member.email === "string" ? member.email : null;
  const memberName = typeof member.full_name === "string" ? member.full_name : "JnUITS member";

  if (options.decision === "approved") {
    {
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
        throw lifecycleError;
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
    throw updateError;
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
    void sendEmail({
      html: buildDeletionRequestStatusEmail({
            approved,
            memberName,
            reviewNote: options.reviewNote || null,
          }),
      subject: `JnUITS profile deletion request ${options.decision}`,
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
      message: safeMembershipError(
        error,
        "reviewAccountRequest",
        "Pending deletion request could not be reviewed."
      ),
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

  try {
    const parsed = accountRequestBulkReviewSchema.safeParse(input);

    if (!parsed.success) {
      throw parsed.error;
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
  } catch (error) {
    throw new Error(
      safeMembershipError(
        error,
        "bulkReviewAccountRequests",
        "Unable to review the selected account requests."
      )
    );
  }
}

