"use server";

import { revalidatePath } from "next/cache";
import { parse } from "csv-parse/sync";
import { z } from "zod";

import { requireAdminPermission } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";
import { normalizeJnuitsIdForCreation } from "@/lib/members/jnuits-id";
import {
  issueInvitationForMember,
  persistInvitationAudit,
  revokeInvitationRecord,
  syncInvitationBatchMetrics,
  type InvitationMember,
  type InvitationType,
} from "@/lib/admin/invitations";

type ActionResult = {
  code?: string;
  details?: Record<string, unknown>;
  jnuitsId?: string;
  message: string;
  ok: boolean;
};

type CsvRow = Record<string, string | undefined>;

const BATCH_STATUSES = ["draft", "active", "closed", "archived"] as const;
const BATCH_SOURCES = ["manual", "csv_onboarding", "reconciliation", "renewal"] as const;

const optionalPositiveInt = (fallback: number, max: number) =>
  z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce.number().int().min(1).max(max).optional().default(fallback)
  );

const directInviteSchema = z.object({
  expiresInDays: optionalPositiveInt(14, 365),
  invitationType: z.enum(["member_claim", "alumni_direct"]).default("member_claim"),
  maxUses: optionalPositiveInt(1, 1000),
  note: z.string().trim().max(1000).optional().default(""),
  target: z.string().trim().min(1, "Member ID or email is required.").max(180),
});

const createBatchSchema = z.object({
  cycleId: z.string().trim().max(80).optional().default(""),
  expiresAt: z.string().trim().max(80).optional().default(""),
  label: z.string().trim().min(1, "Batch label is required.").max(180),
  source: z.enum(BATCH_SOURCES).default("manual"),
  status: z.enum(BATCH_STATUSES).default("draft"),
});

const issueBatchSchema = z.object({
  batchId: z.string().trim().min(1, "Batch is required.").max(80),
  expiresInDays: optionalPositiveInt(14, 365),
  maxUses: optionalPositiveInt(1, 1000),
  onlyPendingRenewal: z.boolean().optional().default(true),
});

const batchIdSchema = z.object({
  batchId: z.string().trim().min(1, "Batch is required.").max(80),
});

const batchStatusSchema = batchIdSchema.extend({
  nextStatus: z.enum(BATCH_STATUSES),
});

const invitationIdSchema = z.object({
  invitationId: z.string().trim().min(1, "Invitation is required.").max(80),
  reason: z.string().trim().max(1000).optional().default(""),
});

const invitationReissueSchema = invitationIdSchema.extend({
  expiresInDays: optionalPositiveInt(14, 365),
  maxUses: optionalPositiveInt(1, 1000),
});

const bulkRevokeSchema = z.object({
  invitationIds: z.array(z.string().trim().min(1).max(80)).min(1).max(100),
  reason: z.string().trim().max(1000).optional().default(""),
});

const csvSchema = z.object({
  csvContent: z.string().trim().min(1, "CSV content is required."),
  expiresInDays: optionalPositiveInt(14, 365),
  invitationType: z.enum(["member_claim", "alumni_direct"]).default("member_claim"),
  maxUses: optionalPositiveInt(1, 1000),
  note: z.string().trim().max(1000).optional().default(""),
});

