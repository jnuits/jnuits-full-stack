"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Database } from "@/lib/db/types";
import { requireAdminUser } from "@/lib/auth/session";
import { setAdminFlash } from "@/lib/admin/flash";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_INVITATION_EXPIRY_DAYS,
  generateInvitationCode,
  getInvitationExpiryIso,
  hashInvitationCode,
} from "@/lib/members/invitation-code";
import {
  buildGeneratedJnuitsId,
  extractBatchNumber,
  normalizeJnuitsIdForCreation,
} from "@/lib/members/jnuits-id";
import {
  getWorkplacePayloadEntries,
  parseWorkplaceUpdatePayload,
} from "@/lib/members/workplace-payload";
import { sendEmail } from "@/lib/notifications/send-email";
import {
  buildMembershipApprovedEmail,
  buildMembershipRejectedEmail,
  buildProfileChangeApprovedEmail,
  buildProfileChangeRejectedEmail,
} from "@/lib/notifications/email-builders";

type MembershipApplicationRow =
  Database["public"]["Tables"]["membership_applications"]["Row"];
type MemberInvitationRow =
  Database["public"]["Tables"]["member_invitations"]["Row"];
type ProfileUpdateRequestRow =
  Database["public"]["Tables"]["profile_update_requests"]["Row"];

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
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

