"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { Database } from "@/lib/db/types";
import { approveMembershipApplication as approveTransactionalMembershipApplication } from "@/app/admin/applications/membership-actions";
import { requireAdminPermission } from "@/lib/auth/session";
import { setAdminFlash } from "@/lib/admin/flash";
import { getSafeAdminActionErrorMessage } from "@/lib/admin/action-error";
import { revalidatePublicCommitteeProjection } from "@/lib/committee/revalidation";
import { isActiveDepartmentCode } from "@/lib/departments.server";
import { getAppBaseUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_INVITATION_EXPIRY_DAYS,
  generateInvitationCode,
  getInvitationExpiryIso,
  hashInvitationCode,
  hashInvitationCodeCandidates,
} from "@/lib/members/invitation-code";
import {
  normalizeJnuitsIdForCreation,
} from "@/lib/members/jnuits-id";
import { buildClaimProfileUrl } from "@/lib/members/claim-url";
import {
  getWorkplacePayloadEntries,
  parseWorkplaceUpdatePayload,
} from "@/lib/members/workplace-payload";
import { sendEmail } from "@/lib/notifications/send-email";
import {
  buildMemberInvitationEmail,
  buildMembershipRejectedEmail,
  buildEmailChangeVerificationEmail,
  buildProfileChangeApprovedEmail,
  buildProfileChangeRejectedEmail,
} from "@/lib/notifications/email-builders";

type MemberInvitationRow =
  Database["public"]["Tables"]["member_invitations"]["Row"];
type ProfileUpdateRequestRow =
  Database["public"]["Tables"]["profile_update_requests"]["Row"];

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function safeLegacyAdminError(error: unknown, context: string, fallback: string) {
  return getSafeAdminActionErrorMessage(error, {
    context: `legacy.${context}`,
    fallback,
  });
}

const optionalPositiveInt = (fallback: number, max: number) =>
  z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().int().min(1).max(max).optional().default(fallback)
  );

const noteField = z.string().trim().max(1500).optional().default("");


const applicationModerationSchema = z.object({
  applicationId: z.string().trim().min(1, "The application identifier is missing.").max(80),
  reviewNote: noteField,
});

const invitationModerationSchema = z.object({
  invitationId: z.string().trim().min(1, "The invitation identifier is missing.").max(80),
  reviewNote: noteField,
});

const invitationReissueSchema = invitationModerationSchema.extend({
  invitationExpiresInDays: optionalPositiveInt(DEFAULT_INVITATION_EXPIRY_DAYS, 365),
  maxUses: optionalPositiveInt(1, 20),
});

const updateRequestModerationSchema = z.object({
  requestId: z.string().trim().min(1, "The request identifier is missing.").max(80),
  reviewNote: noteField,
});

function pickFormFields(formData: FormData, fields: string[]) {
  return Object.fromEntries(
    fields.map((field) => [field, asString(formData.get(field))])
  );
}

function buildEmailChangeConfirmUrl(options: {
  nextPath: string;
  tokenHash: string;
  type: string;
}) {
  const url = new URL("/auth/confirm", getAppBaseUrl());
  url.searchParams.set("token_hash", options.tokenHash);
  url.searchParams.set("type", options.type);
  url.searchParams.set("next", options.nextPath);
  return url.toString();
}

async function loadPendingApplication(applicationId: string) {
  const admin = createAdminClient();

  return admin
    .from("membership_applications")
    .select("*")
    .eq("id", applicationId)
    .maybeSingle();
}

async function loadInvitation(invitationId: string) {
  const admin = createAdminClient();

  return admin
    .from("member_invitations")
    .select("*")
    .eq("id", invitationId)
    .maybeSingle();
}