function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseCsvRows(csvContent: string) {
  return parse(csvContent, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CsvRow[];
}

async function requireInvitationAdmin() {
  return requireAdminPermission("admin.membership.manage", {
    fallbackPath: "/admin/invitations",
  });
}

async function resolveMemberByTarget(target: string) {
  const admin = createAdminClient();
  const flexibleAdmin = asFlexibleClient(admin);
  const normalizedId = normalizeJnuitsIdForCreation(target);
  const normalizedEmail = normalizeEmail(target);

  if (normalizedId) {
    const { data, error } = await flexibleAdmin
      .from("members" as string)
      .select("id, full_name, email, jnuits_id, member_type, lifecycle_status, is_profile_claimed")
      .eq("jnuits_id", normalizedId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return (data || null) as InvitationMember | null;
  }

  if (normalizedEmail) {
    const { data, error } = await flexibleAdmin
      .from("members" as string)
      .select("id, full_name, email, jnuits_id, member_type, lifecycle_status, is_profile_claimed")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return (data || null) as InvitationMember | null;
  }

  return null;
}

async function hasActiveInvitation(memberId: string, batchId?: null | string) {
  const flexibleAdmin = asFlexibleClient(createAdminClient());
  let query = flexibleAdmin
    .from("member_invitations" as string)
    .select("id")
    .eq("member_id", memberId)
    .eq("is_active", true)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .limit(1);

  if (batchId) {
    query = query.eq("batch_id", batchId);
  }

  const { data } = await query.maybeSingle();
  return Boolean(data?.id);
}

function isEligibleForAlumniInvite(member: InvitationMember) {
  return (
    member.lifecycle_status === "alumni" ||
    member.lifecycle_status === "former" ||
    member.member_type === "alumni"
  );
}

function csvDisplayName(row: CsvRow) {
  return clean(row.full_name || row.fullName || row.name);
}

async function createLegacyAlumniMemberFromCsv(
  admin: ReturnType<typeof createAdminClient>,
  row: CsvRow
) {
  const flexibleAdmin = asFlexibleClient(admin);
  const email = normalizeEmail(row.email || "");
  const fullName = csvDisplayName(row);

  if (!email || !fullName) {
    throw new Error("Missing alumni name or email.");
  }

  const providedId = normalizeJnuitsIdForCreation(
    clean(row.jnuits_id || row.jnuitsId || row.member_id)
  );
  const { data: allocatedId, error: allocationError } = providedId
    ? { data: providedId, error: null }
    : await flexibleAdmin.rpc("allocate_membership_id" as string, { year_block: "0000" });

  if (allocationError || !allocatedId) {
    throw new Error(allocationError?.message || "Unable to allocate legacy alumni ID.");
  }

  const { data: member, error } = await flexibleAdmin
    .from("members" as string)
    .insert({
      batch_no: row.batch_no || row.batchNo ? Number(row.batch_no || row.batchNo) || null : null,
      department_code: clean(row.department_code || row.departmentCode) || null,
      email,
      full_name: fullName,
      jnuits_id: allocatedId,
      lifecycle_status: "alumni",
      member_type: "alumni",
      phone: clean(row.phone) || null,
      portal_access_status: "active",
      professional_visibility: "members-only",
    })
    .select("id, full_name, email, jnuits_id, member_type, lifecycle_status, is_profile_claimed")
    .single();

  if (error || !member?.id) {
    throw new Error(error?.message || "Unable to create legacy alumni record.");
  }

  return member as InvitationMember;
}

export async function issueDirectInvitationAction(input: unknown): Promise<ActionResult> {
  try {
    const auth = await requireInvitationAdmin();
    const actorUserId = auth.user?.id;
    const parsed = directInviteSchema.parse(input);

    if (!actorUserId) {
      return { ok: false, message: "Admin session is missing." };
    }

    const admin = createAdminClient();
    const member = await resolveMemberByTarget(parsed.target);

    if (!member) {
      return { ok: false, message: "No matching member record was found." };
    }

    if (parsed.invitationType === "alumni_direct" && !isEligibleForAlumniInvite(member)) {
      return {
        ok: false,
        message: "Direct alumni invitations require an existing alumni or former-member record.",
      };
    }

    if (await hasActiveInvitation(member.id)) {
      return {
        ok: false,
        message: "This member already has an active invitation. Use replacement if the code is lost.",
      };
    }

    const result = await issueInvitationForMember({
      actorUserId,
      admin,
      expiresInDays: parsed.expiresInDays,
      invitationType: parsed.invitationType,
      maxUses: parsed.maxUses,
      member,
      note: parsed.note || `Direct ${parsed.invitationType} invitation`,
    });

    await persistInvitationAudit(admin, {
      action: "membership.invitation_direct_issued",
      actor_user_id: actorUserId,
      entity_id: result.invitationId,
      entity_type: "member_invitation",
      metadata: {
        deliveryStatus: result.deliveryStatus,
        invitationType: parsed.invitationType,
        memberId: member.id,
      },
    });

    revalidatePath("/admin/invitations");
    return {
      code: result.code,
      jnuitsId: member.jnuits_id || undefined,
      message:
        result.deliveryStatus === "failed"
          ? `Invitation created, but email delivery failed: ${result.deliveryError || "unknown error"}`
          : "Invitation issued. The raw code is shown once.",
      ok: true,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to issue invitation.",
    };
  }
}

export async function createInvitationBatchAction(input: unknown): Promise<ActionResult> {
  try {
    const auth = await requireInvitationAdmin();
    const actorUserId = auth.user?.id;
    const parsed = createBatchSchema.parse(input);

    if (!actorUserId) {
      return { ok: false, message: "Admin session is missing." };
    }

    const admin = createAdminClient();
    const { data, error } = await asFlexibleClient(admin)
      .from("invitation_batches" as string)
      .insert({
        created_by_user_id: actorUserId,
        cycle_id: parsed.cycleId || null,
        expires_at: parsed.expiresAt || null,
        label: parsed.label,
        source: parsed.source,
        status: parsed.status,
      })
      .select("id")
      .single();

    if (error || !data?.id) {
      throw new Error(error?.message || "Unable to create invitation batch.");
    }

    await persistInvitationAudit(admin, {
      action: "membership.invitation_batch_created",
      actor_user_id: actorUserId,
      entity_id: data.id,
      entity_type: "invitation_batch",
      metadata: parsed,
    });

    revalidatePath("/admin/invitations");
    revalidatePath("/admin/membership");
    return { ok: true, message: "Invitation batch created.", details: { batchId: data.id } };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to create invitation batch.",
    };
  }
}

export async function issueInvitationsFromBatchAction(input: unknown): Promise<ActionResult> {
  try {
    const auth = await requireInvitationAdmin();
    const actorUserId = auth.user?.id;
    const parsed = issueBatchSchema.parse(input);

    if (!actorUserId) {
      return { ok: false, message: "Admin session is missing." };
    }

    const admin = createAdminClient();
    const flexibleAdmin = asFlexibleClient(admin);
    const { data: batch, error: batchError } = await flexibleAdmin
      .from("invitation_batches" as string)
      .select("id, cycle_id, label")
      .eq("id", parsed.batchId)
      .maybeSingle();

    if (batchError || !batch) {
      throw new Error(batchError?.message || "Invitation batch could not be loaded.");
    }

    if (!batch.cycle_id) {
      return { ok: false, message: "This batch is not linked to a membership cycle." };
    }

    let queue = flexibleAdmin
      .from("membership_cycle_memberships" as string)
      .select("id, member_id, state, members(id, full_name, email, jnuits_id, member_type, lifecycle_status, is_profile_claimed)")
      .eq("cycle_id", batch.cycle_id);

    if (parsed.onlyPendingRenewal) {
      queue = queue.eq("state", "pending_renewal");
    } else {
      queue = queue.in("state", ["active", "pending_renewal", "renewed"]);
    }

    const { data: rows, error: queueError } = await queue.limit(500);

    if (queueError) {
      throw new Error(queueError.message);
    }

    let failed = 0;
    let issued = 0;
    let skipped = 0;

    for (const row of (rows || []) as { members?: InvitationMember | InvitationMember[] | null }[]) {
      const member = Array.isArray(row.members) ? row.members[0] : row.members;

      if (!member || member.is_profile_claimed || (await hasActiveInvitation(member.id, batch.id))) {
        skipped += 1;
        continue;
      }

      const result = await issueInvitationForMember({
        actorUserId,
        admin,
        batchId: batch.id,
        expiresInDays: parsed.expiresInDays,
        invitationType: "renewal",
        maxUses: parsed.maxUses,
        member,
        note: `[batch:${batch.id}] ${batch.label}`,
      });

      issued += 1;
      if (result.deliveryStatus === "failed") {
        failed += 1;
      }
    }

    const metrics = await syncInvitationBatchMetrics(admin, batch.id);
    await flexibleAdmin
      .from("invitation_batches" as string)
      .update({
        metadata: {
          failedCount: metrics.failedCount,
          issuedThisRun: issued,
          lastIssuedAt: new Date().toISOString(),
          onlyPendingRenewal: parsed.onlyPendingRenewal,
          skippedThisRun: skipped,
        },
        status: metrics.issuedCount > 0 ? "active" : "draft",
      })
      .eq("id", batch.id);

    await persistInvitationAudit(admin, {
      action: "membership.invitation_batch_issued",
      actor_user_id: actorUserId,
      entity_id: batch.id,
      entity_type: "invitation_batch",
      metadata: { failed, issued, skipped, ...metrics },
    });

    revalidatePath("/admin/invitations");
    revalidatePath("/admin/membership");
    return {
      ok: true,
      message: `${issued} invitations issued. ${skipped} skipped. ${failed} delivery failures.`,
      details: { failed, issued, skipped },
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to issue invitations.",
    };
  }
}

export async function syncInvitationBatchMetricsAction(input: unknown): Promise<ActionResult> {
  try {
    const auth = await requireInvitationAdmin();
    const parsed = batchIdSchema.parse(input);
    const admin = createAdminClient();
    const metrics = await syncInvitationBatchMetrics(admin, parsed.batchId);

    await persistInvitationAudit(admin, {
      action: "membership.invitation_batch_synced",
      actor_user_id: auth.user?.id || null,
      entity_id: parsed.batchId,
      entity_type: "invitation_batch",
      metadata: metrics,
    });

    revalidatePath("/admin/invitations");
    revalidatePath("/admin/membership");
    return { ok: true, message: "Batch metrics synced.", details: metrics };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to sync batch metrics.",
    };
  }
}

