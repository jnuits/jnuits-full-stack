"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getSafeAdminActionErrorMessage } from "@/lib/admin/action-error";
import { setAdminFlash } from "@/lib/admin/flash";
import { requireAdminPermission } from "@/lib/auth/session";
import { revalidatePublicCommitteeProjection } from "@/lib/committee/revalidation";
import { committeeTermPositionInputSchema } from "@/lib/committee/term-positions";
import {
  normalizeAdvisorJnuitsId,
  normalizeJnuitsIdForCreation,
} from "@/lib/members/jnuits-id";
import { createAdminClient } from "@/lib/supabase/admin";

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function safeCommitteeError(error: unknown, context: string, fallback: string) {
  return getSafeAdminActionErrorMessage(error, {
    context: `committee.${context}`,
    fallback,
  });
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
const committeeImportTypeSchema = z.enum([
  "executive_roster",
  "advisor_profiles",
  "sub_executive_internal",
]);
const advisorJnuitsIdSchema = z
  .string()
  .trim()
  .max(20)
  .optional()
  .default("")
  .refine((value) => !value || Boolean(normalizeAdvisorJnuitsId(value)), {
    message: "Advisor ID must use JNUITS-CA0001, JNUITS-MOD0001, or JNUITS-RA0001 format.",
  })
  .transform((value) => normalizeAdvisorJnuitsId(value) || "");

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
  advisorJnuitsId: advisorJnuitsIdSchema,
  advisorType: advisorTypeSchema,
  avatarSecureUrl: z.string().trim().url().or(z.literal("")).optional().default(""),
  bio: z.string().trim().max(5000).optional().default(""),
  dateConfidence: dateConfidenceSchema,
  department: z.string().trim().max(180).optional().default(""),
  designation: z.string().trim().max(180).optional().default(""),
  email: z.string().trim().email().or(z.literal("")).optional().default(""),
  facebookUrl: z.string().trim().url().or(z.literal("")).optional().default(""),
  formerTitle: z.string().trim().max(180).optional().default(""),
  fullName: z.string().trim().min(1, "Advisor name is required.").max(180),
  isCurrent: booleanStringSchema,
  isPublic: booleanStringSchema,
  jnuProfileUrl: z.string().trim().url().or(z.literal("")).optional().default(""),
  joinedOn: z.string().trim().max(40).optional().default(""),
  leftOn: z.string().trim().max(40).optional().default(""),
  linkedinUrl: z.string().trim().url().or(z.literal("")).optional().default(""),
  phone: z.string().trim().max(60).optional().default(""),
  publications: z.string().trim().max(6000).optional().default(""),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(100),
  speech: z.string().trim().max(5000).optional().default(""),
  statusNote: z.string().trim().max(1200).optional().default(""),
  tenureDisplay: z.string().trim().max(180).optional().default(""),
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

const committeeImportSchema = z.object({
  csvContent: z.string().trim().min(1, "Paste CSV rows before committing an import.").max(120_000),
  importType: committeeImportTypeSchema,
  termId: z.string().trim().max(80).optional().default(""),
});

const advisorAuthLinkSchema = z.object({
  advisorId: z.string().trim().min(1, "Advisor profile is required.").max(80),
  email: z.string().trim().email("Enter the advisor portal email address."),
});

const bulkAssignmentUpdateSchema = z.object({
  assignmentIds: z
    .string()
    .trim()
    .min(1, "Select at least one assignment.")
    .transform((value) =>
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    ),
  isPublic: booleanStringSchema,
  note: z.string().trim().max(1000).optional().default(""),
  status: committeeAssignmentStatusSchema,
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

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function parseCsvRows(csvContent: string) {
  const lines = csvContent
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    return [];
  }

  const headers = parseCsvLine(lines[0] || "").map(normalizeHeader);
  return lines.slice(1).map((line, index) => {
    const cells = parseCsvLine(line);
    const row: Record<string, string> = { row_number: String(index + 2) };

    headers.forEach((header, headerIndex) => {
      row[header] = cells[headerIndex]?.trim() || "";
    });

    return row;
  });
}

function readCsvValue(row: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = row[normalizeHeader(key)];
    if (value) return value.trim();
  }

  return "";
}

function parseCsvBoolean(value: string, fallback: boolean) {
  const normalized = value.trim().toLowerCase();

  if (!normalized) return fallback;
  if (["1", "true", "yes", "y", "public", "active"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "private", "internal"].includes(normalized)) return false;
  return fallback;
}

function normalizeRoleKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() || "";
}

function validAssignmentStatus(value: string) {
  return committeeAssignmentStatusSchema.safeParse(value.trim().toLowerCase()).success
    ? (value.trim().toLowerCase() as z.infer<typeof committeeAssignmentStatusSchema>)
    : "active";
}

