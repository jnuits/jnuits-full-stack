"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { setAdminFlash } from "@/lib/admin/flash";
import { requireAdminPermission } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

const booleanStringSchema = z
  .enum(["true", "false"])
  .optional()
  .default("false")
  .transform((value) => value === "true");

const committeeTermStatusSchema = z.enum(["draft", "upcoming", "active", "archived"]);
const committeeTermKindSchema = z.enum(["executive", "advisor_board"]).optional().default("executive");
const dateConfidenceSchema = z.enum(["verified", "estimated"]).optional().default("verified");
const committeeAssignmentStatusSchema = z.enum(["planned", "active", "completed"]);
const advisorTypeSchema = z.enum(["main_advisor", "moderator_mentor", "honorable_advisor"]);

const committeeTermSchema = z.object({
  dateConfidence: dateConfidenceSchema,
  electionDate: z.string().trim().max(40).optional().default(""),
  endsOn: z.string().trim().max(40).optional().default(""),
  isCurrent: booleanStringSchema,
  isPublic: booleanStringSchema,
  slug: z.string().trim().max(120).optional().default(""),
  startsOn: z.string().trim().min(1, "Start date is required.").max(40),
  status: committeeTermStatusSchema.optional().default("draft"),
  summary: z.string().trim().max(1000).optional().default(""),
  targetExecutiveSlots: z.coerce.number().int().min(1).max(60).optional().default(21),
  tenureNote: z.string().trim().max(1000).optional().default(""),
  termId: z.string().trim().max(80).optional().default(""),
  termKind: committeeTermKindSchema,
  termNumber: z.coerce.number().int().min(1).max(100).optional().nullable(),
  title: z.string().trim().min(1, "Title is required.").max(180),
  voterRuleNote: z.string().trim().max(1000).optional().default(""),
});

const committeeAssignmentSchema = z
  .object({
    assignmentId: z.string().trim().max(80).optional().default(""),
    bio: z.string().trim().max(2500).optional().default(""),
    displayName: z.string().trim().max(180).optional().default(""),
    endsOn: z.string().trim().max(40).optional().default(""),
    isPublic: booleanStringSchema,
    memberId: z.string().trim().max(80).optional().default(""),
    publicTitleOverride: z.string().trim().max(180).optional().default(""),
    roleId: z.string().trim().min(1, "Role is required.").max(80),
    sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(100),
    startsOn: z.string().trim().max(40).optional().default(""),
    status: committeeAssignmentStatusSchema.optional().default("active"),
    termId: z.string().trim().min(1, "Term is required.").max(80),
  })
  .refine((value) => Boolean(value.memberId || value.displayName), {
    message: "Provide either a linked member or a display name.",
    path: ["displayName"],
  });

const advisorProfileSchema = z.object({
  advisorId: z.string().trim().max(80).optional().default(""),
  advisorType: advisorTypeSchema,
  avatarSecureUrl: z.string().trim().url().or(z.literal("")).optional().default(""),
  bio: z.string().trim().max(5000).optional().default(""),
  department: z.string().trim().max(180).optional().default(""),
  designation: z.string().trim().max(180).optional().default(""),
  email: z.string().trim().email().or(z.literal("")).optional().default(""),
  facebookUrl: z.string().trim().url().or(z.literal("")).optional().default(""),
  fullName: z.string().trim().min(1, "Advisor name is required.").max(180),
  isCurrent: booleanStringSchema,
  isPublic: booleanStringSchema,
  joinedOn: z.string().trim().max(40).optional().default(""),
  leftOn: z.string().trim().max(40).optional().default(""),
  linkedinUrl: z.string().trim().url().or(z.literal("")).optional().default(""),
  phone: z.string().trim().max(60).optional().default(""),
  publications: z.string().trim().max(6000).optional().default(""),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(100),
  speech: z.string().trim().max(5000).optional().default(""),
  title: z.string().trim().max(80).optional().default(""),
  userId: z.string().trim().max(80).optional().default(""),
  websiteUrl: z.string().trim().url().or(z.literal("")).optional().default(""),
  workExperience: z.string().trim().max(6000).optional().default(""),
});

const idSchema = z.object({
  assignmentId: z.string().trim().min(1).max(80).optional(),
  termId: z.string().trim().min(1).max(80).optional(),
});