export async function updateInvitationBatchStatusAction(input: unknown): Promise<ActionResult> {
  try {
    const auth = await requireInvitationAdmin();
    const parsed = batchStatusSchema.parse(input);
    const admin = createAdminClient();
    const { error } = await asFlexibleClient(admin)
      .from("invitation_batches" as string)
      .update({ status: parsed.nextStatus })
      .eq("id", parsed.batchId);

    if (error) {
      throw new Error(error.message);
    }

    await persistInvitationAudit(admin, {
      action: "membership.invitation_batch_status_updated",
      actor_user_id: auth.user?.id || null,
      entity_id: parsed.batchId,
      entity_type: "invitation_batch",
      metadata: { nextStatus: parsed.nextStatus },
    });

    revalidatePath("/admin/invitations");
    revalidatePath("/admin/membership");
    return { ok: true, message: `Batch marked ${parsed.nextStatus}.` };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to update batch status.",
    };
  }
}

export async function revokeInvitationAction(input: unknown): Promise<ActionResult> {
  try {
    const auth = await requireInvitationAdmin();
    const actorUserId = auth.user?.id;
    const parsed = invitationIdSchema.parse(input);

    if (!actorUserId) {
      return { ok: false, message: "Admin session is missing." };
    }

    const admin = createAdminClient();
    await revokeInvitationRecord({
      actorUserId,
      admin,
      invitationId: parsed.invitationId,
      reason: parsed.reason || "Revoked from invitations workspace.",
    });

    await persistInvitationAudit(admin, {
      action: "membership.invitation_revoked",
      actor_user_id: actorUserId,
      entity_id: parsed.invitationId,
      entity_type: "member_invitation",
      metadata: { reason: parsed.reason || null },
    });

    revalidatePath("/admin/invitations");
    return { ok: true, message: "Invitation revoked." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to revoke invitation.",
    };
  }
}