async function loadPendingProfileUpdateRequest(requestId: string) {
  const admin = createAdminClient();

  return admin
    .from("profile_update_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();
}

async function getNextInvitationCode(admin: ReturnType<typeof createAdminClient>) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateInvitationCode();
    const codeHash = hashInvitationCode(code);

    const { data: existingInvite } = await admin
      .from("member_invitations")
      .select("id")
      .in("code_hash", hashInvitationCodeCandidates(code))
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


async function issueFreshInvitation(
  admin: ReturnType<typeof createAdminClient>,
  options: {
    actorUserId: string;
    expiryDays: number;
    maxUses: number;
    memberId: string;
    notes: string | null;
  }
) {
  const invitation = await getNextInvitationCode(admin);
  const expiresAt = getInvitationExpiryIso(options.expiryDays);

  const { data: invitationRow, error: invitationError } = await admin
    .from("member_invitations")
    .insert({
      member_id: options.memberId,
      code_hash: invitation.codeHash,
      expires_at: expiresAt,
      max_uses: options.maxUses,
      notes: options.notes,
      created_by_user_id: options.actorUserId,
    })
    .select("id")
    .single();

  if (invitationError || !invitationRow) {
    throw new Error(invitationError?.message || "Unable to create the invitation.");
  }

  return {
    code: invitation.code,
    expiresAt,
    invitationId: invitationRow.id,
  };
}

export async function approveMembershipApplication(formData: FormData) {
  return approveTransactionalMembershipApplication(formData);
}

export async function rejectMembershipApplication(formData: FormData) {
  const auth = await requireAdminPermission("admin.membership.manage", {
    fallbackPath: "/admin/dashboard",
  });
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login");
  }
  const parsed = applicationModerationSchema.safeParse(
    pickFormFields(formData, ["applicationId", "reviewNote"])
  );

  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "Application rejection failed",
      message:
        parsed.error.issues[0]?.message ||
        "The application identifier is missing.",
    });
    redirect("/admin");
  }

  const { applicationId, reviewNote } = parsed.data;

  const admin = createAdminClient();
  const applicationResult = await loadPendingApplication(applicationId);
  const application = applicationResult.data;

  if (applicationResult.error || !application) {
    await setAdminFlash({
      tone: "error",
      title: "Application rejection failed",
      message: "The selected application could not be loaded.",
    });
    redirect("/admin");
  }

  if (application.status !== "pending") {
    await setAdminFlash({
      tone: "error",
      title: "Application already processed",
      message: `${application.name}'s application is already marked as ${application.status}.`,
    });
    redirect("/admin");
  }

  const nowIso = new Date().toISOString();

  const { error } = await admin
    .from("membership_applications")
    .update({
      status: "rejected",
      review_note: reviewNote || null,
      reviewed_at: nowIso,
      reviewed_by_user_id: actorUserId,
    })
    .eq("id", application.id);

  if (error) {
    await setAdminFlash({
      tone: "error",
      title: "Application rejection failed",
      message: safeLegacyAdminError(error, "legacy.update", "The admin operation could not be completed."),
    });
    redirect("/admin");
  }

  await admin.from("audit_events").insert({
    actor_user_id: actorUserId,
    action: "membership.application_rejected",
    entity_type: "membership_application",
    entity_id: application.id,
    metadata: {
      email: application.email,
      reviewNote: reviewNote || null,
    },
  });

  revalidatePath("/admin");
  await setAdminFlash({
    tone: "success",
    title: "Application rejected",
    message: `${application.name}'s application has been marked as rejected.`,
  });

  // Non-blocking notification
  void sendEmail({
    to: application.email,
    subject: "An update on your JnUITS membership application",
    html: buildMembershipRejectedEmail({
      applicantName: application.name,
      reviewNote: reviewNote || null,
    }),
  });

  redirect("/admin");
}

export async function revokeMemberInvitation(formData: FormData) {
  const auth = await requireAdminPermission("admin.membership.manage", {
    fallbackPath: "/admin/dashboard",
  });
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login");
  }

  const parsed = invitationModerationSchema.safeParse(
    pickFormFields(formData, ["invitationId", "reviewNote"])
  );

  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "Invitation revocation failed",
      message:
        parsed.error.issues[0]?.message ||
        "The invitation identifier is missing.",
    });
    redirect("/admin#invitations");
  }

  const { invitationId, reviewNote } = parsed.data;

  const admin = createAdminClient();
  const invitationResult = await loadInvitation(invitationId);
  const invitation = invitationResult.data as MemberInvitationRow | null;

  if (invitationResult.error || !invitation) {
    await setAdminFlash({
      tone: "error",
      title: "Invitation revocation failed",
      message: "The selected invitation could not be loaded.",
    });
    redirect("/admin#invitations");
  }

  if (!invitation.is_active || invitation.revoked_at) {
    await setAdminFlash({
      tone: "error",
      title: "Invitation already inactive",
      message: "This invitation has already been revoked or expired.",
    });
    redirect("/admin#invitations");
  }

  const nowIso = new Date().toISOString();

  const { data: member } = await admin
    .from("members")
    .select("id, jnuits_id, full_name, email")
    .eq("id", invitation.member_id)
    .maybeSingle();

  const { error } = await admin
    .from("member_invitations")
    .update({
      is_active: false,
      revoked_at: nowIso,
      notes: reviewNote || invitation.notes,
      updated_at: nowIso,
    })
    .eq("id", invitation.id);

  if (error) {
    await setAdminFlash({
      tone: "error",
      title: "Invitation revocation failed",
      message: safeLegacyAdminError(error, "legacy.update", "The admin operation could not be completed."),
    });
    redirect("/admin#invitations");
  }

  await admin.from("audit_events").insert({
    actor_user_id: actorUserId,
    action: "member.invitation_revoked",
    entity_type: "member_invitation",
    entity_id: invitation.id,
    metadata: {
      memberId: invitation.member_id,
      jnuitsId: member?.jnuits_id || null,
      reviewNote: reviewNote || null,
    },
  });

  if (member) {
    await admin.from("membership_lifecycle_events").insert({
      member_id: member.id,
      event_type: "invitation_revoked",
      summary: "A claim invitation was revoked by an operator.",
      created_by_user_id: actorUserId,
      metadata: {
        invitationId: invitation.id,
        reviewNote: reviewNote || null,
      },
    });
  }

  revalidatePath("/admin");
  await setAdminFlash({
    tone: "success",
    title: "Invitation revoked",
    message: member
      ? `The claim invitation for ${member.full_name} is now inactive.`
      : "The selected claim invitation is now inactive.",
  });
  redirect("/admin#invitations");
}