function advisorIdPrefix(advisorType: z.infer<typeof advisorTypeSchema>) {
  if (advisorType === "main_advisor") return "CA";
  if (advisorType === "moderator_mentor") return "MOD";
  return "RA";
}

function normalizeAdvisorType(value: string) {
  const key = normalizeRoleKey(value);

  if (["chief-advisor", "main-advisor", "vc", "vice-chancellor"].includes(key)) {
    return "main_advisor";
  }

  if (["moderator", "mentor", "moderator-mentor", "mentor-moderator"].includes(key)) {
    return "moderator_mentor";
  }

  if (
    [
      "honorable-advisor",
      "honourable-advisor",
      "respected-advisor",
      "advisor",
      "ra",
    ].includes(key)
  ) {
    return "honorable_advisor";
  }

  return value.trim();
}

async function allocateAdvisorJnuitsId(
  admin: ReturnType<typeof createAdminClient>,
  advisorType: z.infer<typeof advisorTypeSchema>
) {
  const prefix = advisorIdPrefix(advisorType);
  const { data } = await admin
    .from("advisor_profiles")
    .select("advisor_jnuits_id")
    .like("advisor_jnuits_id", `JNUITS-${prefix}%`);
  let maxSerial = 0;

  for (const row of data || []) {
    const normalized = normalizeAdvisorJnuitsId(row.advisor_jnuits_id);
    const match = normalized.match(new RegExp(`^JNUITS-${prefix}(\\d{4})$`));
    if (!match) continue;
    const serial = Number.parseInt(match[1] || "0", 10);
    if (Number.isFinite(serial) && serial > maxSerial) {
      maxSerial = serial;
    }
  }

  return `JNUITS-${prefix}${String(maxSerial + 1).padStart(4, "0")}`;
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
      message: error
        ? safeCommitteeError(error, "saveTerm", "Unable to save the committee term.")
        : "Unable to save the committee term.",
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
  revalidatePublicCommitteeProjection();
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

  const { data: targetTerm, error: targetTermError } = await admin
    .from("committee_terms")
    .select("id, term_kind, title")
    .eq("id", termId)
    .maybeSingle();

  if (targetTermError || !targetTerm || targetTerm.term_kind !== "executive") {
    await setAdminFlash({
      tone: "error",
      title: "Current committee not changed",
      message: "Only executive committee terms can be set as current.",
    });
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
      message: safeCommitteeError(error, "setCurrentTerm", "Current committee could not be changed."),
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
  revalidatePublicCommitteeProjection();
  await setAdminFlash({
    tone: "success",
    title: "Current committee updated",
    message: "The public committee page now prioritizes the selected executive committee.",
  });
  redirect("/admin/committee");
}

export async function saveCommitteeTermPosition(formData: FormData) {
  const actorUserId = await requireCommitteeAdmin();
  const admin = createAdminClient();
  const parsed = committeeTermPositionInputSchema.safeParse(
    pickFormFields(formData, [
      "termId",
      "roleId",
      "publicLabel",
      "publicLabelBn",
      "roleGroup",
      "priority",
      "isPublic",
      "minSlots",
      "maxSlots",
      "targetSlots",
    ])
  );

  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "Committee position not saved",
      message: parsed.error.issues[0]?.message || "Review the position settings and try again.",
    });
    redirect("/admin/committee");
  }

  const {
    isPublic,
    maxSlots,
    minSlots,
    priority,
    publicLabel,
    publicLabelBn,
    roleGroup,
    roleId,
    targetSlots,
    termId,
  } = parsed.data;
  const [{ data: term, error: termError }, { data: role, error: roleError }] =
    await Promise.all([
      admin
        .from("committee_terms")
        .select("id, title, term_kind")
        .eq("id", termId)
        .maybeSingle(),
      admin
        .from("committee_roles")
        .select("id, title")
        .eq("id", roleId)
        .maybeSingle(),
    ]);

  if (termError || roleError || !term || !role || (term.term_kind || "executive") !== "executive") {
    await setAdminFlash({
      tone: "error",
      title: "Committee position not saved",
      message:
        termError || roleError
          ? safeCommitteeError(
              termError || roleError,
              "saveTermPositionContext",
              "Unable to verify the committee term and canonical role."
            )
          : "Choose a valid executive committee term and canonical role.",
    });
    redirect("/admin/committee");
  }

  const { data: existing, error: existingError } = await admin
    .from("committee_term_positions")
    .select(
      "id, term_id, role_id, public_label, public_label_bn, role_group, priority, is_public, min_slots, max_slots, target_slots"
    )
    .eq("term_id", termId)
    .eq("role_id", roleId)
    .maybeSingle();

  if (existingError) {
    await setAdminFlash({
      tone: "error",
      title: "Committee position not saved",
      message: safeCommitteeError(
        existingError,
        "loadTermPosition",
        "Unable to load the existing term position."
      ),
    });
    redirect("/admin/committee");
  }

  const payload = {
    is_public: isPublic,
    max_slots: maxSlots,
    min_slots: minSlots,
    priority,
    public_label: publicLabel,
    public_label_bn: publicLabelBn,
    role_group: roleGroup,
    target_slots: targetSlots,
    updated_by_user_id: actorUserId,
  };
  const mutation = existing
    ? admin
        .from("committee_term_positions")
        .update(payload)
        .eq("id", existing.id)
        .select(
          "id, term_id, role_id, public_label, public_label_bn, role_group, priority, is_public, min_slots, max_slots, target_slots"
        )
        .single()
    : admin
        .from("committee_term_positions")
        .insert({
          ...payload,
          created_by_user_id: actorUserId,
          role_id: roleId,
          term_id: termId,
        })
        .select(
          "id, term_id, role_id, public_label, public_label_bn, role_group, priority, is_public, min_slots, max_slots, target_slots"
        )
        .single();
  const { data: saved, error: saveError } = await mutation;

  if (saveError || !saved) {
    await setAdminFlash({
      tone: "error",
      title: "Committee position not saved",
      message: saveError
        ? safeCommitteeError(saveError, "saveTermPosition", "Unable to save the committee position.")
        : "Unable to save the committee position.",
    });
    redirect("/admin/committee");
  }

  await admin.from("audit_events").insert({
    actor_user_id: actorUserId,
    action: existing
      ? "committee.term_position_updated"
      : "committee.term_position_created",
    entity_id: saved.id,
    entity_type: "committee_term_position",
    metadata: {
      after: saved,
      before: existing,
      roleId,
      termId,
    },
  });

  revalidatePath("/admin/committee");
  revalidatePublicCommitteeProjection();
  await setAdminFlash({
    tone: "success",
    title: existing ? "Committee position updated" : "Committee position created",
    message: `${publicLabel} is configured for ${term.title}.`,
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

  const [{ data: role, error: roleError }, { data: term, error: termError }] =
    await Promise.all([
      admin
        .from("committee_roles")
        .select("id, code, role_group, title")
        .eq("id", roleId)
        .maybeSingle(),
      admin
        .from("committee_terms")
        .select("id, term_kind, title")
        .eq("id", termId)
        .maybeSingle(),
    ]);

  if (
    roleError ||
    !role ||
    role.role_group !== "executive" ||
    role.code === "joint-secretary"
  ) {
    await setAdminFlash({
      tone: "error",
      title: "Committee assignment not saved",
      message: "Executive roster assignments can only use constitutional public executive roles.",
    });
    redirect("/admin/committee");
  }

  if (termError || !term || term.term_kind !== "executive") {
    await setAdminFlash({
      tone: "error",
      title: "Committee assignment not saved",
      message: "Executive roster assignments can only be attached to executive committee terms.",
    });
    redirect("/admin/committee");
  }

  if (isPublic && !memberId) {
    await setAdminFlash({
      tone: "error",
      title: "Committee assignment not saved",
      message: "Public executive assignments must link to a real member profile.",
    });
    redirect("/admin/committee");
  }

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
      message: error
        ? safeCommitteeError(error, "saveAssignment", "Unable to save the committee assignment.")
        : "Unable to save the committee assignment.",
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
  revalidatePublicCommitteeProjection();
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
      message: safeCommitteeError(
        error,
        "removeAssignment",
        "Committee assignment could not be removed."
      ),
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
  revalidatePublicCommitteeProjection();
  await setAdminFlash({
    tone: "success",
    title: "Committee assignment removed",
    message: "The roster entry was removed.",
  });
  redirect("/admin/committee");
}

export async function bulkUpdateCommitteeAssignments(formData: FormData) {
  const actorUserId = await requireCommitteeAdmin();
  const admin = createAdminClient();
  const parsed = bulkAssignmentUpdateSchema.safeParse(
    pickFormFields(formData, ["assignmentIds", "status", "isPublic", "note"])
  );

  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "Bulk roster update failed",
      message: parsed.error.issues[0]?.message || "Select roster rows and choose a status.",
    });
    redirect("/admin/committee");
  }

  const { assignmentIds, isPublic, note, status } = parsed.data;

  if (assignmentIds.length === 0 || assignmentIds.length > 100) {
    await setAdminFlash({
      tone: "error",
      title: "Bulk roster update failed",
      message: "Bulk updates must include between 1 and 100 assignments.",
    });
    redirect("/admin/committee");
  }

  const { error } = await admin
    .from("committee_assignments")
    .update({
      is_public: isPublic,
      status,
    })
    .in("id", assignmentIds);

  if (error) {
    await setAdminFlash({
      tone: "error",
      title: "Bulk roster update failed",
      message: safeCommitteeError(error, "bulkRoster", "Bulk roster update could not be saved."),
    });
    redirect("/admin/committee");
  }

  await admin.from("audit_events").insert({
    actor_user_id: actorUserId,
    action: "committee.assignments_bulk_updated",
    entity_type: "committee_assignment",
    entity_id: null,
    metadata: {
      assignmentIds,
      count: assignmentIds.length,
      isPublic,
      note: note || null,
      status,
    },
  });

  revalidatePath("/admin/committee");
  revalidatePublicCommitteeProjection();
  await setAdminFlash({
    tone: "success",
    title: "Bulk roster update saved",
    message: `${assignmentIds.length} assignment${assignmentIds.length === 1 ? "" : "s"} updated.`,
  });
  redirect("/admin/committee");
}

