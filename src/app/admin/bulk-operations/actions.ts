"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parse } from "csv-parse/sync";
import { z } from "zod";

import { setAdminFlash } from "@/lib/admin/flash";
import { requireAdminPermission } from "@/lib/auth/session";
import {
  DEFAULT_INVITATION_EXPIRY_DAYS,
  generateInvitationCode,
  getInvitationExpiryIso,
  hashInvitationCode,
} from "@/lib/members/invitation-code";
import { normalizeJnuitsIdForCreation } from "@/lib/members/jnuits-id";
import {
  buildAlumniConversionDecisionEmail,
  buildAlumniInvitationEmail,
  buildBulkOperationSummaryEmail,
  buildDeletionRequestStatusEmail,
  buildMemberInvitationEmail,
} from "@/lib/notifications/email-builders";
import { sendEmail } from "@/lib/notifications/send-email";
import { recordSecurityEvent } from "@/lib/security/security-events";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";

type BulkOperationType =
  | "account_deletion_review"
  | "alumni_conversion"
  | "alumni_invite"
  | "legacy_member_import"
  | "lifecycle_update"
  | "member_invite"
  | "role_update";

type CsvRow = Record<string, string | undefined>;

type BulkRowRecord = {
  id: string;
  normalized_data: Record<string, unknown>;
  row_number: number;
  status: string;
};

const BULK_OPERATION_TYPES = [
  "legacy_member_import",
  "member_invite",
  "alumni_invite",
  "lifecycle_update",
  "role_update",
  "alumni_conversion",
  "account_deletion_review",
] as const;

const previewSchema = z.object({
  csvContent: z.string().trim().min(1, "CSV content is required."),
  legacyYearBlock: z
    .string()
    .trim()
    .regex(/^[0-9]{4}$/, "Legacy/year block must be four digits.")
    .optional()
    .default("0000"),
  operationType: z.enum(BULK_OPERATION_TYPES),
  originalFilename: z.string().trim().max(180).optional().default("pasted.csv"),
});

const commitSchema = z.object({
  operationId: z.string().trim().min(1, "Missing bulk operation identifier."),
});

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function pickFormFields(formData: FormData, fields: string[]) {
  return Object.fromEntries(
    fields.map((field) => [field, asString(formData.get(field))])
  );
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: unknown) {
  const email = clean(value).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function normalizeLifecycleStatus(value: unknown) {
  const status = clean(value).toLowerCase();
  return ["current", "former", "alumni", "deleted"].includes(status)
    ? status
    : "";
}

function normalizePortalAccessStatus(value: unknown) {
  const status = clean(value).toLowerCase();
  return ["active", "frozen", "suspended", "deletion_requested", "deactivated"].includes(status)
    ? status
    : "";
}

function normalizePortalRole(value: unknown) {
  const role = clean(value).toLowerCase();
  return ["member", "alumni", "executive", "alumni_ambassador"].includes(role)
    ? role
    : "";
}

function parseCsvRows(csvContent: string) {
  return parse(csvContent, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CsvRow[];
}

async function getCurrentSequence(yearBlock: string) {
  const admin = createAdminClient();
  const { data } = await asFlexibleClient(admin)
    .from("membership_id_sequences" as string)
    .select("last_serial")
    .eq("year_block", yearBlock)
    .maybeSingle();

  return typeof data?.last_serial === "number" ? data.last_serial : 0;
}

async function getExistingMemberLookups(ids: string[], emails: string[]) {
  const admin = createAdminClient();
  const flexibleAdmin = asFlexibleClient(admin);
  const [idsResult, emailsResult] = await Promise.all([
    ids.length
      ? flexibleAdmin
          .from("members" as string)
          .select("id, user_id, jnuits_id, email, full_name, is_profile_claimed")
          .in("jnuits_id", ids)
      : Promise.resolve({ data: [] }),
    emails.length
      ? flexibleAdmin
          .from("members" as string)
          .select("id, user_id, jnuits_id, email, full_name, is_profile_claimed")
          .in("email", emails)
      : Promise.resolve({ data: [] }),
  ]);
  const byId = new Map<string, Record<string, unknown>>();
  const byEmail = new Map<string, Record<string, unknown>>();

  for (const member of (idsResult.data || []) as Record<string, unknown>[]) {
    if (typeof member.jnuits_id === "string") {
      byId.set(member.jnuits_id.toUpperCase(), member);
    }
  }

  for (const member of (emailsResult.data || []) as Record<string, unknown>[]) {
    if (typeof member.email === "string") {
      byEmail.set(member.email.toLowerCase(), member);
    }
  }

  return { byEmail, byId };
}

async function getNextInvitationCode(admin: ReturnType<typeof createAdminClient>) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateInvitationCode();
    const codeHash = hashInvitationCode(code);
    const { data } = await admin
      .from("member_invitations")
      .select("id")
      .eq("code_hash", codeHash)
      .maybeSingle();

    if (!data) {
      return { code, codeHash };
    }
  }

  throw new Error("Unable to generate a unique invitation code.");
}

