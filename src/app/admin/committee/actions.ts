"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { setAdminFlash } from "@/lib/admin/flash";
import { requireAdminUser } from "@/lib/auth/session";
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
const committeeAssignmentStatusSchema = z.enum(["planned", "active", "completed"]);

const committeeTermSchema = z.object({
  endsOn: z.string().trim().max(40).optional().default(""),
  isPublic: booleanStringSchema,
  slug: z.string().trim().max(120).optional().default(""),
  startsOn: z.string().trim().min(1, "Start date is required.").max(40),
  status: committeeTermStatusSchema.optional().default("draft"),
  summary: z.string().trim().max(1000).optional().default(""),
  termId: z.string().trim().max(80).optional().default(""),
  title: z.string().trim().min(1, "Title is required.").max(180),
});

const committeeAssignmentSchema = z
  .object({
    assignmentId: z.string().trim().max(80).optional().default(""),
    bio: z.string().trim().max(2500).optional().default(""),
    displayName: z.string().trim().max(180).optional().default(""),
    endsOn: z.string().trim().max(40).optional().default(""),
    memberId: z.string().trim().max(80).optional().default(""),
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

export async function saveCommitteeTerm(formData: FormData) {
  const auth = await requireAdminUser();
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login");
  }

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

  const { endsOn, isPublic, startsOn, status, summary, termId, title } = parsed.data;
  const slug = slugify(parsed.data.slug || title);

  if (!slug) {
    await setAdminFlash({
      tone: "error",
      title: "Committee term not saved",
      message: "Title or slug must produce a valid public slug.",
    });
    redirect("/admin/committee");
  }

  const payload = {
    created_by_user_id: actorUserId,
    ends_on: endsOn || null,
    is_public: isPublic,
    slug,
    starts_on: startsOn,
    status,
    summary: summary || null,
    title,
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
      isPublic,
      slug,
      status,
      title,
    },
  });

  revalidatePath("/admin/committee");
  revalidatePath("/committee");
  await setAdminFlash({
    tone: "success",
    title: termId ? "Committee term updated" : "Committee term created",
    message: `${title} is now saved in the new committee model.`,
  });
  redirect("/admin/committee");
}

export async function saveCommitteeAssignment(formData: FormData) {
  const auth = await requireAdminUser();
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login");
  }

  const admin = createAdminClient();
  const parsed = committeeAssignmentSchema.safeParse(
    pickFormFields(formData, [
      "assignmentId",
      "bio",
      "displayName",
      "endsOn",
      "memberId",
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
    memberId,
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
    member_id: memberId || null,
    role_id: roleId,
    sort_order: sortOrder,
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

export async function rolloverCommitteeTerm(formData: FormData) {
  const auth = await requireAdminUser();
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login");
  }

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
    endsOn,
    isPublic,
    sourceTermId,
    startsOn,
    status,
    summary,
    title,
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

  const { data: newTerm, error: insertError } = await admin
    .from("committee_terms")
    .insert({
      created_by_user_id: actorUserId,
      ends_on: endsOn || null,
      is_public: isPublic,
      rollover_source_term_id: sourceTerm.id,
      slug,
      starts_on: startsOn,
      status,
      summary: summary || sourceTerm.summary,
      title,
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
        "id, role_id, member_id, display_name, bio, sort_order, starts_on, ends_on, status"
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
            member_id: assignment.member_id,
            role_id: assignment.role_id,
            rollover_source_assignment_id: assignment.id,
            sort_order: assignment.sort_order,
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
