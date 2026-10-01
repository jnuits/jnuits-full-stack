"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSafeAdminActionErrorMessage } from "@/lib/admin/action-error";
import { requireAdminPermission } from "@/lib/auth/session";
import {
  formatOnboardingRowIssue,
  type ExistingDepartmentSnapshot,
  type ExistingMemberSnapshot,
} from "@/lib/committee/onboarding/normalize-draft";
import {
  buildMemberProfileEditDecision,
  memberClassification,
} from "@/lib/members/profile-edit";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";

const boundedText = (maximum: number) => z.string().trim().max(maximum);
const memberProfileRequestSchema = z.object({
  auditNote: boundedText(1_000).optional().default(""),
  batchNo: boundedText(20).optional().default(""),
  departmentCode: boundedText(40).optional().default(""),
  expectedUpdatedAt: z.string().trim().min(1).max(80),
  facebookUrl: boundedText(500).optional().default(""),
  fullName: z.string().trim().min(1, "Full name is required.").max(180),
  joinedOn: boundedText(10).optional().default(""),
  linkedinUrl: boundedText(500).optional().default(""),
  memberId: z.string().uuid(),
  phone: boundedText(60).optional().default(""),
  studentId: boundedText(80).optional().default(""),
  websiteUrl: boundedText(500).optional().default(""),
});

type MemberRow = {
  batch_no: null | number;
  department_code: null | string;
  email: null | string;
  facebook_url: null | string;
  full_name: string;
  id: string;
  jnuits_id: string;
  joined_on: null | string;
  lifecycle_status: null | string;
  linkedin_url: null | string;
  member_type: null | string;
  phone: null | string;
  student_id: null | string;
  updated_at: string;
  website_url: null | string;
};

export type MemberProfileActionMember = {
  batchNo: null | number;
  departmentCode: null | string;
  email: string;
  expectedUpdatedAt: string;
  facebookUrl: null | string;
  fullName: string;
  id: string;
  jnuitsId: string;
  joinedOn: null | string;
  lifecycleStatus: string;
  linkedinUrl: null | string;
  phone: null | string;
  studentId: null | string;
  websiteUrl: null | string;
};

export type MemberProfileActionResult =
  | {
      changedFields: string[];
      member: MemberProfileActionMember;
      message: string;
      ok: true;
    }
  | { message: string; ok: false };

const memberSelect =
  "id, jnuits_id, full_name, email, member_type, lifecycle_status, department_code, batch_no, joined_on, phone, student_id, facebook_url, linkedin_url, website_url, updated_at";

function safeProfileError(error: unknown, context: string, fallback: string) {
  return getSafeAdminActionErrorMessage(error, {
    context: `membership.profile.${context}`,
    fallback,
  });
}

function asSnapshot(member: MemberRow): ExistingMemberSnapshot {
  return {
    batchNo: member.batch_no,
    departmentCode: member.department_code,
    email: member.email,
    facebookUrl: member.facebook_url,
    fullName: member.full_name,
    id: member.id,
    jnuitsId: member.jnuits_id,
    joinedOn: member.joined_on,
    lifecycleStatus: member.lifecycle_status || "current",
    linkedinUrl: member.linkedin_url,
    memberType: member.member_type || "current",
    phone: member.phone,
    studentId: member.student_id,
    updatedAt: member.updated_at,
    websiteUrl: member.website_url,
  };
}

function toActionMember(member: MemberRow): MemberProfileActionMember {
  const snapshot = asSnapshot(member);
  return {
    batchNo: member.batch_no,
    departmentCode: member.department_code,
    email: member.email || "",
    expectedUpdatedAt: member.updated_at,
    facebookUrl: member.facebook_url,
    fullName: member.full_name,
    id: member.id,
    jnuitsId: member.jnuits_id,
    joinedOn: member.joined_on,
    lifecycleStatus: memberClassification(snapshot),
    linkedinUrl: member.linkedin_url,
    phone: member.phone,
    studentId: member.student_id,
    websiteUrl: member.website_url,
  };
}