export async function saveAdvisorProfile(formData: FormData) {
  const actorUserId = await requireCommitteeAdmin();
  const admin = createAdminClient();
  const parsed = advisorProfileSchema.safeParse(
    pickFormFields(formData, [
      "advisorId",
      "advisorJnuitsId",
      "advisorType",
      "avatarSecureUrl",
      "bio",
      "dateConfidence",
      "department",
      "designation",
      "email",
      "facebookUrl",
      "formerTitle",
      "fullName",
      "isCurrent",
      "isPublic",
      "jnuProfileUrl",
      "joinedOn",
      "leftOn",
      "linkedinUrl",
      "phone",
      "publications",
      "sortOrder",
      "speech",
      "statusNote",
      "tenureDisplay",
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
    advisorJnuitsId,
    advisorType,
    avatarSecureUrl,
    bio,
    dateConfidence,
    department,
    designation,
    email,
    facebookUrl,
    formerTitle,
    fullName,
    isCurrent,
    isPublic,
    jnuProfileUrl,
    joinedOn,
    leftOn,
    linkedinUrl,
    phone,
    publications,
    sortOrder,
    speech,
    statusNote,
    tenureDisplay,
    title,
    userId,
    websiteUrl,
    workExperience,
  } = parsed.data;
  const resolvedAdvisorJnuitsId =
    advisorJnuitsId || (await allocateAdvisorJnuitsId(admin, advisorType));

  const payload = {
    advisor_jnuits_id: resolvedAdvisorJnuitsId,
    advisor_type: advisorType,
    avatar_secure_url: avatarSecureUrl || null,
    bio: bio || null,
    created_by_user_id: actorUserId,
    date_confidence: dateConfidence,
    department: department || null,
    designation: designation || null,
    email: email || null,
    facebook_url: facebookUrl || null,
    former_title: formerTitle || null,
    full_name: fullName,
    is_current: isCurrent,
    is_public: isPublic,
    jnu_profile_url: jnuProfileUrl || null,
    joined_on: joinedOn || null,
    left_on: leftOn || null,
    linkedin_url: linkedinUrl || null,
    phone: phone || null,
    publications: listToJson(publications),
    sort_order: sortOrder,
    speech: speech || null,
    status_note: statusNote || null,
    tenure_display: tenureDisplay || null,
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
      message: error
        ? safeCommitteeError(error, "saveAdvisorProfile", "Unable to save advisor profile.")
        : "Unable to save advisor profile.",
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
      advisorJnuitsId: resolvedAdvisorJnuitsId,
      isCurrent,
      isPublic,
      userId: userId || null,
    },
  });

  revalidatePath("/admin/committee");
  revalidatePublicCommitteeProjection();
  await setAdminFlash({
    tone: "success",
    title: advisorId ? "Advisor profile updated" : "Advisor profile created",
    message: `${fullName} is now saved in the advisor board.`,
  });
  redirect("/admin/committee");
}