export async function reissueMemberInvitation(formData: FormData) {
  const auth = await requireAdminPermission("admin.membership.manage", {
    fallbackPath: "/admin/dashboard",
  });
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login");
  }

  const parsed = invitationReissueSchema.safeParse(
    pickFormFields(formData, [
      "invitationId",
      "reviewNote",
      "maxUses",
      "invitationExpiresInDays",
    ])
  );

  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "Invitation reissue failed",
      message:
        parsed.error.issues[0]?.message ||
        "The invitation identifier is missing.",
    });
    redirect("/admin#invitations");
  }

  const {
    invitationExpiresInDays: expiryDays,
    invitationId,
    maxUses,
    reviewNote,
  } = parsed.data;

  const admin = createAdminClient();
  const invitationResult = await loadInvitation(invitationId);
  const invitation = invitationResult.data as MemberInvitationRow | null;

  if (invitationResult.error || !invitation) {
    await setAdminFlash({
      tone: "error",
      title: "Invitation reissue failed",
      message: "The selected invitation could not be loaded.",
    });
    redirect("/admin#invitations");
  }

    const { data: member } = await admin
    .from("members")
    .select("id, jnuits_id, full_name, email")
    .eq("id", invitation.member_id)
    .maybeSingle();

  if (!member) {
    await setAdminFlash({
      tone: "error",
      title: "Invitation reissue failed",
      message: "The member record for this invitation could not be found.",
    });
    redirect("/admin#invitations");
  }

  const nowIso = new Date().toISOString();

  if (invitation.is_active && !invitation.revoked_at) {
    const { error: revokeError } = await admin
      .from("member_invitations")
      .update({
        is_active: false,
        revoked_at: nowIso,
        notes: reviewNote || invitation.notes,
        updated_at: nowIso,
      })
      .eq("id", invitation.id);

    if (revokeError) {
      await setAdminFlash({
        tone: "error",
        title: "Invitation reissue failed",
        message: safeLegacyAdminError(revokeError, "invitations.reissue.revokeOld", "The existing invitation could not be revoked."),
      });
      redirect("/admin#invitations");
    }
  }

  try {
    const replacement = await issueFreshInvitation(admin, {
      actorUserId,
      expiryDays,
      maxUses,
      memberId: member.id,
      notes:
        reviewNote ||
        `Replacement invitation issued after revoking ${invitation.id}.`,
    });

    await admin
      .from("membership_applications")
      .update({
        invitation_id: replacement.invitationId,
      })
      .eq("invitation_id", invitation.id);

    await admin.from("audit_events").insert([
      {
        actor_user_id: actorUserId,
        action: "member.invitation_revoked",
        entity_type: "member_invitation",
        entity_id: invitation.id,
        metadata: {
          memberId: member.id,
          jnuitsId: member.jnuits_id,
          reviewNote: reviewNote || null,
          supersededByInvitationId: replacement.invitationId,
        },
      },
      {
        actor_user_id: actorUserId,
        action: "member.invitation_generated",
        entity_type: "member_invitation",
        entity_id: replacement.invitationId,
        metadata: {
          memberId: member.id,
          jnuitsId: member.jnuits_id,
          replacedInvitationId: invitation.id,
          expiresAt: replacement.expiresAt,
          maxUses,
        },
      },
    ]);

    await admin.from("membership_lifecycle_events").insert({
      member_id: member.id,
      event_type: "invitation_reissued",
      summary: "A replacement claim invitation was issued by an operator.",
      created_by_user_id: actorUserId,
      metadata: {
        revokedInvitationId: invitation.id,
        replacementInvitationId: replacement.invitationId,
      },
    });

    revalidatePath("/admin");
    await setAdminFlash({
      tone: "success",
      title: "Replacement invitation created",
      message: `${member.full_name} now has a fresh claim code.`,
      invitationCode: replacement.code,
      jnuitsId: member.jnuits_id,
    });

    if (member.email) {
      void sendEmail({
        html: buildMemberInvitationEmail({
          claimUrl: buildClaimProfileUrl({
            email: member.email,
            invitationCode: replacement.code,
            jnuitsId: member.jnuits_id,
          }),
          invitationCode: replacement.code,
          invitationExpiresAt: replacement.expiresAt,
          jnuitsId: member.jnuits_id,
          memberEmail: member.email,
          memberName: member.full_name,
        }),
        subject: "Your replacement JnUITS claim code",
        to: member.email,
      });
    }
  } catch (error) {
    await setAdminFlash({
      tone: "error",
      title: "Invitation reissue failed",
      message: safeLegacyAdminError(
        error,
        "invitations.reissue",
        "A replacement invitation could not be issued."
      ),
    });
  }

  redirect("/admin#invitations");
}