export async function reissueInvitationAction(input: unknown): Promise<ActionResult> {
  try {
    const auth = await requireInvitationAdmin();
    const actorUserId = auth.user?.id;
    const parsed = invitationReissueSchema.parse(input);

    if (!actorUserId) {
      return { ok: false, message: "Admin session is missing." };
    }

    const admin = createAdminClient();
    const flexibleAdmin = asFlexibleClient(admin);
    const { data: invitation, error } = await flexibleAdmin
      .from("member_invitations" as string)
      .select("id, batch_id, member_id, invitation_type, notes, members(id, full_name, email, jnuits_id, member_type, lifecycle_status, is_profile_claimed)")
      .eq("id", parsed.invitationId)
      .maybeSingle();

    if (error || !invitation) {
      throw new Error(error?.message || "Invitation could not be loaded.");
    }

    const member = Array.isArray(invitation.members)
      ? invitation.members[0]
      : invitation.members;

    if (!member) {
      throw new Error("Linked member record could not be loaded.");
    }

    await revokeInvitationRecord({
      actorUserId,
      admin,
      invitationId: parsed.invitationId,
      reason: parsed.reason || "Replacement code issued.",
    });

    const result = await issueInvitationForMember({
      actorUserId,
      admin,
      batchId: invitation.batch_id || null,
      expiresInDays: parsed.expiresInDays,
      invitationType: "replacement",
      maxUses: parsed.maxUses,
      member,
      note: parsed.reason || invitation.notes || "Replacement invitation.",
    });

    await persistInvitationAudit(admin, {
      action: "membership.invitation_reissued",
      actor_user_id: actorUserId,
      entity_id: result.invitationId,
      entity_type: "member_invitation",
      metadata: {
        previousInvitationId: parsed.invitationId,
        previousType: invitation.invitation_type || null,
      },
    });

    revalidatePath("/admin/invitations");
    return {
      code: result.code,
      jnuitsId: member.jnuits_id || undefined,
      message:
        result.deliveryStatus === "failed"
          ? `Replacement created, but email delivery failed: ${result.deliveryError || "unknown error"}`
          : "Replacement issued. The raw code is shown once.",
      ok: true,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to reissue invitation.",
    };
  }
}