async function resolveApprovedMemberId(
  admin: ReturnType<typeof createAdminClient>,
  application: MembershipApplicationRow,
  overrideId: string
) {
  if (application.processed_member_id) {
    const { data: existingMember } = await admin
      .from("members")
      .select("id, jnuits_id")
      .eq("id", application.processed_member_id)
      .maybeSingle();

    if (existingMember) {
      return existingMember;
    }
  }

  const { data: memberForEmail } = await admin
    .from("members")
    .select("id, jnuits_id")
    .eq("email", application.email)
    .maybeSingle();

  if (memberForEmail) {
    return memberForEmail;
  }

  const normalizedOverride = normalizeJnuitsIdForCreation(overrideId);

  if (overrideId && !normalizedOverride) {
    throw new Error(
      "Manual JnUITS ID overrides must use the JNUITS-<number> format."
    );
  }

  if (normalizedOverride) {
    const { data: memberForId } = await admin
      .from("members")
      .select("id, jnuits_id")
      .eq("jnuits_id", normalizedOverride)
      .maybeSingle();

    if (memberForId) {
      throw new Error(`JnUITS ID ${normalizedOverride} is already assigned.`);
    }
  }

  const { data: existingMemberIds } = await admin
    .from("members")
    .select("jnuits_id");

  const generatedId =
    normalizedOverride ||
    buildGeneratedJnuitsId(
      (existingMemberIds || [])
        .map((member) => member.jnuits_id)
        .filter((value): value is string => typeof value === "string")
    );

  const { data: createdMember, error: memberError } = await admin
    .from("members")
    .insert({
      jnuits_id: generatedId,
      full_name: application.name,
      email: application.email,
      phone: application.phone,
      department_code: application.department_code,
      batch_no: extractBatchNumber(application.batch_label),
      member_type: "current",
      linkedin_url: application.linkedin_url,
      professional_visibility: "members-only",
    })
    .select("id, jnuits_id")
    .single();

  if (memberError || !createdMember) {
    throw new Error(memberError?.message || "Unable to create the member record.");
  }

  return createdMember;
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
  const auth = await requireAdminUser();
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login");
  }
  const applicationId = asString(formData.get("applicationId"));
  const reviewNote = asString(formData.get("reviewNote"));
  const jnuitsIdOverride = asString(formData.get("jnuitsIdOverride"));
  const maxUses = Math.max(1, Number.parseInt(asString(formData.get("maxUses")) || "1", 10) || 1);
  const expiryDays = Math.max(
    1,
    Number.parseInt(
      asString(formData.get("invitationExpiresInDays")) ||
        String(DEFAULT_INVITATION_EXPIRY_DAYS),
      10
    ) || DEFAULT_INVITATION_EXPIRY_DAYS
  );

  if (!applicationId) {
    await setAdminFlash({
      tone: "error",
      title: "Application approval failed",
      message: "The application identifier is missing.",
    });
    redirect("/admin");
  }

  const admin = createAdminClient();
  const applicationResult = await loadPendingApplication(applicationId);
  const application = applicationResult.data;

  if (applicationResult.error || !application) {
    await setAdminFlash({
      tone: "error",
      title: "Application approval failed",
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

  try {
    const member = await resolveApprovedMemberId(admin, application, jnuitsIdOverride);
    const nowIso = new Date().toISOString();
    const invitation = await issueFreshInvitation(admin, {
      actorUserId,
      expiryDays,
      maxUses,
      memberId: member.id,
      notes: reviewNote || "Generated from membership application approval.",
    });

    const { error: applicationUpdateError } = await admin
      .from("membership_applications")
      .update({
        status: "approved",
        review_note: reviewNote || null,
        reviewed_at: nowIso,
        reviewed_by_user_id: actorUserId,
        processed_member_id: member.id,
        invitation_id: invitation.invitationId,
      })
      .eq("id", application.id);

    if (applicationUpdateError) {
      throw new Error(applicationUpdateError.message);
    }

    await admin.from("membership_lifecycle_events").insert({
      member_id: member.id,
      event_type: "application_approved",
      summary: "Membership application approved and invitation generated.",
      created_by_user_id: actorUserId,
      metadata: {
        applicationId: application.id,
        invitationId: invitation.invitationId,
        jnuitsId: member.jnuits_id,
        batchLabel: application.batch_label,
        studentId: application.student_id,
      },
    });

    await admin.from("audit_events").insert([
      {
        actor_user_id: actorUserId,
        action: "membership.application_approved",
        entity_type: "membership_application",
        entity_id: application.id,
        metadata: {
          memberId: member.id,
          invitationId: invitation.invitationId,
          jnuitsId: member.jnuits_id,
        },
      },
      {
        actor_user_id: actorUserId,
        action: "member.invitation_generated",
        entity_type: "member_invitation",
        entity_id: invitation.invitationId,
        metadata: {
          applicationId: application.id,
          memberId: member.id,
          expiresAt: invitation.expiresAt,
          maxUses,
        },
      },
    ]);

    revalidatePath("/admin");
    await setAdminFlash({
      tone: "success",
      title: "Application approved",
      message: `${application.name} is now ready to claim a member profile.`,
      invitationCode: invitation.code,
      jnuitsId: member.jnuits_id,
    });

    // Non-blocking notification — failure must never crash this action
    void sendEmail({
      to: application.email,
      subject: "Your JnUITS membership application has been approved",
      html: buildMembershipApprovedEmail({
        applicantName: application.name,
        jnuitsId: member.jnuits_id,
        invitationCode: invitation.code,
        invitationExpiresAt: invitation.expiresAt,
      }),
    });
  } catch (error) {
    await setAdminFlash({
      tone: "error",
      title: "Application approval failed",
      message:
        error instanceof Error
          ? error.message
          : "The invitation workflow could not be completed.",
    });
  }

  redirect("/admin");
}

export async function rejectMembershipApplication(formData: FormData) {
  const auth = await requireAdminUser();
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login");
  }
  const applicationId = asString(formData.get("applicationId"));
  const reviewNote = asString(formData.get("reviewNote"));

  if (!applicationId) {
    await setAdminFlash({
      tone: "error",
      title: "Application rejection failed",
      message: "The application identifier is missing.",
    });
    redirect("/admin");
  }

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
      message: error.message,
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
  const auth = await requireAdminUser();
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login");
  }

  const invitationId = asString(formData.get("invitationId"));
  const reviewNote = asString(formData.get("reviewNote"));

  if (!invitationId) {
    await setAdminFlash({
      tone: "error",
      title: "Invitation revocation failed",
      message: "The invitation identifier is missing.",
    });
    redirect("/admin#invitations");
  }

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
    .select("id, jnuits_id, full_name")
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
      message: error.message,
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
  const auth = await requireAdminUser();
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login");
  }

  const invitationId = asString(formData.get("invitationId"));
  const reviewNote = asString(formData.get("reviewNote"));
  const maxUses = Math.max(1, Number.parseInt(asString(formData.get("maxUses")) || "1", 10) || 1);
  const expiryDays = Math.max(
    1,
    Number.parseInt(
      asString(formData.get("invitationExpiresInDays")) ||
        String(DEFAULT_INVITATION_EXPIRY_DAYS),
      10
    ) || DEFAULT_INVITATION_EXPIRY_DAYS
  );

  if (!invitationId) {
    await setAdminFlash({
      tone: "error",
      title: "Invitation reissue failed",
      message: "The invitation identifier is missing.",
    });
    redirect("/admin#invitations");
  }

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
    .select("id, jnuits_id, full_name")
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
        message: revokeError.message,
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
  } catch (error) {
    await setAdminFlash({
      tone: "error",
      title: "Invitation reissue failed",
      message:
        error instanceof Error
          ? error.message
          : "A replacement invitation could not be issued.",
    });
  }

  redirect("/admin#invitations");
}