export async function approveWorkplaceUpdateRequest(formData: FormData) {
  const auth = await requireAdminPermission("admin.membership.manage", {
    fallbackPath: "/admin/dashboard",
  });
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login");
  }

  const parsed = updateRequestModerationSchema.safeParse(
    pickFormFields(formData, ["requestId", "reviewNote"])
  );

  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "Workplace approval failed",
      message:
        parsed.error.issues[0]?.message ||
        "The workplace request identifier is missing.",
    });
    redirect("/admin#workplace");
  }

  const { requestId, reviewNote } = parsed.data;

  const admin = createAdminClient();
  const requestResult = await loadPendingProfileUpdateRequest(requestId);
  const request = requestResult.data as ProfileUpdateRequestRow | null;

  if (requestResult.error || !request) {
    await setAdminFlash({
      tone: "error",
      title: "Workplace approval failed",
      message: "The selected workplace update request could not be loaded.",
    });
    redirect("/admin#workplace");
  }

  if (request.request_type !== "workplace_update") {
    await setAdminFlash({
      tone: "error",
      title: "Unsupported request type",
      message: "Only workplace update requests can be moderated from this queue.",
    });
    redirect("/admin#workplace");
  }

  if (request.status !== "pending") {
    await setAdminFlash({
      tone: "error",
      title: "Request already processed",
      message: "This workplace request has already been moderated.",
    });
    redirect("/admin#workplace");
  }

  const payload = parseWorkplaceUpdatePayload(request.payload);
  const payloadEntries = getWorkplacePayloadEntries(request.payload);

  if (payloadEntries.length === 0) {
    await setAdminFlash({
      tone: "error",
      title: "Workplace approval failed",
      message: "This request does not contain any valid workplace fields.",
    });
    redirect("/admin#workplace");
  }

  const { data: member } = await admin
    .from("members")
    .select("id, full_name, jnuits_id")
    .eq("id", request.member_id)
    .maybeSingle();

  if (!member) {
    await setAdminFlash({
      tone: "error",
      title: "Workplace approval failed",
      message: "The member linked to this request could not be found.",
    });
    redirect("/admin#workplace");
  }

  const nowIso = new Date().toISOString();

  const { error: memberError } = await admin
    .from("members")
    .update({
      current_organization: payload.currentOrganization,
      designation: payload.designation,
      work_location: payload.workLocation,
      linkedin_url: payload.linkedinUrl,
      website_url: payload.websiteUrl,
      professional_visibility: payload.professionalVisibility,
      updated_at: nowIso,
    })
    .eq("id", member.id);

  if (memberError) {
    await setAdminFlash({
      tone: "error",
      title: "Workplace approval failed",
      message: safeLegacyAdminError(memberError, "member.update", "The member profile could not be updated."),
    });
    redirect("/admin#workplace");
  }

  const { error: requestError } = await admin
    .from("profile_update_requests")
    .update({
      status: "approved",
      review_note: reviewNote || null,
      reviewed_at: nowIso,
      reviewed_by_user_id: actorUserId,
      updated_at: nowIso,
    })
    .eq("id", request.id);

  if (requestError) {
    await setAdminFlash({
      tone: "error",
      title: "Workplace approval failed",
      message: safeLegacyAdminError(requestError, "profileRequest.update", "The profile request could not be updated."),
    });
    redirect("/admin#workplace");
  }

  await admin.from("membership_lifecycle_events").insert({
    member_id: member.id,
    event_type: "workplace_update_approved",
    summary: "A moderated workplace update request was approved.",
    created_by_user_id: actorUserId,
    metadata: {
      requestId: request.id,
      updatedFields: payloadEntries.map((entry) => entry.key),
    },
  });

  await admin.from("audit_events").insert({
    actor_user_id: actorUserId,
    action: "member.workplace_update_request_approved",
    entity_type: "profile_update_request",
    entity_id: request.id,
    metadata: {
      memberId: member.id,
      jnuitsId: member.jnuits_id,
      updatedFields: payloadEntries,
      reviewNote: reviewNote || null,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/profile");
  revalidatePath("/profile/edit");
  revalidatePublicCommitteeProjection();
  await setAdminFlash({
    tone: "success",
    title: "Workplace request approved",
    message: `${member.full_name}'s workplace profile has been updated.`,
    jnuitsId: member.jnuits_id,
  });
  redirect("/admin#workplace");
}

export async function rejectWorkplaceUpdateRequest(formData: FormData) {
  const auth = await requireAdminPermission("admin.membership.manage", {
    fallbackPath: "/admin/dashboard",
  });
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login");
  }

  const parsed = updateRequestModerationSchema.safeParse(
    pickFormFields(formData, ["requestId", "reviewNote"])
  );

  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "Workplace rejection failed",
      message:
        parsed.error.issues[0]?.message ||
        "The workplace request identifier is missing.",
    });
    redirect("/admin#workplace");
  }

  const { requestId, reviewNote } = parsed.data;

  const admin = createAdminClient();
  const requestResult = await loadPendingProfileUpdateRequest(requestId);
  const request = requestResult.data as ProfileUpdateRequestRow | null;

  if (requestResult.error || !request) {
    await setAdminFlash({
      tone: "error",
      title: "Workplace rejection failed",
      message: "The selected workplace update request could not be loaded.",
    });
    redirect("/admin#workplace");
  }

  if (request.status !== "pending") {
    await setAdminFlash({
      tone: "error",
      title: "Request already processed",
      message: "This workplace request has already been moderated.",
    });
    redirect("/admin#workplace");
  }

  const { data: member } = await admin
    .from("members")
    .select("id, full_name, jnuits_id")
    .eq("id", request.member_id)
    .maybeSingle();

  const nowIso = new Date().toISOString();

  const { error } = await admin
    .from("profile_update_requests")
    .update({
      status: "rejected",
      review_note: reviewNote || null,
      reviewed_at: nowIso,
      reviewed_by_user_id: actorUserId,
      updated_at: nowIso,
    })
    .eq("id", request.id);

  if (error) {
    await setAdminFlash({
      tone: "error",
      title: "Workplace rejection failed",
      message: safeLegacyAdminError(error, "legacy.update", "The admin operation could not be completed."),
    });
    redirect("/admin#workplace");
  }

  await admin.from("audit_events").insert({
    actor_user_id: actorUserId,
    action: "member.workplace_update_request_rejected",
    entity_type: "profile_update_request",
    entity_id: request.id,
    metadata: {
      memberId: request.member_id,
      jnuitsId: member?.jnuits_id || null,
      reviewNote: reviewNote || null,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/profile/edit");
  await setAdminFlash({
    tone: "success",
    title: "Workplace request rejected",
    message: member
      ? `${member.full_name}'s request has been marked as rejected.`
      : "The workplace request has been marked as rejected.",
    jnuitsId: member?.jnuits_id,
  });
  redirect("/admin#workplace");
}

export async function approveProfileChangeRequest(formData: FormData) {
  const auth = await requireAdminPermission("admin.membership.manage", {
    fallbackPath: "/admin/dashboard",
  });
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login");
  }

  const parsed = updateRequestModerationSchema.safeParse(
    pickFormFields(formData, ["requestId", "reviewNote"])
  );

  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "Profile approval failed",
      message:
        parsed.error.issues[0]?.message ||
        "The profile change request identifier is missing.",
    });
    redirect("/admin#profile-requests");
  }

  const { requestId, reviewNote } = parsed.data;

  const admin = createAdminClient();
  const requestResult = await loadPendingProfileUpdateRequest(requestId);
  const request = requestResult.data as ProfileUpdateRequestRow | null;

  if (requestResult.error || !request) {
    await setAdminFlash({
      tone: "error",
      title: "Profile approval failed",
      message: "The selected profile change request could not be loaded.",
    });
    redirect("/admin#profile-requests");
  }

  if (
    request.request_type !== "profile_change" &&
    request.request_type !== "email_change" &&
    request.request_type !== "jnuits_id_change"
  ) {
    await setAdminFlash({
      tone: "error",
      title: "Unsupported request type",
      message: "Only profile, email, and JnUITS ID change requests can be approved from this queue.",
    });
    redirect("/admin#profile-requests");
  }

  if (request.status !== "pending") {
    await setAdminFlash({
      tone: "error",
      title: "Request already processed",
      message: "This profile change request has already been moderated.",
    });
    redirect("/admin#profile-requests");
  }

  const payload =
    request.payload && typeof request.payload === "object" && !Array.isArray(request.payload)
      ? (request.payload as Record<string, unknown>)
      : null;

  if (!payload) {
    await setAdminFlash({
      tone: "error",
      title: "Profile approval failed",
      message: "This request does not contain a valid profile change payload.",
    });
    redirect("/admin#profile-requests");
  }

  const fullName =
    typeof payload.fullName === "string" && payload.fullName.trim()
      ? payload.fullName.trim()
      : null;
  const phone =
    typeof payload.phone === "string" && payload.phone.trim()
      ? payload.phone.trim()
      : null;
  const departmentCode =
    typeof payload.departmentCode === "string" && payload.departmentCode.trim()
      ? payload.departmentCode.trim().toLowerCase()
      : null;
  const facebookUrl =
    typeof payload.facebookUrl === "string" && payload.facebookUrl.trim()
      ? payload.facebookUrl.trim()
      : null;
  const linkedinUrl =
    typeof payload.linkedinUrl === "string" && payload.linkedinUrl.trim()
      ? payload.linkedinUrl.trim()
      : null;
  const websiteUrl =
    typeof payload.websiteUrl === "string" && payload.websiteUrl.trim()
      ? payload.websiteUrl.trim()
      : null;
  const newEmail =
    typeof payload.newEmail === "string" && payload.newEmail.trim()
      ? payload.newEmail.trim().toLowerCase()
      : null;
  const newJnuitsId =
    typeof payload.newJnuitsId === "string" && payload.newJnuitsId.trim()
      ? normalizeJnuitsIdForCreation(payload.newJnuitsId)
      : null;

  if (
    request.request_type === "profile_change" &&
    !departmentCode &&
    !facebookUrl &&
    !fullName &&
    !phone &&
    !linkedinUrl &&
    !websiteUrl
  ) {
    await setAdminFlash({
      tone: "error",
      title: "Profile approval failed",
      message: "This request does not contain any valid profile fields.",
    });
    redirect("/admin#profile-requests");
  }

  if (departmentCode && !(await isActiveDepartmentCode(departmentCode))) {
    await setAdminFlash({
      tone: "error",
      title: "Profile approval failed",
      message: "The requested department is not active or does not exist.",
    });
    redirect("/admin#profile-requests");
  }

  if (request.request_type === "email_change" && !newEmail) {
    await setAdminFlash({
      tone: "error",
      title: "Email approval failed",
      message: "This request does not contain a valid target email address.",
    });
    redirect("/admin#profile-requests");
  }

  if (request.request_type === "jnuits_id_change" && !newJnuitsId) {
    await setAdminFlash({
      tone: "error",
      title: "JnUITS ID approval failed",
      message: "This request does not contain a valid JnUITS ID.",
    });
    redirect("/admin#profile-requests");
  }

  const { data: member } = await admin
    .from("members")
    .select("id, full_name, email, jnuits_id, user_id, department_code, facebook_url, linkedin_url, phone, website_url")
    .eq("id", request.member_id)
    .maybeSingle();

  if (!member) {
    await setAdminFlash({
      tone: "error",
      title: "Profile approval failed",
      message: "The member linked to this request could not be found.",
    });
    redirect("/admin#profile-requests");
  }

  const nowIso = new Date().toISOString();

  if (request.request_type === "jnuits_id_change") {
    const approvedJnuitsId = newJnuitsId as string;
    const { data: existingMember } = await admin
      .from("members")
      .select("id")
      .eq("jnuits_id", approvedJnuitsId)
      .neq("id", member.id)
      .maybeSingle();

    if (existingMember) {
      await setAdminFlash({
        tone: "error",
        title: "JnUITS ID approval failed",
        message: `The requested ID ${approvedJnuitsId} is already assigned.`,
      });
      redirect("/admin#profile-requests");
    }

    const { error: memberError } = await admin
      .from("members")
      .update({
        jnuits_id: approvedJnuitsId,
        updated_at: nowIso,
      })
      .eq("id", member.id);

    if (memberError) {
      await setAdminFlash({
        tone: "error",
        title: "JnUITS ID approval failed",
        message: safeLegacyAdminError(memberError, "member.update", "The member profile could not be updated."),
      });
      redirect("/admin#profile-requests");
    }

    await admin
      .from("profile_update_requests")
      .update({
        review_note: reviewNote || null,
        reviewed_at: nowIso,
        reviewed_by_user_id: actorUserId,
        status: "approved",
        updated_at: nowIso,
      })
      .eq("id", request.id);

    await admin.from("audit_events").insert({
      actor_user_id: actorUserId,
      action: "member.jnuits_id_change_request_approved",
      entity_type: "profile_update_request",
      entity_id: request.id,
      metadata: {
        memberId: member.id,
        previousJnuitsId: member.jnuits_id,
        newJnuitsId: approvedJnuitsId,
        reviewNote: reviewNote || null,
      },
    });

    await admin.from("membership_lifecycle_events").insert({
      member_id: member.id,
      event_type: "jnuits_id_change_approved",
      summary: "A moderated JnUITS ID change request was approved.",
      created_by_user_id: actorUserId,
      metadata: {
        previousJnuitsId: member.jnuits_id,
        newJnuitsId: approvedJnuitsId,
        requestId: request.id,
      },
    });

    revalidatePath("/admin");
    revalidatePath("/admin/profile-changes");
    revalidatePublicCommitteeProjection();
    revalidatePath("/portal/profile");
    revalidatePath("/portal/profile/edit");
    await setAdminFlash({
      tone: "success",
      title: "JnUITS ID request approved",
      message: `${member.full_name}'s JnUITS ID has been updated to ${approvedJnuitsId}.`,
      jnuitsId: approvedJnuitsId,
    });
    redirect("/admin#profile-requests");
  }

  if (request.request_type === "email_change") {
    if (!member.user_id || !member.email || !newEmail) {
      await setAdminFlash({
        tone: "error",
        title: "Email approval failed",
        message:
          "The linked member account needs an existing auth user and email before an email change can be verified.",
      });
      redirect("/admin#profile-requests");
    }

    const nextPath = "/portal/profile?message=email-change-verification-sent";
    const currentLinkResult = await admin.auth.admin.generateLink({
      email: member.email,
      newEmail,
      options: {
        redirectTo: getAppBaseUrl(),
      },
      type: "email_change_current",
    });
    const newLinkResult = await admin.auth.admin.generateLink({
      email: member.email,
      newEmail,
      options: {
        redirectTo: getAppBaseUrl(),
      },
      type: "email_change_new",
    });

    if (currentLinkResult.error || newLinkResult.error) {
      await setAdminFlash({
        tone: "error",
        title: "Email approval failed",
        message: safeLegacyAdminError(
          currentLinkResult.error || newLinkResult.error,
          "profile.emailChange.generateLinks",
          "Unable to generate email verification links."
        ),
      });
      redirect("/admin#profile-requests");
    }

    const currentProperties = currentLinkResult.data.properties;
    const newProperties = newLinkResult.data.properties;
    const currentConfirmUrl = buildEmailChangeConfirmUrl({
      nextPath,
      tokenHash: currentProperties.hashed_token,
      type: currentProperties.verification_type,
    });
    const newConfirmUrl = buildEmailChangeConfirmUrl({
      nextPath,
      tokenHash: newProperties.hashed_token,
      type: newProperties.verification_type,
    });

    await admin
      .from("profile_update_requests")
      .update({
        review_note: reviewNote || null,
        reviewed_at: nowIso,
        reviewed_by_user_id: actorUserId,
        status: "approved",
        updated_at: nowIso,
      })
      .eq("id", request.id);

    await admin.from("audit_events").insert({
      actor_user_id: actorUserId,
      action: "member.email_change_request_approved",
      entity_type: "profile_update_request",
      entity_id: request.id,
      metadata: {
        memberId: member.id,
        newEmail,
        oldEmail: member.email,
        reviewNote: reviewNote || null,
      },
    });

    void sendEmail({
      to: member.email,
      subject: "Confirm your JnUITS email change",
      html: buildEmailChangeVerificationEmail({
        actionLink: currentConfirmUrl,
        memberName: member.full_name,
        newEmail,
        oldEmail: member.email,
        step: "current",
      }),
    });
    void sendEmail({
      to: newEmail,
      subject: "Confirm your new JnUITS email",
      html: buildEmailChangeVerificationEmail({
        actionLink: newConfirmUrl,
        memberName: member.full_name,
        newEmail,
        oldEmail: member.email,
        step: "new",
      }),
    });

    revalidatePath("/admin");
    revalidatePath("/admin/profile-changes");
    revalidatePath("/portal/profile");
    revalidatePath("/portal/profile/edit");
    await setAdminFlash({
      tone: "success",
      title: "Email request approved",
      message:
        "Verification links were generated for the current and new email addresses. The member email syncs after Supabase verifies the change.",
      jnuitsId: member.jnuits_id,
    });
    redirect("/admin#profile-requests");
  }

  const changedFields = [
    fullName ? "full_name" : null,
    departmentCode ? "department_code" : null,
    facebookUrl ? "facebook_url" : null,
    phone ? "phone" : null,
    linkedinUrl ? "linkedin_url" : null,
    websiteUrl ? "website_url" : null,
  ].filter((value): value is string => Boolean(value));

  const { error: memberError } = await admin
    .from("members")
    .update({
      department_code: departmentCode || member.department_code,
      facebook_url: facebookUrl || member.facebook_url,
      full_name: fullName || member.full_name,
      linkedin_url: linkedinUrl || member.linkedin_url,
      phone: phone || member.phone,
      updated_at: nowIso,
      website_url: websiteUrl || member.website_url,
    })
    .eq("id", member.id);

  if (memberError) {
    await setAdminFlash({
      tone: "error",
      title: "Profile approval failed",
      message: safeLegacyAdminError(memberError, "member.update", "The member profile could not be updated."),
    });
    redirect("/admin#profile-requests");
  }

  const { error: requestError } = await admin
    .from("profile_update_requests")
    .update({
      review_note: reviewNote || null,
      reviewed_at: nowIso,
      reviewed_by_user_id: actorUserId,
      status: "approved",
      updated_at: nowIso,
    })
    .eq("id", request.id);

  if (requestError) {
    await setAdminFlash({
      tone: "error",
      title: "Profile approval failed",
      message: safeLegacyAdminError(requestError, "profileRequest.update", "The profile request could not be updated."),
    });
    redirect("/admin#profile-requests");
  }

  await admin.from("membership_lifecycle_events").insert({
    member_id: member.id,
    event_type: "profile_change_approved",
    summary: "A moderated profile change request was approved.",
    created_by_user_id: actorUserId,
    metadata: {
      changedFields,
      requestId: request.id,
    },
  });

  await admin.from("audit_events").insert({
    actor_user_id: actorUserId,
    action: "member.profile_change_request_approved",
    entity_type: "profile_update_request",
    entity_id: request.id,
    metadata: {
      changedFields,
      jnuitsId: member.jnuits_id,
      memberId: member.id,
      reviewNote: reviewNote || null,
    },
  });

  revalidatePath("/admin");
  revalidatePublicCommitteeProjection();
  revalidatePath("/profile");
  revalidatePath("/profile/edit");
  revalidatePath("/portal/profile");
  revalidatePath("/portal/profile/edit");
  revalidatePath("/portal/profile");
  revalidatePath("/portal/profile/edit");
  await setAdminFlash({
    tone: "success",
    title: "Profile request approved",
    message: `${member.full_name}'s profile details have been updated.`,
    jnuitsId: member.jnuits_id,
  });

  // Non-blocking notification — look up member email for delivery
  const { data: memberWithEmail } = await admin
    .from("members")
    .select("email")
    .eq("id", member.id)
    .maybeSingle();

  if (memberWithEmail?.email) {
    void sendEmail({
      to: memberWithEmail.email,
      subject: "Your JnUITS profile update has been approved",
      html: buildProfileChangeApprovedEmail({
        memberName: member.full_name,
        changedFields,
        reviewNote: reviewNote || null,
      }),
    });
  }

  redirect("/admin#profile-requests");
}

