"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Database } from "@/lib/db/types";
import { requireAdminUser } from "@/lib/auth/session";
import { ADMIN_FLASH_COOKIE_NAME, type AdminFlash } from "@/lib/admin/flash";
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

type MembershipApplicationRow =
  Database["public"]["Tables"]["membership_applications"]["Row"];

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

async function setAdminFlash(payload: AdminFlash) {
  const cookieStore = await cookies();

  cookieStore.set(
    ADMIN_FLASH_COOKIE_NAME,
    JSON.stringify(payload),
    {
      httpOnly: true,
      maxAge: 180,
      path: "/admin",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    }
  );
}

async function loadPendingApplication(applicationId: string) {
  const admin = createAdminClient();

  return admin
    .from("membership_applications")
    .select("*")
    .eq("id", applicationId)
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
    const invitation = await getNextInvitationCode(admin);
    const expiresAt = getInvitationExpiryIso(expiryDays);
    const nowIso = new Date().toISOString();

    const { data: invitationRow, error: invitationError } = await admin
      .from("member_invitations")
      .insert({
        member_id: member.id,
        code_hash: invitation.codeHash,
        expires_at: expiresAt,
        max_uses: maxUses,
        notes: reviewNote || "Generated from membership application approval.",
        created_by_user_id: actorUserId,
      })
      .select("id")
      .single();

    if (invitationError || !invitationRow) {
      throw new Error(invitationError?.message || "Unable to create the invitation.");
    }

    const { error: applicationUpdateError } = await admin
      .from("membership_applications")
      .update({
        status: "approved",
        review_note: reviewNote || null,
        reviewed_at: nowIso,
        reviewed_by_user_id: actorUserId,
        processed_member_id: member.id,
        invitation_id: invitationRow.id,
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
        invitationId: invitationRow.id,
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
          invitationId: invitationRow.id,
          jnuitsId: member.jnuits_id,
        },
      },
      {
        actor_user_id: actorUserId,
        action: "member.invitation_generated",
        entity_type: "member_invitation",
        entity_id: invitationRow.id,
        metadata: {
          applicationId: application.id,
          memberId: member.id,
          expiresAt,
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
  redirect("/admin");
}