async function findAuthUserIdByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string
) {
  const targetEmail = normalizeEmail(email);
  const perPage = 200;

  for (let page = 1; page <= 25; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });

    if (error) {
      throw error;
    }

    const match = data.users.find((user) => normalizeEmail(user.email) === targetEmail);
    if (match) {
      return match.id;
    }

    if (data.users.length < perPage) {
      break;
    }
  }

  return null;
}

export async function linkAdvisorAuthUser(formData: FormData) {
  const actorUserId = await requireCommitteeAdmin();
  const admin = createAdminClient();
  const parsed = advisorAuthLinkSchema.safeParse(
    pickFormFields(formData, ["advisorId", "email"])
  );

  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "Advisor portal user not linked",
      message: parsed.error.issues[0]?.message || "Enter a valid advisor email.",
    });
    redirect("/admin/committee");
  }

  const { advisorId, email } = parsed.data;
  const { data: advisor, error: advisorError } = await admin
    .from("advisor_profiles")
    .select("id, full_name")
    .eq("id", advisorId)
    .maybeSingle();

  if (advisorError || !advisor) {
    await setAdminFlash({
      tone: "error",
      title: "Advisor portal user not linked",
      message: "The advisor profile could not be found.",
    });
    redirect("/admin/committee");
  }

  let linkedUserId: string | null = null;

  try {
    linkedUserId = await findAuthUserIdByEmail(admin, email);
  } catch (error) {
    await setAdminFlash({
      tone: "error",
      title: "Advisor portal user not linked",
      message: safeCommitteeError(
        error,
        "linkAdvisorPortalUser.authLookup",
        "Supabase Auth lookup failed while linking the advisor."
      ),
    });
    redirect("/admin/committee");
  }

  if (!linkedUserId) {
    await setAdminFlash({
      tone: "error",
      title: "Advisor portal user not linked",
      message: `No Supabase Auth user exists for ${email}. Invite or create the login user first.`,
    });
    redirect("/admin/committee");
  }

  const { error } = await admin
    .from("advisor_profiles")
    .update({ email, user_id: linkedUserId })
    .eq("id", advisorId);

  if (error) {
    await setAdminFlash({
      tone: "error",
      title: "Advisor portal user not linked",
      message: safeCommitteeError(
        error,
        "linkAdvisorPortalUser",
        "Advisor portal user could not be linked."
      ),
    });
    redirect("/admin/committee");
  }

  await admin.from("audit_events").insert({
    actor_user_id: actorUserId,
    action: "committee.advisor_auth_linked",
    entity_type: "advisor_profile",
    entity_id: advisorId,
    metadata: {
      advisorName: advisor.full_name,
      email,
      linkedUserId,
    },
  });

  revalidatePath("/admin/committee");
  revalidatePublicCommitteeProjection();
  await setAdminFlash({
    tone: "success",
    title: "Advisor portal user linked",
    message: `${advisor.full_name} is now linked to the login account ${email}.`,
  });
  redirect("/admin/committee");
}

