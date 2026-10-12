"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parse } from "csv-parse/sync";
import { z } from "zod";

import { setAdminFlash } from "@/lib/admin/flash";
import { getSafeAdminActionErrorMessage } from "@/lib/admin/action-error";
import { issueInvitationForMember } from "@/lib/admin/invitations";
import {
  BULK_LIFECYCLE_STATUSES,
  BULK_MEMBER_TYPES,
  BULK_PORTAL_ACCESS_STATUSES,
  BULK_PORTAL_ROLES,
  BULK_REVIEW_DECISIONS,
  BULK_OPERATION_TYPES,
  createBulkOperationIssue,
  type BulkOperationRowIssue,
  type BulkOperationType,
} from "@/lib/admin/bulk-operation-templates";
import { requireAdminPermission } from "@/lib/auth/session";
import { DEFAULT_INVITATION_EXPIRY_DAYS } from "@/lib/members/invitation-code";
import { normalizeJnuitsIdForCreation } from "@/lib/members/jnuits-id";
import {
  buildAlumniConversionDecisionEmail,
  buildBulkOperationSummaryEmail,
  buildDeletionRequestStatusEmail,
} from "@/lib/notifications/email-builders";
import { allowsOptionalEmail } from "@/lib/notifications/preferences";
import { sendEmail } from "@/lib/notifications/send-email";
import { recordSecurityEvent } from "@/lib/security/security-events";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";

type CsvRow = Record<string, string | undefined>;

type BulkRowRecord = {
  id: string;
  normalized_data: Record<string, unknown>;
  row_number: number;
  status: string;
};

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
  return (BULK_LIFECYCLE_STATUSES as readonly string[]).includes(status)
    ? status
    : "";
}

function normalizePortalAccessStatus(value: unknown) {
  const status = clean(value).toLowerCase();
  return (BULK_PORTAL_ACCESS_STATUSES as readonly string[]).includes(status)
    ? status
    : "";
}