const rolloverCommitteeTermSchema = committeeTermSchema.extend({
  assignmentStatus: committeeAssignmentStatusSchema.optional().default("planned"),
  carryAssignments: booleanStringSchema,
  closeSourceTerm: booleanStringSchema,
  sourceTermId: z.string().trim().min(1, "Source term is required.").max(80),
  status: committeeTermStatusSchema.optional().default("upcoming"),
});

function pickFormFields(formData: FormData, fields: string[]) {
  return Object.fromEntries(
    fields.map((field) => [field, asString(formData.get(field))])
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function toPreviousDay(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function listToJson(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function requireCommitteeAdmin() {
  const auth = await requireAdminPermission("admin.committee.manage", {
    fallbackPath: "/admin/committee",
  });
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/admin/login");
  }

  return actorUserId;
}

export async function saveCommitteeTerm(formData: FormData) {
  const actorUserId = await requireCommitteeAdmin();
  const admin = createAdminClient();
  const parsed = committeeTermSchema.safeParse(
    pickFormFields(formData, [
      "termId",
      "title",
      "slug",
      "summary",
      "startsOn",
      "endsOn",
      "status",
      "isPublic",
      "termNumber",
      "termKind",
      "electionDate",
      "isCurrent",
      "dateConfidence",
      "tenureNote",
      "targetExecutiveSlots",
      "voterRuleNote",
    ])
  );

  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "Committee term not saved",
      message: parsed.error.issues[0]?.message || "Title, slug, and start date are required.",
    });
    redirect("/admin/committee");
  }

  const {
    dateConfidence,
    electionDate,
    endsOn,
    isCurrent,
    isPublic,
    startsOn,
    status,
    summary,
    targetExecutiveSlots,
    tenureNote,
    termId,
    termKind,
    termNumber,
    title,
    voterRuleNote,
  } = parsed.data;
  const slug = slugify(parsed.data.slug || title);

  if (!slug) {
    await setAdminFlash({
      tone: "error",
      title: "Committee term not saved",
      message: "Title or slug must produce a valid public slug.",
    });
    redirect("/admin/committee");
  }

  if (isCurrent && termKind === "executive") {
    await admin
      .from("committee_terms")
      .update({ is_current: false })
      .eq("term_kind", "executive")
      .neq("id", termId || "00000000-0000-0000-0000-000000000000");
  }

  const payload = {
    created_by_user_id: actorUserId,
    date_confidence: dateConfidence,
    election_date: electionDate || null,
    ends_on: endsOn || null,
    is_current: isCurrent,
    is_public: isPublic,
    slug,
    starts_on: startsOn,
    status,
    summary: summary || null,
    target_executive_slots: targetExecutiveSlots,
    tenure_note: tenureNote || null,
    term_kind: termKind,
    term_number: termNumber || null,
    title,
    voter_rule_note: voterRuleNote || null,
  };

  const query = termId
    ? admin.from("committee_terms").update(payload).eq("id", termId).select("id").single()
    : admin.from("committee_terms").insert(payload).select("id").single();

  const { data, error } = await query;

  if (error || !data) {
    await setAdminFlash({
      tone: "error",
      title: "Committee term not saved",
      message: error?.message || "Unable to save the committee term.",
    });
    redirect("/admin/committee");
  }

  await admin.from("audit_events").insert({
    actor_user_id: actorUserId,
    action: termId ? "committee.term_updated" : "committee.term_created",
    entity_type: "committee_term",
    entity_id: data.id,
    metadata: {
      isCurrent,
      isPublic,
      slug,
      status,
      termKind,
      termNumber,
      title,
    },
  });

  revalidatePath("/admin/committee");
  revalidatePath("/committee");
  await setAdminFlash({
    tone: "success",
    title: termId ? "Committee term updated" : "Committee term created",
    message: `${title} is now saved in the committee model.`,
  });
  redirect("/admin/committee");
}

export async function setCommitteeTermCurrent(formData: FormData) {
  const actorUserId = await requireCommitteeAdmin();
  const admin = createAdminClient();
  const parsed = idSchema.safeParse(pickFormFields(formData, ["termId"]));
  const termId = parsed.success ? parsed.data.termId : null;

  if (!termId) {
    redirect("/admin/committee");
  }

  await admin.from("committee_terms").update({ is_current: false }).eq("term_kind", "executive");
  const { error } = await admin
    .from("committee_terms")
    .update({ is_current: true, status: "active", term_kind: "executive", is_public: true })
    .eq("id", termId);

  if (error) {
    await setAdminFlash({
      tone: "error",
      title: "Current committee not changed",
      message: error.message,
    });
    redirect("/admin/committee");
  }

  await admin.from("audit_events").insert({
    actor_user_id: actorUserId,
    action: "committee.term_set_current",
    entity_type: "committee_term",
    entity_id: termId,
    metadata: {},
  });

  revalidatePath("/admin/committee");
  revalidatePath("/committee");
  await setAdminFlash({
    tone: "success",
    title: "Current committee updated",
    message: "The public committee page now prioritizes the selected executive committee.",
  });
  redirect("/admin/committee");
}