export async function commitCommitteeImport(formData: FormData) {
  const actorUserId = await requireCommitteeAdmin();
  const admin = createAdminClient();
  const parsed = committeeImportSchema.safeParse(
    pickFormFields(formData, ["importType", "termId", "csvContent"])
  );

  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "Committee import not committed",
      message: parsed.error.issues[0]?.message || "Choose an import type and paste CSV rows.",
    });
    redirect("/admin/committee");
  }

  const { csvContent, importType, termId } = parsed.data;
  if (importType !== "advisor_profiles") {
    await setAdminFlash({
      tone: "error",
      title: "Use the validated roster workspace",
      message:
        "Executive and sub-executive roster imports must be reviewed and published through an onboarding draft.",
    });
    redirect("/admin/committee");
  }

  const rows = parseCsvRows(csvContent);

  if (rows.length === 0) {
    await setAdminFlash({
      tone: "error",
      title: "Committee import not committed",
      message: "CSV must include a header row and at least one data row.",
    });
    redirect("/admin/committee");
  }

  if (importType === "advisor_profiles") {
    const result = await commitAdvisorProfileImport(admin, actorUserId, rows);
    revalidatePath("/admin/committee");
    revalidatePublicCommitteeProjection();
    await setAdminFlash({
      tone: "success",
      title: "Advisor import committed",
      message: `${result.changed} advisor profile${result.changed === 1 ? "" : "s"} created or updated. ${result.skipped} row${result.skipped === 1 ? "" : "s"} skipped.`,
    });
    redirect("/admin/committee");
  }

  const result = await commitAssignmentImport(admin, actorUserId, rows, {
    importType,
    termId,
  });

  revalidatePath("/admin/committee");
  revalidatePublicCommitteeProjection();
  await setAdminFlash({
    tone: "success",
    title:
      importType === "executive_roster"
        ? "Executive roster import committed"
        : "Sub-executive import committed",
    message: `${result.changed} assignment${result.changed === 1 ? "" : "s"} created or updated. ${result.skipped} row${result.skipped === 1 ? "" : "s"} skipped.`,
  });
  redirect("/admin/committee");
}