export async function rejectProfileChangeRequest(formData: FormData) {
  const auth = await requireAdminPermission("admin.membership.manage", {
    fallbackPath: "/admin/dashboard",
  });
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login");
  }

  const parsed = updateRequestModerationSchema.safeParse(
    pickFormFields(formData, ["requestId", "reviewNote"])
  );

  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "Profile rejection failed",
      message:
        parsed.error.issues[0]?.message ||
        "The profile change request identifier is missing.",
    });
    redirect("/admin#profile-requests");
  }

  const { requestId, reviewNote } = parsed.data;

  const admin = createAdminClient();
  const requestResult = await loadPendingProfileUpdateRequest(requestId);
  const request = requestResult.data as ProfileUpdateRequestRow | null;

  if (requestResult.error || !request) {
    await setAdminFlash({
      tone: "error",
      title: "Profile rejection failed",
      message: "The selected profile change request could not be loaded.",
    });
    redirect("/admin#profile-requests");
  }

  if (request.status !== "pending") {
    await setAdminFlash({
      tone: "error",
      title: "Request already processed",
      message: "This profile change request has already been moderated.",
    });
    redirect("/admin#profile-requests");
  }

  const { data: member } = await admin
    .from("members")
    .select("id, full_name, jnuits_id")
    .eq("id", request.member_id)
    .maybeSingle();

  const nowIso = new Date().toISOString();

  const { error } = await admin
    .from("profile_update_requests")
    .update({
      review_note: reviewNote || null,
      reviewed_at: nowIso,
      reviewed_by_user_id: actorUserId,
      status: "rejected",
      updated_at: nowIso,
    })
    .eq("id", request.id);

  if (error) {
    await setAdminFlash({
      tone: "error",
      title: "Profile rejection failed",
      message: safeLegacyAdminError(error, "legacy.update", "The admin operation could not be completed."),
    });
    redirect("/admin#profile-requests");
  }

  await admin.from("audit_events").insert({
    actor_user_id: actorUserId,
    action: "member.profile_change_request_rejected",
    entity_type: "profile_update_request",
    entity_id: request.id,
    metadata: {
      jnuitsId: member?.jnuits_id || null,
      memberId: request.member_id,
      reviewNote: reviewNote || null,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/profile/edit");
  revalidatePath("/portal/profile/edit");
  revalidatePath("/portal/profile/edit");
  await setAdminFlash({
    tone: "success",
    title: "Profile request rejected",
    message: member
      ? `${member.full_name}'s request has been marked as rejected.`
      : "The profile change request has been marked as rejected.",
    jnuitsId: member?.jnuits_id,
  });

  // Non-blocking notification
  if (member) {
    const { data: memberWithEmail } = await admin
      .from("members")
      .select("email")
      .eq("id", member.id)
      .maybeSingle();

    if (memberWithEmail?.email) {
      void sendEmail({
        to: memberWithEmail.email,
        subject: "An update on your JnUITS profile change request",
        html: buildProfileChangeRejectedEmail({
          memberName: member.full_name,
          reviewNote: reviewNote || null,
        }),
      });
    }
  }

  redirect("/admin#profile-requests");
}