function normalizePortalRole(value: unknown) {
  const role = clean(value).toLowerCase();
  return (BULK_PORTAL_ROLES as readonly string[]).includes(role)
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

async function createInvitation(options: {
  actorUserId: string;
  admin: ReturnType<typeof createAdminClient>;
  email: unknown;
  jnuitsId: unknown;
  memberId: string;
  name: unknown;
  note: string;
  type: "alumni" | "member";
}) {
  return issueInvitationForMember({
    actorUserId: options.actorUserId,
    admin: options.admin,
    emailVariant: options.type,
    expiresInDays: DEFAULT_INVITATION_EXPIRY_DAYS,
    invitationType: "bulk_csv",
    maxUses: 1,
    member: {
      email: normalizeEmail(options.email) || null,
      full_name: clean(options.name) || null,
      id: options.memberId,
      jnuits_id: clean(options.jnuitsId) || null,
    },
    note: options.note,
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
  const errors: BulkOperationRowIssue[] = [];
  const normalized: Record<string, unknown> = {};
  const idInput = clean(options.row.jnuits_id || options.row.jnuitsId);
  const email = normalizeEmail(options.row.email);
  let jnuitsId = idInput ? normalizeJnuitsIdForCreation(idInput) : "";

  function addIssue(
    field: string,
    code: string,
    explanation: string,
    receivedValue: unknown
  ) {
    errors.push(
      createBulkOperationIssue({
        code,
        explanation,
        field,
        operationType: options.operationType,
        receivedValue,
        sourceRow: options.rowIndex + 2,
      })
    );
  }

  if (email) {
    normalized.email = email;
    if (options.duplicateEmails.has(email)) {
      addIssue("email", "duplicate_email", "Email is duplicated in this CSV.", options.row.email);
    }
  } else if (
    ["legacy_member_import", "alumni_invite", "member_invite"].includes(
      options.operationType
    )
  ) {
    addIssue("email", "email_invalid", "A valid email is required.", options.row.email);
  }

  if (!jnuitsId && ["legacy_member_import", "alumni_invite"].includes(options.operationType)) {
    const serial = options.sequenceStart + options.rowIndex + 1;
    if (serial > 999) {
      addIssue(
        "jnuits_id",
        "year_block_exhausted",
        `${options.yearBlock} block has no remaining serials.`,
        idInput
      );
    } else {
      jnuitsId = `JNUITS-${options.yearBlock}${String(serial).padStart(3, "0")}`;
    }
  }

  if (jnuitsId) {
    normalized.jnuitsId = jnuitsId;
    if (options.duplicateIds.has(jnuitsId)) {
      addIssue(
        "jnuits_id",
        "duplicate_jnuits_id",
        "JnUITS ID is duplicated in this CSV.",
        idInput
      );
    }
  } else if (options.operationType !== "legacy_member_import") {
    addIssue(
      "jnuits_id",
      "jnuits_id_invalid",
      "A valid JnUITS ID is required.",
      idInput
    );
  }

  if (["legacy_member_import", "alumni_invite"].includes(options.operationType)) {
    const fullName = clean(options.row.full_name || options.row.fullName || options.row.name);
    const memberType = clean(options.row.member_type || options.row.memberType).toLowerCase();
    const normalizedMemberType =
      options.operationType === "alumni_invite" || memberType === BULK_MEMBER_TYPES[2]
        ? "alumni"
        : "current";
    const lifecycleStatus =
      options.operationType === "alumni_invite"
        ? "alumni"
        : memberType === BULK_MEMBER_TYPES[1]
        ? "former"
        : normalizedMemberType === "alumni"
          ? "alumni"
          : "current";

    if (!fullName) {
      addIssue("full_name", "full_name_required", "Full name is required.", fullName);
    }
    if (jnuitsId && options.existingById.has(jnuitsId)) {
      addIssue("jnuits_id", "jnuits_id_exists", "JnUITS ID already exists.", jnuitsId);
    }
    if (email && options.existingByEmail.has(email)) {
      addIssue("email", "email_exists", "Email already exists.", email);
    }

    normalized.fullName = fullName;
    normalized.memberType = normalizedMemberType;
    normalized.lifecycleStatus = lifecycleStatus;
    normalized.portalAccessStatus = lifecycleStatus === "former" ? "frozen" : "active";
    normalized.departmentCode = clean(options.row.department_code || options.row.departmentCode) || null;
    const batchNo = clean(options.row.batch_no || options.row.batchNo);
    if (batchNo && (!/^[0-9]{1,2}$/.test(batchNo) || Number(batchNo) < 1 || Number(batchNo) > 99)) {
      addIssue("batch_no", "batch_invalid", "Batch must be a whole number from 1 to 99, for example 08.", batchNo);
    }
    normalized.batchNo = batchNo || null;
    normalized.phone = clean(options.row.phone) || null;
  }

  if (options.operationType === "member_invite") {
    const member = jnuitsId ? options.existingById.get(jnuitsId) : null;
    if (!member) {
      addIssue("jnuits_id", "member_not_found", "Member does not exist.", jnuitsId);
    }
    if (member?.is_profile_claimed) {
      addIssue(
        "jnuits_id",
        "member_already_claimed",
        "Member profile is already claimed.",
        jnuitsId
      );
    }
    normalized.fullName = member?.full_name || null;
    normalized.memberId = member?.id || null;
  }

  if (options.operationType === "lifecycle_update") {
    const lifecycleStatus = normalizeLifecycleStatus(options.row.lifecycle_status);
    const portalAccessStatus = normalizePortalAccessStatus(options.row.portal_access_status);
    const member = jnuitsId ? options.existingById.get(jnuitsId) : null;
    if (!member) {
      addIssue("jnuits_id", "member_not_found", "Member does not exist.", jnuitsId);
    }
    if (!lifecycleStatus) {
      addIssue(
        "lifecycle_status",
        "invalid_lifecycle_status",
        "Lifecycle status is not recognized.",
        options.row.lifecycle_status
      );
    }
    if (!portalAccessStatus) {
      addIssue(
        "portal_access_status",
        "invalid_portal_access_status",
        "Portal access status is not recognized.",
        options.row.portal_access_status
      );
    }
    normalized.memberId = member?.id || null;
    normalized.lifecycleStatus = lifecycleStatus;
    normalized.portalAccessStatus = portalAccessStatus;
  }

  if (options.operationType === "role_update") {
    const portalRole = normalizePortalRole(options.row.portal_role || options.row.role);
    const member = jnuitsId ? options.existingById.get(jnuitsId) : null;
    if (!member) {
      addIssue("jnuits_id", "member_not_found", "Member does not exist.", jnuitsId);
    }
    if (member && !member.user_id) {
      addIssue(
        "jnuits_id",
        "portal_account_missing",
        "Member has no linked portal account.",
        jnuitsId
      );
    }
    if (!portalRole) {
      addIssue(
        "portal_role",
        "invalid_portal_role",
        "Portal role is not recognized.",
        options.row.portal_role || options.row.role
      );
    }
    normalized.memberId = member?.id || null;
    normalized.portalRole = portalRole;
    normalized.targetUserId = member?.user_id || null;
  }

  if (options.operationType === "alumni_conversion") {
    const member = jnuitsId ? options.existingById.get(jnuitsId) : null;
    if (!member) {
      addIssue("jnuits_id", "member_not_found", "Member does not exist.", jnuitsId);
    }
    normalized.email = member?.email || null;
    normalized.fullName = member?.full_name || null;
    normalized.memberId = member?.id || null;
    normalized.targetUserId = member?.user_id || null;
  }

  if (options.operationType === "account_deletion_review") {
    const decision = clean(options.row.decision).toLowerCase();
    const member = jnuitsId ? options.existingById.get(jnuitsId) : null;
    if (!member) {
      addIssue("jnuits_id", "member_not_found", "Member does not exist.", jnuitsId);
    }
    if (!(BULK_REVIEW_DECISIONS as readonly string[]).includes(decision)) {
      addIssue(
        "decision",
        "invalid_decision",
        "Decision must be approved or rejected.",
        options.row.decision
      );
    }
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
      message: getSafeAdminActionErrorMessage(operationError, {
        context: "bulk.preview.createOperation",
        fallback: "Unable to create bulk operation.",
      }),
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
      message: getSafeAdminActionErrorMessage(rowsError, {
        context: "bulk.preview.createRows",
        fallback: "Unable to create bulk operation rows.",
      }),
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
        professional_visibility: "public",
      })
      .select("id")
      .single();

    if (error || !member?.id) throw new Error(error?.message || "Unable to create member.");

    if (options.operationType === "alumni_invite") {
      const invitation = await createInvitation({
        actorUserId: options.actorUserId,
        admin: options.admin,
        email: data.email,
        jnuitsId: data.jnuitsId,
        memberId: member.id,
        name: data.fullName,
        note,
        type: "alumni",
      });
      return {
        deliveryStatus: invitation.deliveryStatus,
        invitationId: invitation.invitationId,
        memberId: member.id,
      };
    }

    return { memberId: member.id };
  }

  if (options.operationType === "member_invite") {
    const invitation = await createInvitation({
      actorUserId: options.actorUserId,
      admin: options.admin,
      email: data.email,
      jnuitsId: data.jnuitsId,
      memberId: clean(data.memberId),
      name: data.fullName,
      note,
      type: "member",
    });
    return {
      deliveryStatus: invitation.deliveryStatus,
      invitationId: invitation.invitationId,
      memberId: data.memberId,
    };
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
      message: getSafeAdminActionErrorMessage(operationError, {
        context: "bulk.commit.loadOperation",
        fallback: "Bulk operation was not found.",
      }),
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
      const safeMessage = getSafeAdminActionErrorMessage(error, {
        context: "bulk.commitRow",
        fallback: "Commit failed.",
      });

      await flexibleAdmin
        .from("bulk_operation_rows" as string)
        .update({
          errors: [safeMessage],
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

  if (
    auth.user?.email &&
    (await allowsOptionalEmail(actorUserId, "notification_email_opt_in"))
  ) {
    await sendEmail({
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