async function commitAssignmentImport(
  admin: ReturnType<typeof createAdminClient>,
  actorUserId: string,
  rows: Record<string, string>[],
  options: {
    importType: Extract<
      z.infer<typeof committeeImportTypeSchema>,
      "executive_roster" | "sub_executive_internal"
    >;
    termId: string;
  }
) {
  if (!options.termId) {
    await setAdminFlash({
      tone: "error",
      title: "Committee import not committed",
      message: "Choose the executive committee term before importing assignments.",
    });
    redirect("/admin/committee");
  }

  const { data: term, error: termError } = await admin
    .from("committee_terms")
    .select("id, title, term_kind")
    .eq("id", options.termId)
    .maybeSingle();

  if (termError || !term || term.term_kind !== "executive") {
    await setAdminFlash({
      tone: "error",
      title: "Committee import not committed",
      message: "Imports must target a valid executive committee term.",
    });
    redirect("/admin/committee");
  }

  const [{ data: roles }, { data: members }, { data: existingAssignments }] =
    await Promise.all([
      admin
        .from("committee_roles")
        .select("id, code, title, role_group, max_slots")
        .order("sort_order", { ascending: true }),
      admin.from("members").select("id, jnuits_id, full_name, email").limit(10_000),
      admin
        .from("committee_assignments")
        .select("id, role_id, member_id, display_name, status, is_public")
        .eq("term_id", options.termId),
    ]);
  const roleByKey = new Map<
    string,
    { code: string; id: string; max_slots?: number | null; role_group?: string | null; title: string }
  >();

  for (const role of roles || []) {
    roleByKey.set(normalizeRoleKey(role.code), role);
    roleByKey.set(normalizeRoleKey(role.title), role);
  }

  const memberByJnuitsId = new Map<
    string,
    { email?: string | null; full_name?: string | null; id: string; jnuits_id?: string | null }
  >();
  const memberByEmail = new Map<
    string,
    { email?: string | null; full_name?: string | null; id: string; jnuits_id?: string | null }
  >();

  for (const member of members || []) {
    const normalizedId = normalizeJnuitsIdForCreation(member.jnuits_id || "");
    if (normalizedId) {
      memberByJnuitsId.set(normalizedId, member);
    }

    const email = normalizeEmail(member.email);
    if (email) {
      memberByEmail.set(email, member);
    }
  }

  const roleCounts = new Map<string, number>();
  const existingKeys = new Set<string>();

  for (const assignment of existingAssignments || []) {
    const isVisible = assignment.is_public !== false && assignment.status !== "planned";
    const key = assignment.member_id
      ? `${assignment.role_id}:${assignment.member_id}`
      : `${assignment.role_id}:${assignment.display_name || ""}`;
    existingKeys.add(key);

    if (isVisible) {
      roleCounts.set(assignment.role_id, (roleCounts.get(assignment.role_id) || 0) + 1);
    }
  }

  const errors: string[] = [];
  const entries: Array<{
    bio: string;
    displayName: string;
    endsOn: string;
    isPublic: boolean;
    memberId: null | string;
    publicTitleOverride: string;
    roleId: string;
    sortOrder: number;
    startsOn: string;
    status: z.infer<typeof committeeAssignmentStatusSchema>;
  }> = [];

  rows.forEach((row, index) => {
    const rowNumber = readCsvValue(row, ["row_number"]) || String(index + 2);
    const rawRole =
      readCsvValue(row, ["role_code", "role", "role_title"]) ||
      (options.importType === "sub_executive_internal" ? "sub-executive-member" : "");
    const role = roleByKey.get(normalizeRoleKey(rawRole));

    if (!role) {
      errors.push(`Row ${rowNumber}: unknown committee role "${rawRole || "(blank)"}".`);
      return;
    }

    if (
      options.importType === "executive_roster" &&
      (role.role_group !== "executive" || role.code === "joint-secretary")
    ) {
      errors.push(`Row ${rowNumber}: role "${role.title}" is not a public executive role.`);
      return;
    }

    const normalizedJnuitsId = normalizeJnuitsIdForCreation(
      readCsvValue(row, ["jnuits_id", "member_jnuits_id", "membership_id"])
    );
    const email = normalizeEmail(readCsvValue(row, ["email", "member_email"]));
    const member = normalizedJnuitsId
      ? memberByJnuitsId.get(normalizedJnuitsId)
      : email
        ? memberByEmail.get(email)
        : null;
    const displayName =
      readCsvValue(row, ["display_name", "member_name", "name", "full_name"]) ||
      member?.full_name ||
      "";
    const isPublic =
      options.importType === "executive_roster"
        ? parseCsvBoolean(readCsvValue(row, ["is_public", "public", "visibility"]), true)
        : false;

    if (options.importType === "executive_roster" && isPublic && !member) {
      errors.push(
        `Row ${rowNumber}: public executive assignment must link to a member by JnUITS ID or email.`
      );
      return;
    }

    if (!member && !displayName) {
      errors.push(`Row ${rowNumber}: provide a linked member or display name.`);
      return;
    }

    const status = validAssignmentStatus(readCsvValue(row, ["status"]));
    const key = member ? `${role.id}:${member.id}` : `${role.id}:${displayName}`;

    if (isPublic && status !== "planned" && !existingKeys.has(key)) {
      const nextCount = (roleCounts.get(role.id) || 0) + 1;
      if (role.max_slots && nextCount > role.max_slots) {
        errors.push(
          `Row ${rowNumber}: "${role.title}" exceeds its configured maximum of ${role.max_slots}.`
        );
        return;
      }

      roleCounts.set(role.id, nextCount);
    }

    entries.push({
      bio: readCsvValue(row, ["bio", "note", "notes"]),
      displayName,
      endsOn: readCsvValue(row, ["ends_on", "end_date", "left_on"]),
      isPublic,
      memberId: member?.id || null,
      publicTitleOverride: readCsvValue(row, ["public_title_override", "title_override"]),
      roleId: role.id,
      sortOrder: Number.parseInt(readCsvValue(row, ["sort_order", "order"]) || "100", 10) || 100,
      startsOn: readCsvValue(row, ["starts_on", "start_date", "joined_on"]),
      status,
    });
  });

  if (errors.length > 0) {
    await setAdminFlash({
      tone: "error",
      title: "Committee import not committed",
      message: errors.slice(0, 5).join(" "),
    });
    redirect("/admin/committee");
  }

  let changed = 0;

  for (const entry of entries) {
    const existingResult = entry.memberId
      ? await admin
          .from("committee_assignments")
          .select("id")
          .eq("term_id", options.termId)
          .eq("role_id", entry.roleId)
          .eq("member_id", entry.memberId)
          .limit(1)
      : await admin
          .from("committee_assignments")
          .select("id")
          .eq("term_id", options.termId)
          .eq("role_id", entry.roleId)
          .is("member_id", null)
          .eq("display_name", entry.displayName)
          .limit(1);
    const existingId = existingResult.data?.[0]?.id;
    const payload = {
      bio: entry.bio || null,
      created_by_user_id: actorUserId,
      display_name: entry.displayName || null,
      ends_on: entry.endsOn || null,
      is_public: entry.isPublic,
      member_id: entry.memberId,
      public_title_override: entry.publicTitleOverride || null,
      role_id: entry.roleId,
      sort_order: entry.sortOrder,
      source: "bulk_import",
      starts_on: entry.startsOn || null,
      status: entry.status,
      term_id: options.termId,
    };
    const { error } = existingId
      ? await admin.from("committee_assignments").update(payload).eq("id", existingId)
      : await admin.from("committee_assignments").insert(payload);

    if (error) {
      await setAdminFlash({
        tone: "error",
        title: "Committee import partially blocked",
        message: safeCommitteeError(
          error,
          "importCommitteeRoster",
          "Committee import could not finish safely."
        ),
      });
      redirect("/admin/committee");
    }

    changed += 1;
  }

  await admin.from("audit_events").insert({
    actor_user_id: actorUserId,
    action:
      options.importType === "executive_roster"
        ? "committee.import_executive_roster_committed"
        : "committee.import_sub_executive_committed",
    entity_type: "committee_term",
    entity_id: options.termId,
    metadata: {
      changed,
      importType: options.importType,
      skipped: rows.length - changed,
      termTitle: term.title,
    },
  });

  return { changed, skipped: rows.length - changed };
}