export async function bulkRevokeInvitationsAction(input: unknown): Promise<ActionResult> {
  try {
    const auth = await requireInvitationAdmin();
    const actorUserId = auth.user?.id;
    const parsed = bulkRevokeSchema.parse(input);

    if (!actorUserId) {
      return { ok: false, message: "Admin session is missing." };
    }

    const admin = createAdminClient();
    for (const invitationId of parsed.invitationIds) {
      await revokeInvitationRecord({
        actorUserId,
        admin,
        invitationId,
        reason: parsed.reason || "Bulk revoked from invitations workspace.",
      });
    }

    await persistInvitationAudit(admin, {
      action: "membership.invitation_bulk_revoked",
      actor_user_id: actorUserId,
      entity_id: null,
      entity_type: "member_invitation",
      metadata: {
        count: parsed.invitationIds.length,
        reason: parsed.reason || null,
      },
    });

    revalidatePath("/admin/invitations");
    return { ok: true, message: `${parsed.invitationIds.length} invitations revoked.` };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to bulk revoke invitations.",
    };
  }
}

export async function previewCsvInvitationsAction(input: unknown): Promise<ActionResult> {
  try {
    await requireInvitationAdmin();
    const parsed = csvSchema.parse(input);
    const rows = parseCsvRows(parsed.csvContent).slice(0, 500);
    const preview = [];

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const target = row.jnuits_id || row.jnuitsId || row.member_id || row.email || "";
      const member = target ? await resolveMemberByTarget(target) : null;
      const canCreateLegacyAlumni =
        parsed.invitationType === "alumni_direct" &&
        !member &&
        Boolean(normalizeEmail(row.email || "")) &&
        Boolean(csvDisplayName(row));
      const eligible = member
        ? parsed.invitationType !== "alumni_direct" || isEligibleForAlumniInvite(member)
        : canCreateLegacyAlumni;

      preview.push({
        email: row.email || member?.email || "",
        jnuitsId: row.jnuits_id || row.jnuitsId || member?.jnuits_id || "",
        message: member
          ? eligible
            ? "Ready"
            : "Not eligible for alumni invite"
          : canCreateLegacyAlumni
            ? "Ready - will create legacy alumni record"
            : "No matching member",
        name: csvDisplayName(row) || member?.full_name || "",
        row: index + 1,
        status: eligible ? "ready" : "blocked",
      });
    }

    return {
      details: {
        blocked: preview.filter((row) => row.status !== "ready").length,
        ready: preview.filter((row) => row.status === "ready").length,
        rows: preview,
      },
      message: `Previewed ${preview.length} rows.`,
      ok: true,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to preview CSV.",
    };
  }
}

export async function commitCsvInvitationsAction(input: unknown): Promise<ActionResult> {
  try {
    const auth = await requireInvitationAdmin();
    const actorUserId = auth.user?.id;
    const parsed = csvSchema.parse(input);

    if (!actorUserId) {
      return { ok: false, message: "Admin session is missing." };
    }

    const admin = createAdminClient();
    const rows = parseCsvRows(parsed.csvContent).slice(0, 500);
    let failed = 0;
    let issued = 0;
    let skipped = 0;

    for (const row of rows) {
      const target = row.jnuits_id || row.jnuitsId || row.member_id || row.email || "";
      let member = target ? await resolveMemberByTarget(target) : null;

      if (!member && parsed.invitationType === "alumni_direct") {
        try {
          member = await createLegacyAlumniMemberFromCsv(admin, row);
          await persistInvitationAudit(admin, {
            action: "membership.legacy_alumni_created_for_invite",
            actor_user_id: actorUserId,
            entity_id: member.id,
            entity_type: "member",
            metadata: {
              email: member.email,
              jnuitsId: member.jnuits_id,
            },
          });
        } catch {
          skipped += 1;
          continue;
        }
      }

      if (
        !member ||
        (parsed.invitationType === "alumni_direct" && !isEligibleForAlumniInvite(member)) ||
        (await hasActiveInvitation(member.id))
      ) {
        skipped += 1;
        continue;
      }

      const result = await issueInvitationForMember({
        actorUserId,
        admin,
        expiresInDays: parsed.expiresInDays,
        invitationType: parsed.invitationType as InvitationType,
        maxUses: parsed.maxUses,
        member,
        note: parsed.note || "CSV invitation import",
      });

      issued += 1;
      if (result.deliveryStatus === "failed") {
        failed += 1;
      }
    }

    await persistInvitationAudit(admin, {
      action: "membership.invitation_csv_committed",
      actor_user_id: actorUserId,
      entity_id: null,
      entity_type: "member_invitation",
      metadata: { failed, issued, skipped },
    });

    revalidatePath("/admin/invitations");
    return {
      ok: true,
      message: `${issued} invitations issued. ${skipped} skipped. ${failed} delivery failures.`,
      details: { failed, issued, skipped },
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to commit CSV invitations.",
    };
  }
}