export async function saveCommitteeAssignment(formData: FormData) {
  const actorUserId = await requireCommitteeAdmin();
  const admin = createAdminClient();
  const parsed = committeeAssignmentSchema.safeParse(
    pickFormFields(formData, [
      "assignmentId",
      "bio",
      "displayName",
      "endsOn",
      "isPublic",
      "memberId",
      "publicTitleOverride",
      "roleId",
      "sortOrder",
      "startsOn",
      "status",
      "termId",
    ])
  );

  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "Committee assignment not saved",
      message:
        parsed.error.issues[0]?.message ||
        "Select both a term and a role before saving an assignment.",
    });
    redirect("/admin/committee");
  }

  const {
    assignmentId,
    bio,
    displayName,
    endsOn,
    isPublic,
    memberId,
    publicTitleOverride,
    roleId,
    sortOrder,
    startsOn,
    status,
    termId,
  } = parsed.data;

  const payload = {
    bio: bio || null,
    created_by_user_id: actorUserId,
    display_name: displayName || null,
    ends_on: endsOn || null,
    is_public: isPublic,
    member_id: memberId || null,
    public_title_override: publicTitleOverride || null,
    role_id: roleId,
    sort_order: sortOrder,
    source: "admin",
    starts_on: startsOn || null,
    status,
    term_id: termId,
  };

  const query = assignmentId
    ? admin
        .from("committee_assignments")
        .update(payload)
        .eq("id", assignmentId)
        .select("id")
        .single()
    : admin
        .from("committee_assignments")
        .insert(payload)
        .select("id")
        .single();

  const { data, error } = await query;

  if (error || !data) {
    await setAdminFlash({
      tone: "error",
      title: "Committee assignment not saved",
      message: error?.message || "Unable to save the committee assignment.",
    });
    redirect("/admin/committee");
  }

  await admin.from("audit_events").insert({
    actor_user_id: actorUserId,
    action: assignmentId
      ? "committee.assignment_updated"
      : "committee.assignment_created",
    entity_type: "committee_assignment",
    entity_id: data.id,
    metadata: {
      isPublic,
      memberId: memberId || null,
      roleId,
      status,
      termId,
    },
  });

  revalidatePath("/admin/committee");
  revalidatePath("/committee");
  await setAdminFlash({
    tone: "success",
    title: assignmentId
      ? "Committee assignment updated"
      : "Committee assignment created",
    message: "The committee roster change is now saved.",
  });
  redirect("/admin/committee");
}

export async function removeCommitteeAssignment(formData: FormData) {
  const actorUserId = await requireCommitteeAdmin();
  const admin = createAdminClient();
  const parsed = idSchema.safeParse(pickFormFields(formData, ["assignmentId"]));
  const assignmentId = parsed.success ? parsed.data.assignmentId : null;

  if (!assignmentId) {
    redirect("/admin/committee");
  }

  const { error } = await admin.from("committee_assignments").delete().eq("id", assignmentId);

  if (error) {
    await setAdminFlash({
      tone: "error",
      title: "Committee assignment not removed",
      message: error.message,
    });
    redirect("/admin/committee");
  }

  await admin.from("audit_events").insert({
    actor_user_id: actorUserId,
    action: "committee.assignment_removed",
    entity_type: "committee_assignment",
    entity_id: assignmentId,
    metadata: {},
  });

  revalidatePath("/admin/committee");
  revalidatePath("/committee");
  await setAdminFlash({
    tone: "success",
    title: "Committee assignment removed",
    message: "The roster entry was removed.",
  });
  redirect("/admin/committee");
}