async function commitAdvisorProfileImport(
  admin: ReturnType<typeof createAdminClient>,
  actorUserId: string,
  rows: Record<string, string>[]
) {
  let changed = 0;
  const skipped = 0;
  const errors: string[] = [];

  for (const [index, row] of rows.entries()) {
    const rowNumber = readCsvValue(row, ["row_number"]) || String(index + 2);
    const fullName = readCsvValue(row, ["full_name", "name", "advisor_name"]);
    const parsedAdvisorType = advisorTypeSchema.safeParse(
      normalizeAdvisorType(readCsvValue(row, ["advisor_type", "type", "role"]))
    );

    if (!fullName) {
      errors.push(`Row ${rowNumber}: advisor full_name is required.`);
      continue;
    }

    if (!parsedAdvisorType.success) {
      errors.push(`Row ${rowNumber}: advisor_type must be main_advisor, moderator_mentor, or honorable_advisor.`);
      continue;
    }

    const rawAdvisorId = readCsvValue(row, ["advisor_jnuits_id", "advisor_id", "jnuits_id"]);
    const normalizedAdvisorId = rawAdvisorId ? normalizeAdvisorJnuitsId(rawAdvisorId) : "";

    if (rawAdvisorId && !normalizedAdvisorId) {
      errors.push(`Row ${rowNumber}: invalid advisor ID "${rawAdvisorId}".`);
      continue;
    }

    const advisorType = parsedAdvisorType.data;
    const advisorJnuitsId =
      normalizedAdvisorId || (await allocateAdvisorJnuitsId(admin, advisorType));
    const parsedDateConfidence = dateConfidenceSchema.safeParse(
      readCsvValue(row, ["date_confidence"])
    );
    const existingResult = normalizedAdvisorId
      ? await admin
          .from("advisor_profiles")
          .select("id")
          .eq("advisor_jnuits_id", normalizedAdvisorId)
          .maybeSingle()
      : await admin
          .from("advisor_profiles")
          .select("id")
          .eq("full_name", fullName)
          .eq("advisor_type", advisorType)
          .maybeSingle();
    const existingId = existingResult.data?.id;
    const payload = {
      advisor_jnuits_id: advisorJnuitsId,
      advisor_type: advisorType,
      bio: readCsvValue(row, ["bio"]) || null,
      created_by_user_id: actorUserId,
      date_confidence: parsedDateConfidence.success ? parsedDateConfidence.data : "verified",
      department: readCsvValue(row, ["department"]) || null,
      designation: readCsvValue(row, ["designation"]) || null,
      email: readCsvValue(row, ["email"]) || null,
      facebook_url: readCsvValue(row, ["facebook_url", "facebook"]) || null,
      former_title: readCsvValue(row, ["former_title"]) || null,
      full_name: fullName,
      is_current: parseCsvBoolean(readCsvValue(row, ["is_current", "current"]), true),
      is_public: parseCsvBoolean(readCsvValue(row, ["is_public", "public", "visibility"]), true),
      jnu_profile_url: readCsvValue(row, ["jnu_profile_url", "jnu_profile"]) || null,
      joined_on: readCsvValue(row, ["joined_on", "joined_at", "start_date"]) || null,
      left_on: readCsvValue(row, ["left_on", "left_at", "end_date"]) || null,
      linkedin_url: readCsvValue(row, ["linkedin_url", "linkedin"]) || null,
      phone: readCsvValue(row, ["phone"]) || null,
      publications: listToJson(readCsvValue(row, ["publications"])),
      sort_order: Number.parseInt(readCsvValue(row, ["sort_order", "order"]) || "100", 10) || 100,
      speech: readCsvValue(row, ["speech", "message"]) || null,
      status_note: readCsvValue(row, ["status_note", "tenure_note", "note"]) || null,
      tenure_display: readCsvValue(row, ["tenure_display", "tenure"]) || null,
      title: readCsvValue(row, ["title"]) || null,
      website_url: readCsvValue(row, ["website_url", "website"]) || null,
      work_experience: listToJson(readCsvValue(row, ["work_experience"])),
    };
    const { error } = existingId
      ? await admin.from("advisor_profiles").update(payload).eq("id", existingId)
      : await admin.from("advisor_profiles").insert(payload);

    if (error) {
      errors.push(
        `Row ${rowNumber}: ${safeCommitteeError(
          error,
          "commitAdvisorImport.row",
          "Unable to save advisor profile."
        )}`
      );
      continue;
    }

    changed += 1;
  }

  if (errors.length > 0) {
    await setAdminFlash({
      tone: "error",
      title: "Advisor import not committed",
      message: errors.slice(0, 5).join(" "),
    });
    redirect("/admin/committee");
  }

  await admin.from("audit_events").insert({
    actor_user_id: actorUserId,
    action: "committee.import_advisors_committed",
    entity_type: "advisor_profile",
    entity_id: null,
    metadata: {
      changed,
      importType: "advisor_profiles",
      skipped,
    },
  });

  return { changed, skipped };
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
      message: insertError
        ? safeCommitteeError(insertError, "rollover.createTerm", "Unable to create the rollover term.")
        : "Unable to create the rollover term.",
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
        message: safeCommitteeError(
          assignmentLoadError,
          "rollover.loadAssignments",
          "Unable to load source committee assignments."
        ),
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
          message: safeCommitteeError(
            assignmentInsertError,
            "rollover.cloneAssignments",
            "Unable to clone source committee assignments."
          ),
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
  revalidatePublicCommitteeProjection();
  revalidatePath("/admin/reports");
  await setAdminFlash({
    tone: "success",
    title: "Committee rollover completed",
    message: `${title} was created from ${sourceTerm.title}${carryAssignments ? ` with ${clonedAssignments} carried assignments` : ""}.`,
  });
  redirect("/admin/committee");
}