async function createInvitation(options: {
  actorUserId: string;
  admin: ReturnType<typeof createAdminClient>;
  memberId: string;
  note: string;
}) {
  const invitation = await getNextInvitationCode(options.admin);
  const expiresAt = getInvitationExpiryIso(DEFAULT_INVITATION_EXPIRY_DAYS);
  const { data, error } = await options.admin
    .from("member_invitations")
    .insert({
      code_hash: invitation.codeHash,
      created_by_user_id: options.actorUserId,
      expires_at: expiresAt,
      max_uses: 1,
      member_id: options.memberId,
      notes: options.note,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to create invitation.");
  }

  return { code: invitation.code, expiresAt, invitationId: data.id };
}

function sendBulkInvitationEmail(options: {
  email: unknown;
  invitationCode: string;
  invitationExpiresAt: string;
  jnuitsId: unknown;
  name: unknown;
  type: "alumni" | "member";
}) {
  const email = normalizeEmail(options.email);
  const jnuitsId = clean(options.jnuitsId);
  const name = clean(options.name) || "JnUITS member";

  if (!email || !jnuitsId) {
    return;
  }

  void sendEmail({
    html:
      options.type === "alumni"
        ? buildAlumniInvitationEmail({
            alumniName: name,
            invitationCode: options.invitationCode,
            invitationExpiresAt: options.invitationExpiresAt,
            jnuitsId,
          })
        : buildMemberInvitationEmail({
            invitationCode: options.invitationCode,
            invitationExpiresAt: options.invitationExpiresAt,
            jnuitsId,
            memberName: name,
          }),
    subject:
      options.type === "alumni"
        ? "Your JnUITS alumni portal invitation"
        : "Claim your JnUITS member account",
    to: email,
  });
}

function sendBulkDecisionEmail(options: {
  decision: "approved" | "rejected";
  email: unknown;
  name: unknown;
  requestType: "account_deletion" | "alumni_conversion";
  reviewNote: unknown;
}) {
  const email = normalizeEmail(options.email);
  const memberName = clean(options.name) || "JnUITS member";
  const approved = options.decision === "approved";

  if (!email) {
    return;
  }

  void sendEmail({
    html:
      options.requestType === "alumni_conversion"
        ? buildAlumniConversionDecisionEmail({
            approved,
            memberName,
            reviewNote: clean(options.reviewNote) || null,
          })
        : buildDeletionRequestStatusEmail({
            approved,
            memberName,
            reviewNote: clean(options.reviewNote) || null,
          }),
    subject:
      options.requestType === "alumni_conversion"
        ? `JnUITS alumni conversion ${options.decision}`
        : `JnUITS profile deletion request ${options.decision}`,
    to: email,
  });
}

async function assignPortalRole(options: {
  actorUserId: string;
  admin: ReturnType<typeof createAdminClient>;
  note: string;
  roleCode: string;
  targetUserId: string;
}) {
  const flexibleAdmin = asFlexibleClient(options.admin);
  const { data: role, error: roleError } = await flexibleAdmin
    .from("rbac_platform_roles" as string)
    .select("id")
    .eq("scope", "portal")
    .eq("code", options.roleCode)
    .eq("is_assignable", true)
    .maybeSingle();

  if (roleError || !role?.id) {
    throw new Error(roleError?.message || "Portal role is not assignable.");
  }

  await flexibleAdmin
    .from("rbac_user_platform_roles" as string)
    .update({
      note: options.note || "Replaced by bulk role update.",
      revoked_at: new Date().toISOString(),
    })
    .eq("user_id", options.targetUserId)
    .eq("scope", "portal")
    .is("revoked_at", null);

  const { error } = await flexibleAdmin
    .from("rbac_user_platform_roles" as string)
    .insert({
      granted_by: options.actorUserId,
      note: options.note || null,
      role_id: role.id,
      scope: "portal",
      user_id: options.targetUserId,
    });

  if (error) {
    throw new Error(error.message);
  }
}

function normalizePreviewRow(options: {
  duplicateEmails: Set<string>;
  duplicateIds: Set<string>;
  emailCounts: Map<string, number>;
  existingByEmail: Map<string, Record<string, unknown>>;
  existingById: Map<string, Record<string, unknown>>;
  idCounts: Map<string, number>;
  operationType: BulkOperationType;
  row: CsvRow;
  rowIndex: number;
  sequenceStart: number;
  yearBlock: string;
}) {
  const errors: string[] = [];
  const normalized: Record<string, unknown> = {};
  const idInput = clean(options.row.jnuits_id || options.row.jnuitsId);
  const email = normalizeEmail(options.row.email);
  let jnuitsId = idInput ? normalizeJnuitsIdForCreation(idInput) : "";

  if (email) {
    normalized.email = email;
    if (options.duplicateEmails.has(email)) errors.push("Duplicate email in CSV.");
  } else if (
    ["legacy_member_import", "alumni_invite", "member_invite"].includes(
      options.operationType
    )
  ) {
    errors.push("A valid email is required.");
  }

  if (!jnuitsId && ["legacy_member_import", "alumni_invite"].includes(options.operationType)) {
    const serial = options.sequenceStart + options.rowIndex + 1;
    if (serial > 999) {
      errors.push(`${options.yearBlock} block has no remaining serials.`);
    } else {
      jnuitsId = `JNUITS-${options.yearBlock}${String(serial).padStart(3, "0")}`;
    }
  }

  if (jnuitsId) {
    normalized.jnuitsId = jnuitsId;
    if (options.duplicateIds.has(jnuitsId)) errors.push("Duplicate JnUITS ID in CSV.");
  } else if (options.operationType !== "legacy_member_import") {
    errors.push("A valid JnUITS ID is required.");
  }

  if (["legacy_member_import", "alumni_invite"].includes(options.operationType)) {
    const fullName = clean(options.row.full_name || options.row.fullName || options.row.name);
    const memberType = clean(options.row.member_type || options.row.memberType).toLowerCase();
    const normalizedMemberType =
      options.operationType === "alumni_invite" || memberType === "alumni"
        ? "alumni"
        : "current";
    const lifecycleStatus =
      options.operationType === "alumni_invite"
        ? "alumni"
        : memberType === "former"
        ? "former"
        : normalizedMemberType === "alumni"
          ? "alumni"
          : "current";

    if (!fullName) errors.push("full_name is required.");
    if (jnuitsId && options.existingById.has(jnuitsId)) errors.push("JnUITS ID already exists.");
    if (email && options.existingByEmail.has(email)) errors.push("Email already exists.");

    normalized.fullName = fullName;
    normalized.memberType = normalizedMemberType;
    normalized.lifecycleStatus = lifecycleStatus;
    normalized.portalAccessStatus = lifecycleStatus === "former" ? "frozen" : "active";
    normalized.departmentCode = clean(options.row.department_code || options.row.departmentCode) || null;
    normalized.batchNo = clean(options.row.batch_no || options.row.batchNo) || null;
    normalized.phone = clean(options.row.phone) || null;
  }

  if (options.operationType === "member_invite") {
    const member = jnuitsId ? options.existingById.get(jnuitsId) : null;
    if (!member) errors.push("Member does not exist.");
    if (member?.is_profile_claimed) errors.push("Member profile is already claimed.");
    normalized.fullName = member?.full_name || null;
    normalized.memberId = member?.id || null;
  }

  if (options.operationType === "lifecycle_update") {
    const lifecycleStatus = normalizeLifecycleStatus(options.row.lifecycle_status);
    const portalAccessStatus = normalizePortalAccessStatus(options.row.portal_access_status);
    const member = jnuitsId ? options.existingById.get(jnuitsId) : null;
    if (!member) errors.push("Member does not exist.");
    if (!lifecycleStatus) errors.push("Invalid lifecycle_status.");
    if (!portalAccessStatus) errors.push("Invalid portal_access_status.");
    normalized.memberId = member?.id || null;
    normalized.lifecycleStatus = lifecycleStatus;
    normalized.portalAccessStatus = portalAccessStatus;
  }

  if (options.operationType === "role_update") {
    const portalRole = normalizePortalRole(options.row.portal_role || options.row.role);
    const member = jnuitsId ? options.existingById.get(jnuitsId) : null;
    if (!member) errors.push("Member does not exist.");
    if (!member?.user_id) errors.push("Member has no linked portal account.");
    if (!portalRole) errors.push("Invalid portal_role.");
    normalized.memberId = member?.id || null;
    normalized.portalRole = portalRole;
    normalized.targetUserId = member?.user_id || null;
  }

  if (options.operationType === "alumni_conversion") {
    const member = jnuitsId ? options.existingById.get(jnuitsId) : null;
    if (!member) errors.push("Member does not exist.");
    normalized.email = member?.email || null;
    normalized.fullName = member?.full_name || null;
    normalized.memberId = member?.id || null;
    normalized.targetUserId = member?.user_id || null;
  }

  if (options.operationType === "account_deletion_review") {
    const decision = clean(options.row.decision).toLowerCase();
    const member = jnuitsId ? options.existingById.get(jnuitsId) : null;
    if (!member) errors.push("Member does not exist.");
    if (!["approved", "rejected"].includes(decision)) errors.push("decision must be approved or rejected.");
    normalized.decision = decision;
    normalized.email = member?.email || null;
    normalized.fullName = member?.full_name || null;
    normalized.memberId = member?.id || null;
    normalized.targetUserId = member?.user_id || null;
  }

  normalized.note = clean(options.row.note) || null;

  return {
    errors,
    normalized,
  };
}

export async function previewBulkOperationAction(formData: FormData) {
  const auth = await requireAdminPermission("admin.bulk.manage", {
    fallbackPath: "/admin/bulk-operations",
  });
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/admin/login?next=%2Fadmin%2Fbulk-operations");
  }

  const parsed = previewSchema.safeParse(
    pickFormFields(formData, [
      "operationType",
      "legacyYearBlock",
      "csvContent",
      "originalFilename",
    ])
  );

  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "Bulk preview failed",
      message: parsed.error.issues[0]?.message || "Invalid bulk preview request.",
    });
    redirect("/admin/bulk-operations");
  }

  const csvRows = parseCsvRows(parsed.data.csvContent);

  if (csvRows.length === 0 || csvRows.length > 500) {
    await setAdminFlash({
      tone: "error",
      title: "Bulk preview failed",
      message: "CSV must contain between 1 and 500 rows.",
    });
    redirect("/admin/bulk-operations");
  }

  const ids = csvRows
    .map((row) => normalizeJnuitsIdForCreation(clean(row.jnuits_id || row.jnuitsId)))
    .filter(Boolean);
  const emails = csvRows.map((row) => normalizeEmail(row.email)).filter(Boolean);
  const idCounts = new Map<string, number>();
  const emailCounts = new Map<string, number>();

  for (const id of ids) idCounts.set(id, (idCounts.get(id) || 0) + 1);
  for (const email of emails) emailCounts.set(email, (emailCounts.get(email) || 0) + 1);

  const duplicateIds = new Set([...idCounts].filter(([, count]) => count > 1).map(([id]) => id));
  const duplicateEmails = new Set(
    [...emailCounts].filter(([, count]) => count > 1).map(([email]) => email)
  );
  const sequenceStart = await getCurrentSequence(parsed.data.legacyYearBlock);
  const lookups = await getExistingMemberLookups(ids, emails);
  const admin = createAdminClient();
  const flexibleAdmin = asFlexibleClient(admin);
  const { data: operation, error: operationError } = await flexibleAdmin
    .from("bulk_operations" as string)
    .insert({
      created_by_user_id: actorUserId,
      metadata: {
        legacyYearBlock: parsed.data.legacyYearBlock,
      },
      operation_type: parsed.data.operationType,
      original_filename: parsed.data.originalFilename,
      status: "draft",
    })
    .select("id")
    .single();

  if (operationError || !operation?.id) {
    await setAdminFlash({
      tone: "error",
      title: "Bulk preview failed",
      message: operationError?.message || "Unable to create bulk operation.",
    });
    redirect("/admin/bulk-operations");
  }

  const rowPayload = csvRows.map((row, index) => {
    const preview = normalizePreviewRow({
      duplicateEmails,
      duplicateIds,
      emailCounts,
      existingByEmail: lookups.byEmail,
      existingById: lookups.byId,
      idCounts,
      operationType: parsed.data.operationType,
      row,
      rowIndex: index,
      sequenceStart,
      yearBlock: parsed.data.legacyYearBlock,
    });

    return {
      errors: preview.errors,
      normalized_data: preview.normalized,
      operation_id: operation.id,
      raw_data: row,
      row_number: index + 1,
      status: preview.errors.length > 0 ? "error" : "valid",
    };
  });

  const { error: rowsError } = await flexibleAdmin
    .from("bulk_operation_rows" as string)
    .insert(rowPayload);

  if (rowsError) {
    await setAdminFlash({
      tone: "error",
      title: "Bulk preview failed",
      message: rowsError.message,
    });
    redirect("/admin/bulk-operations");
  }

  await flexibleAdmin.rpc("preview_bulk_membership_operation" as string, {
    target_operation_id: operation.id,
  });

  revalidatePath("/admin/bulk-operations");
  redirect(`/admin/bulk-operations?operationId=${operation.id}`);
}