export async function saveAdvisorProfile(formData: FormData) {
  const actorUserId = await requireCommitteeAdmin();
  const admin = createAdminClient();
  const parsed = advisorProfileSchema.safeParse(
    pickFormFields(formData, [
      "advisorId",
      "advisorType",
      "avatarSecureUrl",
      "bio",
      "department",
      "designation",
      "email",
      "facebookUrl",
      "fullName",
      "isCurrent",
      "isPublic",
      "joinedOn",
      "leftOn",
      "linkedinUrl",
      "phone",
      "publications",
      "sortOrder",
      "speech",
      "title",
      "userId",
      "websiteUrl",
      "workExperience",
    ])
  );

  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "Advisor profile not saved",
      message: parsed.error.issues[0]?.message || "Advisor name and type are required.",
    });
    redirect("/admin/committee");
  }

  const {
    advisorId,
    advisorType,
    avatarSecureUrl,
    bio,
    department,
    designation,
    email,
    facebookUrl,
    fullName,
    isCurrent,
    isPublic,
    joinedOn,
    leftOn,
    linkedinUrl,
    phone,
    publications,
    sortOrder,
    speech,
    title,
    userId,
    websiteUrl,
    workExperience,
  } = parsed.data;

  const payload = {
    advisor_type: advisorType,
    avatar_secure_url: avatarSecureUrl || null,
    bio: bio || null,
    created_by_user_id: actorUserId,
    department: department || null,
    designation: designation || null,
    email: email || null,
    facebook_url: facebookUrl || null,
    full_name: fullName,
    is_current: isCurrent,
    is_public: isPublic,
    joined_on: joinedOn || null,
    left_on: leftOn || null,
    linkedin_url: linkedinUrl || null,
    phone: phone || null,
    publications: listToJson(publications),
    sort_order: sortOrder,
    speech: speech || null,
    title: title || null,
    user_id: userId || null,
    website_url: websiteUrl || null,
    work_experience: listToJson(workExperience),
  };

  const query = advisorId
    ? admin.from("advisor_profiles").update(payload).eq("id", advisorId).select("id").single()
    : admin.from("advisor_profiles").insert(payload).select("id").single();

  const { data, error } = await query;

  if (error || !data) {
    await setAdminFlash({
      tone: "error",
      title: "Advisor profile not saved",
      message: error?.message || "Unable to save advisor profile.",
    });
    redirect("/admin/committee");
  }

  await admin.from("audit_events").insert({
    actor_user_id: actorUserId,
    action: advisorId ? "committee.advisor_updated" : "committee.advisor_created",
    entity_type: "advisor_profile",
    entity_id: data.id,
    metadata: {
      advisorType,
      isCurrent,
      isPublic,
      userId: userId || null,
    },
  });

  revalidatePath("/admin/committee");
  revalidatePath("/committee");
  await setAdminFlash({
    tone: "success",
    title: advisorId ? "Advisor profile updated" : "Advisor profile created",
    message: `${fullName} is now saved in the advisor board.`,
  });
  redirect("/admin/committee");
}