export async function approveWorkplaceUpdateRequest(formData: FormData) {
  const auth = await requireAdminUser();
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login");
  }

  const requestId = asString(formData.get("requestId"));
  const reviewNote = asString(formData.get("reviewNote"));

  if (!requestId) {
    await setAdminFlash({
      tone: "error",
      title: "Workplace approval failed",
      message: "The workplace request identifier is missing.",
    });
    redirect("/admin#workplace");
  }

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
      message: memberError.message,
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
      message: requestError.message,
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
  await setAdminFlash({
    tone: "success",
    title: "Workplace request approved",
    message: `${member.full_name}'s workplace profile has been updated.`,
    jnuitsId: member.jnuits_id,
  });
  redirect("/admin#workplace");
}

export async function rejectWorkplaceUpdateRequest(formData: FormData) {
  const auth = await requireAdminUser();
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login");
  }

  const requestId = asString(formData.get("requestId"));
  const reviewNote = asString(formData.get("reviewNote"));

  if (!requestId) {
    await setAdminFlash({
      tone: "error",
      title: "Workplace rejection failed",
      message: "The workplace request identifier is missing.",
    });
    redirect("/admin#workplace");
  }

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
      message: error.message,
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
  const auth = await requireAdminUser();
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login");
  }

  const requestId = asString(formData.get("requestId"));
  const reviewNote = asString(formData.get("reviewNote"));

  if (!requestId) {
    await setAdminFlash({
      tone: "error",
      title: "Profile approval failed",
      message: "The profile change request identifier is missing.",
    });
    redirect("/admin#profile-requests");
  }

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

  if (request.request_type !== "profile_change") {
    await setAdminFlash({
      tone: "error",
      title: "Unsupported request type",
      message: "Only profile change requests can be approved from this queue.",
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
  const linkedinUrl =
    typeof payload.linkedinUrl === "string" && payload.linkedinUrl.trim()
      ? payload.linkedinUrl.trim()
      : null;
  const websiteUrl =
    typeof payload.websiteUrl === "string" && payload.websiteUrl.trim()
      ? payload.websiteUrl.trim()
      : null;

  if (!fullName && !phone && !linkedinUrl && !websiteUrl) {
    await setAdminFlash({
      tone: "error",
      title: "Profile approval failed",
      message: "This request does not contain any valid profile fields.",
    });
    redirect("/admin#profile-requests");
  }

  const { data: member } = await admin
    .from("members")
    .select("id, full_name, jnuits_id")
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
  const changedFields = [
    fullName ? "full_name" : null,
    phone ? "phone" : null,
    linkedinUrl ? "linkedin_url" : null,
    websiteUrl ? "website_url" : null,
  ].filter((value): value is string => Boolean(value));

  const { error: memberError } = await admin
    .from("members")
    .update({
      full_name: fullName || member.full_name,
      linkedin_url: linkedinUrl,
      phone,
      updated_at: nowIso,
      website_url: websiteUrl,
    })
    .eq("id", member.id);

  if (memberError) {
    await setAdminFlash({
      tone: "error",
      title: "Profile approval failed",
      message: memberError.message,
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
      message: requestError.message,
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
  revalidatePath("/profile");
  revalidatePath("/profile/edit");
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
  const auth = await requireAdminUser();
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login");
  }

  const requestId = asString(formData.get("requestId"));
  const reviewNote = asString(formData.get("reviewNote"));

  if (!requestId) {
    await setAdminFlash({
      tone: "error",
      title: "Profile rejection failed",
      message: "The profile change request identifier is missing.",
    });
    redirect("/admin#profile-requests");
  }

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
      message: error.message,
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