async function commitBulkRow(options: {
  actorUserId: string;
  admin: ReturnType<typeof createAdminClient>;
  operationId: string;
  operationType: BulkOperationType;
  row: BulkRowRecord;
}) {
  const flexibleAdmin = asFlexibleClient(options.admin);
  const data = options.row.normalized_data;
  const note = clean(data.note) || `Bulk operation ${options.operationId}`;

  if (options.operationType === "legacy_member_import" || options.operationType === "alumni_invite") {
    const { data: member, error } = await flexibleAdmin
      .from("members" as string)
      .insert({
        batch_no: data.batchNo ? Number(data.batchNo) : null,
        department_code: data.departmentCode || null,
        email: data.email,
        full_name: data.fullName,
        jnuits_id: data.jnuitsId,
        lifecycle_status: data.lifecycleStatus,
        member_type: data.memberType,
        phone: data.phone || null,
        portal_access_status: data.portalAccessStatus,
        professional_visibility: "members-only",
      })
      .select("id")
      .single();

    if (error || !member?.id) throw new Error(error?.message || "Unable to create member.");

    if (options.operationType === "alumni_invite") {
      const invitation = await createInvitation({
        actorUserId: options.actorUserId,
        admin: options.admin,
        memberId: member.id,
        note,
      });
      sendBulkInvitationEmail({
        email: data.email,
        invitationCode: invitation.code,
        invitationExpiresAt: invitation.expiresAt,
        jnuitsId: data.jnuitsId,
        name: data.fullName,
        type: "alumni",
      });
      return { invitationId: invitation.invitationId, memberId: member.id };
    }

    return { memberId: member.id };
  }

  if (options.operationType === "member_invite") {
    const invitation = await createInvitation({
      actorUserId: options.actorUserId,
      admin: options.admin,
      memberId: clean(data.memberId),
      note,
    });
    sendBulkInvitationEmail({
      email: data.email,
      invitationCode: invitation.code,
      invitationExpiresAt: invitation.expiresAt,
      jnuitsId: data.jnuitsId,
      name: data.fullName,
      type: "member",
    });
    return { invitationId: invitation.invitationId, memberId: data.memberId };
  }

  if (options.operationType === "lifecycle_update") {
    const { error } = await flexibleAdmin.rpc("set_member_lifecycle_status" as string, {
      next_lifecycle_status: data.lifecycleStatus,
      next_portal_access_status: data.portalAccessStatus,
      reason: note,
      target_member_id: data.memberId,
    });
    if (error) throw new Error(error.message);
    return { memberId: data.memberId };
  }

  if (options.operationType === "role_update") {
    await assignPortalRole({
      actorUserId: options.actorUserId,
      admin: options.admin,
      note,
      roleCode: clean(data.portalRole),
      targetUserId: clean(data.targetUserId),
    });
    return { memberId: data.memberId, portalRole: data.portalRole };
  }

  if (options.operationType === "alumni_conversion") {
    const { error } = await flexibleAdmin.rpc("set_member_lifecycle_status" as string, {
      next_lifecycle_status: "alumni",
      next_portal_access_status: "active",
      reason: note,
      target_member_id: data.memberId,
    });
    if (error) throw new Error(error.message);
    if (data.targetUserId) {
      await assignPortalRole({
        actorUserId: options.actorUserId,
        admin: options.admin,
        note,
        roleCode: "alumni",
        targetUserId: clean(data.targetUserId),
      });
    }
    sendBulkDecisionEmail({
      decision: "approved",
      email: data.email,
      name: data.fullName,
      requestType: "alumni_conversion",
      reviewNote: note,
    });
    return { memberId: data.memberId };
  }

  if (options.operationType === "account_deletion_review") {
    if (data.decision === "approved") {
      const { error } = await flexibleAdmin.rpc("set_member_lifecycle_status" as string, {
        next_lifecycle_status: "deleted",
        next_portal_access_status: "deactivated",
        reason: note,
        target_member_id: data.memberId,
      });
      if (error) throw new Error(error.message);

      if (data.targetUserId) {
        await flexibleAdmin
          .from("rbac_user_platform_roles" as string)
          .update({
            note: "Revoked by bulk account deletion review.",
            revoked_at: new Date().toISOString(),
          })
          .eq("user_id", clean(data.targetUserId))
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
        .eq("id", data.memberId);
    }

    sendBulkDecisionEmail({
      decision: data.decision === "approved" ? "approved" : "rejected",
      email: data.email,
      name: data.fullName,
      requestType: "account_deletion",
      reviewNote: note,
    });

    return { memberId: data.memberId, decision: data.decision };
  }

  return { memberId: data.memberId, decision: data.decision };
}

export async function commitBulkOperationAction(formData: FormData) {
  const auth = await requireAdminPermission("admin.bulk.manage", {
    fallbackPath: "/admin/bulk-operations",
  });
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/admin/login?next=%2Fadmin%2Fbulk-operations");
  }

  const parsed = commitSchema.safeParse(pickFormFields(formData, ["operationId"]));

  if (!parsed.success) {
    await setAdminFlash({
      tone: "error",
      title: "Bulk commit failed",
      message: parsed.error.issues[0]?.message || "Invalid bulk commit request.",
    });
    redirect("/admin/bulk-operations");
  }

  const admin = createAdminClient();
  const flexibleAdmin = asFlexibleClient(admin);
  const { data: operation, error: operationError } = await flexibleAdmin
    .from("bulk_operations" as string)
    .select("id, operation_type, status, total_rows, error_rows, committed_rows")
    .eq("id", parsed.data.operationId)
    .maybeSingle();

  if (operationError || !operation) {
    await setAdminFlash({
      tone: "error",
      title: "Bulk commit failed",
      message: operationError?.message || "Bulk operation was not found.",
    });
    redirect("/admin/bulk-operations");
  }

  if (operation.status === "committed") {
    redirect(`/admin/bulk-operations?operationId=${operation.id}`);
  }

  if (operation.status !== "previewed" || operation.error_rows > 0) {
    await setAdminFlash({
      tone: "error",
      title: "Bulk commit blocked",
      message: "Only previewed bulk operations with zero row errors can be committed.",
    });
    redirect(`/admin/bulk-operations?operationId=${operation.id}`);
  }

  const { data: rowData } = await flexibleAdmin
    .from("bulk_operation_rows" as string)
    .select("id, row_number, normalized_data, status")
    .eq("operation_id", operation.id)
    .in("status", ["valid", "committed"])
    .order("row_number", { ascending: true });
  const rows = (rowData || []) as BulkRowRecord[];
  let committedRows = 0;

  await flexibleAdmin
    .from("bulk_operations" as string)
    .update({ status: "committing" })
    .eq("id", operation.id);

  for (const row of rows) {
    if (row.status === "committed") {
      committedRows += 1;
      continue;
    }

    try {
      const result = await commitBulkRow({
        actorUserId,
        admin,
        operationId: operation.id,
        operationType: operation.operation_type,
        row,
      });
      await flexibleAdmin
        .from("bulk_operation_rows" as string)
        .update({
          result,
          status: "committed",
        })
        .eq("id", row.id);
      committedRows += 1;
    } catch (error) {
      await flexibleAdmin
        .from("bulk_operation_rows" as string)
        .update({
          errors: [error instanceof Error ? error.message : "Commit failed."],
          status: "error",
        })
        .eq("id", row.id);
      await flexibleAdmin
        .from("bulk_operations" as string)
        .update({ status: "failed" })
        .eq("id", operation.id);
      await setAdminFlash({
        tone: "error",
        title: "Bulk commit failed",
        message: `Row ${row.row_number} failed during commit.`,
      });
      redirect(`/admin/bulk-operations?operationId=${operation.id}`);
    }
  }

  await flexibleAdmin
    .from("bulk_operations" as string)
    .update({
      committed_at: new Date().toISOString(),
      committed_by_user_id: actorUserId,
      committed_rows: committedRows,
      status: "committed",
    })
    .eq("id", operation.id);

  await recordSecurityEvent(admin, {
    actorUserId,
    eventType: "bulk_operation.committed",
    payload: {
      committedRows,
      operationId: operation.id,
      operationType: operation.operation_type,
    },
  });

  if (auth.user?.email) {
    void sendEmail({
      html: buildBulkOperationSummaryEmail({
        committedRows,
        errorRows: typeof operation.error_rows === "number" ? operation.error_rows : 0,
        operationId: operation.id,
        operationType: operation.operation_type,
        operatorName: auth.user.email,
        totalRows: typeof operation.total_rows === "number" ? operation.total_rows : rows.length,
      }),
      subject: `JnUITS bulk operation committed: ${operation.operation_type}`,
      to: auth.user.email,
    });
  }

  revalidatePath("/admin/bulk-operations");
  await setAdminFlash({
    tone: "success",
    title: "Bulk operation committed",
    message: `${committedRows} rows committed.`,
  });
  redirect(`/admin/bulk-operations?operationId=${operation.id}`);
}