export async function rolloverCommitteeTerm(formData: FormData) {
  const actorUserId = await requireCommitteeAdmin();
  const admin = createAdminClient();
  const parsed = rolloverCommitteeTermSchema.safeParse(
    pickFormFields(formData, [
      "sourceTermId",
      "title",
      "slug",
      "summary",
      "startsOn",
      "endsOn",
      "status",
      "isPublic",
      "termNumber",
      "termKind",
      "electionDate",
      "isCurrent",
      "dateConfidence",
      "tenureNote",
      "targetExecutiveSlots",
      "voterRuleNote",
      "carryAssignments",
      "closeSourceTerm",
      "assignmentStatus",
    ])
  );

  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "Committee rollover failed",
      message:
        parsed.error.issues[0]?.message ||
        "Choose a source term, title, slug, and new start date.",
    });
    redirect("/admin/committee");
  }

  const {
    assignmentStatus,
    carryAssignments,
    closeSourceTerm,
    dateConfidence,
    electionDate,
    endsOn,
    isCurrent,
    isPublic,
    sourceTermId,
    startsOn,
    status,
    summary,
    targetExecutiveSlots,
    tenureNote,
    termKind,
    termNumber,
    title,
    voterRuleNote,
  } = parsed.data;
  const slug = slugify(parsed.data.slug || title);

  if (!slug) {
    await setAdminFlash({
      tone: "error",
      title: "Committee rollover failed",
      message: "Title or slug must produce a valid public slug.",
    });
    redirect("/admin/committee");
  }

  const { data: sourceTerm, error: sourceError } = await admin
    .from("committee_terms")
    .select("id, title, slug, summary, starts_on, ends_on, status")
    .eq("id", sourceTermId)
    .maybeSingle();

  if (sourceError || !sourceTerm) {
    await setAdminFlash({
      tone: "error",
      title: "Committee rollover failed",
      message: "The source committee term could not be loaded.",
    });
    redirect("/admin/committee");
  }

  if (isCurrent && termKind === "executive") {
    await admin.from("committee_terms").update({ is_current: false }).eq("term_kind", "executive");
  }

  const { data: newTerm, error: insertError } = await admin
    .from("committee_terms")
    .insert({
      created_by_user_id: actorUserId,
      date_confidence: dateConfidence,
      election_date: electionDate || null,
      ends_on: endsOn || null,
      is_current: isCurrent,
      is_public: isPublic,
      rollover_source_term_id: sourceTerm.id,
      slug,
      starts_on: startsOn,
      status,
      summary: summary || sourceTerm.summary,
      target_executive_slots: targetExecutiveSlots,
      tenure_note: tenureNote || null,
      term_kind: termKind,
      term_number: termNumber || null,
      title,
      voter_rule_note: voterRuleNote || null,
    })
    .select("id")
    .single();

  if (insertError || !newTerm) {
    await setAdminFlash({
      tone: "error",
      title: "Committee rollover failed",
      message: insertError?.message || "Unable to create the rollover term.",
    });
    redirect("/admin/committee");
  }

  let clonedAssignments = 0;

  if (carryAssignments) {
    const { data: sourceAssignments, error: assignmentLoadError } = await admin
      .from("committee_assignments")
      .select(
        "id, role_id, member_id, display_name, bio, sort_order, starts_on, ends_on, status, is_public, public_title_override"
      )
      .eq("term_id", sourceTerm.id)
      .neq("status", "completed")
      .order("sort_order", { ascending: true });

    if (assignmentLoadError) {
      await setAdminFlash({
        tone: "error",
        title: "Committee rollover failed",
        message: assignmentLoadError.message,
      });
      redirect("/admin/committee");
    }

    if ((sourceAssignments || []).length > 0) {
      const { error: assignmentInsertError } = await admin
        .from("committee_assignments")
        .insert(
          (sourceAssignments || []).map((assignment) => ({
            bio: assignment.bio,
            created_by_user_id: actorUserId,
            display_name: assignment.display_name,
            ends_on: null,
            is_public: assignment.is_public,
            member_id: assignment.member_id,
            public_title_override: assignment.public_title_override,
            role_id: assignment.role_id,
            rollover_source_assignment_id: assignment.id,
            sort_order: assignment.sort_order,
            source: "rollover",
            starts_on: startsOn,
            status: assignmentStatus,
            term_id: newTerm.id,
          }))
        );

      if (assignmentInsertError) {
        await setAdminFlash({
          tone: "error",
          title: "Committee rollover failed",
          message: assignmentInsertError.message,
        });
        redirect("/admin/committee");
      }

      clonedAssignments = sourceAssignments?.length || 0;
    }
  }

  if (closeSourceTerm) {
    const sourceEndsOn = toPreviousDay(startsOn);

    await admin
      .from("committee_terms")
      .update({
        ends_on: sourceEndsOn || sourceTerm.ends_on,
        is_current: false,
        status: "archived",
      })
      .eq("id", sourceTerm.id);
  }

  await admin.from("operator_reports").insert({
    created_by_user_id: actorUserId,
    report: {
      carryAssignments,
      clonedAssignments,
      closeSourceTerm,
      newTermId: newTerm.id,
      sourceTermId: sourceTerm.id,
    },
    report_type: "committee_rollover",
    status: "completed",
    summary: `${sourceTerm.title} rolled into ${title}.`,
    title: `Committee rollover: ${sourceTerm.title} -> ${title}`,
  });

  await admin.from("audit_events").insert({
    actor_user_id: actorUserId,
    action: "committee.term_rolled_over",
    entity_type: "committee_term",
    entity_id: newTerm.id,
    metadata: {
      carryAssignments,
      clonedAssignments,
      closeSourceTerm,
      sourceTermId: sourceTerm.id,
    },
  });

  revalidatePath("/admin/committee");
  revalidatePath("/committee");
  revalidatePath("/admin/reports");
  await setAdminFlash({
    tone: "success",
    title: "Committee rollover completed",
    message: `${title} was created from ${sourceTerm.title}${carryAssignments ? ` with ${clonedAssignments} carried assignments` : ""}.`,
  });
  redirect("/admin/committee");
}