export async function updateMemberProfileAction(
  input: unknown
): Promise<MemberProfileActionResult> {
  const auth = await requireAdminPermission("admin.membership.manage", {
    fallbackPath: "/admin/membership",
  });
  const actorUserId = auth.user?.id;
  if (!actorUserId) return { message: "Your admin session has expired.", ok: false };

  const parsed = memberProfileRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      message: parsed.error.issues[0]?.message || "Review the member profile values.",
      ok: false,
    };
  }

  const admin = createAdminClient();
  const flexibleAdmin = asFlexibleClient(admin);
  const { data, error } = await flexibleAdmin
    .from("members" as string)
    .select(memberSelect)
    .eq("id", parsed.data.memberId)
    .maybeSingle();
  const member = data as MemberRow | null;

  if (error || !member) {
    return {
      message: error
        ? safeProfileError(error, "load", "Unable to load the member profile.")
        : "The member profile no longer exists.",
      ok: false,
    };
  }
  if (member.updated_at !== parsed.data.expectedUpdatedAt) {
    return {
      message: "This member changed after the editor opened. Reload and review the latest values.",
      ok: false,
    };
  }

  const { data: departmentData, error: departmentError } = await flexibleAdmin
    .from("departments" as string)
    .select("code, name, short_code")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (departmentError) {
    return {
      message: safeProfileError(
        departmentError,
        "departments",
        "Unable to load the active department codes."
      ),
      ok: false,
    };
  }
  const departments: ExistingDepartmentSnapshot[] = (
    (departmentData ?? []) as Array<{
      code: string;
      name: string;
      short_code: string;
    }>
  ).map((department) => ({
    aliases: [],
    internalCode: department.code,
    name: department.name,
    shortCode: department.short_code,
  }));

  const decision = buildMemberProfileEditDecision({
    departments,
    existing: asSnapshot(member),
    values: {
      batchNo: parsed.data.batchNo,
      departmentCode: parsed.data.departmentCode,
      facebookUrl: parsed.data.facebookUrl,
      fullName: parsed.data.fullName,
      joinedOn: parsed.data.joinedOn,
      linkedinUrl: parsed.data.linkedinUrl,
      phone: parsed.data.phone,
      studentId: parsed.data.studentId,
      websiteUrl: parsed.data.websiteUrl,
    },
  });
  if (decision.errors.length > 0) {
    return {
      message: decision.errors[0]
        ? formatOnboardingRowIssue(decision.errors[0])
        : "Profile validation failed.",
      ok: false,
    };
  }

  const changedFields = Object.keys(decision.patch).sort();
  if (changedFields.length === 0) {
    return {
      changedFields,
      member: toActionMember(member),
      message: "No profile fields changed.",
      ok: true,
    };
  }

  const { data: updatedData, error: updateError } = await flexibleAdmin
    .from("members" as string)
    .update(decision.patch)
    .eq("id", member.id)
    .eq("updated_at", member.updated_at)
    .select(memberSelect)
    .maybeSingle();
  const updated = updatedData as MemberRow | null;

  if (updateError || !updated) {
    return {
      message: updateError
        ? safeProfileError(updateError, "update", "Unable to update the member profile.")
        : "This member changed before the update completed. Reload and try again.",
      ok: false,
    };
  }

  const { error: auditError } = await admin.from("audit_events").insert({
    action: "member.profile_updated",
    actor_user_id: actorUserId,
    entity_id: member.id,
    entity_type: "member",
    metadata: {
      changedFields,
      note: parsed.data.auditNote || null,
      previousUpdatedAt: member.updated_at,
      updatedAt: updated.updated_at,
    },
  });
  if (auditError) {
    return {
      message: safeProfileError(
        auditError,
        "audit",
        "The profile changed, but its audit entry could not be confirmed."
      ),
      ok: false,
    };
  }

  revalidatePath("/admin/membership");
  revalidatePath("/members");
  revalidatePath("/members/[jnuitsId]", "page");
  return {
    changedFields,
    member: toActionMember(updated),
    message: "Member profile updated.",
    ok: true,
  };
}
