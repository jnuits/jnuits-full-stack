"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { setAdminFlash } from "@/lib/admin/flash";
import { requireAdminUser } from "@/lib/auth/session";
import type { TablesInsert } from "@/lib/db/types";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_INVITATION_EXPIRY_DAYS,
  generateInvitationCode,
  getInvitationExpiryIso,
  hashInvitationCode,
} from "@/lib/members/invitation-code";

type AdminClient = ReturnType<typeof createAdminClient>;
type AuditEventInsert = TablesInsert<"audit_events">;
type OperatorReportInsert = TablesInsert<"operator_reports">;

const CYCLE_STATUSES = new Set(["draft", "active", "closed", "archived"]);
const CYCLE_MEMBER_STATES = new Set([
  "active",
  "pending_renewal",
  "renewed",
  "expired",
  "lapsed",
]);
const BATCH_STATUSES = new Set(["draft", "active", "closed", "archived"]);
const BATCH_SOURCES = new Set([
  "manual",
  "csv_onboarding",
  "reconciliation",
  "renewal",
]);

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function asBoolean(value: FormDataEntryValue | null) {
  return typeof value === "string" && value === "true";
}

function assertCycleStatus(value: string) {
  return CYCLE_STATUSES.has(value) ? value : "draft";
}

function assertCycleMemberState(value: string) {
  return CYCLE_MEMBER_STATES.has(value) ? value : "pending_renewal";
}

function assertBatchStatus(value: string) {
  return BATCH_STATUSES.has(value) ? value : "draft";
}

function assertBatchSource(value: string) {
  return BATCH_SOURCES.has(value) ? value : "manual";
}

async function getNextInvitationCode(admin: AdminClient) {
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

async function persistAudit(admin: AdminClient, payload: AuditEventInsert) {
  await admin.from("audit_events").insert(payload);
}

async function persistOperatorReport(
  admin: AdminClient,
  payload: OperatorReportInsert
) {
  await admin.from("operator_reports").insert(payload);
}

function redirectMembership(): never {
  redirect("/admin/membership");
}

export async function createMembershipCycleAction(formData: FormData) {
  const auth = await requireAdminUser({ fallbackPath: "/admin/membership" });
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login?next=%2Fadmin%2Fmembership");
  }

  const code = asString(formData.get("code")).toLowerCase();
  const title = asString(formData.get("title"));
  const startsOn = asString(formData.get("startsOn"));
  const endsOn = asString(formData.get("endsOn"));
  const renewalOpenOn = asString(formData.get("renewalOpenOn"));
  const renewalCloseOn = asString(formData.get("renewalCloseOn"));
  const status = assertCycleStatus(asString(formData.get("status")) || "draft");

  if (!code || !title || !startsOn) {
    await setAdminFlash(
      {
        tone: "error",
        title: "Cycle creation failed",
        message: "Code, title, and start date are required.",
      },
      "/admin"
    );
    redirectMembership();
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("membership_cycles")
    .insert({
      code,
      created_by_user_id: actorUserId,
      ends_on: endsOn || null,
      renewal_close_on: renewalCloseOn || null,
      renewal_open_on: renewalOpenOn || null,
      starts_on: startsOn,
      status,
      title,
    })
    .select("id")
    .single();

  if (error || !data) {
    await setAdminFlash(
      {
        tone: "error",
        title: "Cycle creation failed",
        message: error?.message || "Unable to save membership cycle.",
      },
      "/admin"
    );
    redirectMembership();
  }

  await persistAudit(admin, {
    actor_user_id: actorUserId,
    action: "membership.cycle_created",
    entity_type: "membership_cycle",
    entity_id: data.id,
    metadata: {
      code,
      status,
      title,
    },
  });

  revalidatePath("/admin/membership");
  await setAdminFlash(
    {
      tone: "success",
      title: "Membership cycle created",
      message: `${title} is now available for renewal and enrollment operations.`,
    },
    "/admin"
  );
  redirectMembership();
}

export async function updateMembershipCycleStatusAction(formData: FormData) {
  const auth = await requireAdminUser({ fallbackPath: "/admin/membership" });
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login?next=%2Fadmin%2Fmembership");
  }

  const cycleId = asString(formData.get("cycleId"));
  const nextStatus = assertCycleStatus(asString(formData.get("nextStatus")) || "draft");

  if (!cycleId) {
    await setAdminFlash(
      {
        tone: "error",
        title: "Cycle status update failed",
        message: "Missing cycle identifier.",
      },
      "/admin"
    );
    redirectMembership();
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("membership_cycles")
    .update({
      status: nextStatus,
    })
    .eq("id", cycleId);

  if (error) {
    await setAdminFlash(
      {
        tone: "error",
        title: "Cycle status update failed",
        message: error.message,
      },
      "/admin"
    );
    redirectMembership();
  }

  await persistAudit(admin, {
    actor_user_id: actorUserId,
    action: "membership.cycle_status_updated",
    entity_type: "membership_cycle",
    entity_id: cycleId,
    metadata: {
      nextStatus,
    },
  });

  revalidatePath("/admin/membership");
  await setAdminFlash(
    {
      tone: "success",
      title: "Cycle status updated",
      message: `Membership cycle is now marked as ${nextStatus}.`,
    },
    "/admin"
  );
  redirectMembership();
}

export async function enrollMemberInCycleAction(formData: FormData) {
  const auth = await requireAdminUser({ fallbackPath: "/admin/membership" });
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login?next=%2Fadmin%2Fmembership");
  }

  const cycleId = asString(formData.get("cycleId"));
  const memberJnuitsId = asString(formData.get("memberJnuitsId")).toUpperCase();
  const state = assertCycleMemberState(
    asString(formData.get("memberState")) || "pending_renewal"
  );
  const expiresOn = asString(formData.get("expiresOn"));
  const note = asString(formData.get("note"));

  if (!cycleId || !memberJnuitsId) {
    await setAdminFlash(
      {
        tone: "error",
        title: "Enrollment failed",
        message: "Cycle and member JnUITS ID are required.",
      },
      "/admin"
    );
    redirectMembership();
  }

  const admin = createAdminClient();
  const { data: member, error: memberError } = await admin
    .from("members")
    .select("id, jnuits_id, full_name")
    .eq("jnuits_id", memberJnuitsId)
    .maybeSingle();

  if (memberError || !member) {
    await setAdminFlash(
      {
        tone: "error",
        title: "Enrollment failed",
        message: "Member not found for the given JnUITS ID.",
      },
      "/admin"
    );
    redirectMembership();
  }

  const { error: upsertError } = await admin
    .from("membership_cycle_memberships")
    .upsert(
      {
        created_by_user_id: actorUserId,
        cycle_id: cycleId,
        enrolled_at: new Date().toISOString(),
        expires_on: expiresOn || null,
        member_id: member.id,
        note: note || null,
        renewed_at: state === "renewed" ? new Date().toISOString() : null,
        state,
      },
      {
        onConflict: "cycle_id,member_id",
      }
    );

  if (upsertError) {
    await setAdminFlash(
      {
        tone: "error",
        title: "Enrollment failed",
        message: upsertError.message,
      },
      "/admin"
    );
    redirectMembership();
  }

  await admin.from("membership_lifecycle_events").insert({
    created_by_user_id: actorUserId,
    event_type: "cycle_membership_updated",
    member_id: member.id,
    metadata: {
      cycleId,
      expiresOn: expiresOn || null,
      state,
    },
    summary: `Cycle membership set to ${state}.`,
  });

  await persistAudit(admin, {
    actor_user_id: actorUserId,
    action: "membership.cycle_member_upserted",
    entity_type: "membership_cycle_membership",
    entity_id: `${cycleId}:${member.id}`,
    metadata: {
      cycleId,
      jnuitsId: member.jnuits_id,
      state,
    },
  });

  revalidatePath("/admin/membership");
  await setAdminFlash(
    {
      tone: "success",
      title: "Member enrollment updated",
      message: `${member.full_name} is now tracked in the selected cycle as ${state}.`,
      jnuitsId: member.jnuits_id,
    },
    "/admin"
  );
  redirectMembership();
}

export async function updateCycleMemberStateAction(formData: FormData) {
  const auth = await requireAdminUser({ fallbackPath: "/admin/membership" });
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login?next=%2Fadmin%2Fmembership");
  }

  const rowId = asString(formData.get("rowId"));
  const nextState = assertCycleMemberState(
    asString(formData.get("nextState")) || "pending_renewal"
  );
  const note = asString(formData.get("note"));

  if (!rowId) {
    await setAdminFlash(
      {
        tone: "error",
        title: "State update failed",
        message: "Cycle membership row identifier is missing.",
      },
      "/admin"
    );
    redirectMembership();
  }

  const admin = createAdminClient();
  const { data: row, error: rowError } = await admin
    .from("membership_cycle_memberships")
    .select("id, cycle_id, member_id")
    .eq("id", rowId)
    .maybeSingle();

  if (rowError || !row) {
    await setAdminFlash(
      {
        tone: "error",
        title: "State update failed",
        message: "Cycle membership row could not be loaded.",
      },
      "/admin"
    );
    redirectMembership();
  }

  const { error } = await admin
    .from("membership_cycle_memberships")
    .update({
      note: note || null,
      renewed_at: nextState === "renewed" ? new Date().toISOString() : null,
      state: nextState,
    })
    .eq("id", row.id);

  if (error) {
    await setAdminFlash(
      {
        tone: "error",
        title: "State update failed",
        message: error.message,
      },
      "/admin"
    );
    redirectMembership();
  }

  await admin.from("membership_lifecycle_events").insert({
    created_by_user_id: actorUserId,
    event_type: "cycle_membership_state_changed",
    member_id: row.member_id,
    metadata: {
      cycleId: row.cycle_id,
      nextState,
      note: note || null,
    },
    summary: `Cycle state changed to ${nextState}.`,
  });

  await persistAudit(admin, {
    actor_user_id: actorUserId,
    action: "membership.cycle_member_state_changed",
    entity_type: "membership_cycle_membership",
    entity_id: row.id,
    metadata: {
      cycleId: row.cycle_id,
      nextState,
    },
  });

  revalidatePath("/admin/membership");
  await setAdminFlash(
    {
      tone: "success",
      title: "Cycle member state updated",
      message: `Member state is now ${nextState}.`,
    },
    "/admin"
  );
  redirectMembership();
}

export async function createInvitationBatchAction(formData: FormData) {
  const auth = await requireAdminUser({ fallbackPath: "/admin/membership" });
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login?next=%2Fadmin%2Fmembership");
  }

  const label = asString(formData.get("label"));
  const cycleId = asString(formData.get("cycleId"));
  const source = assertBatchSource(asString(formData.get("source")) || "manual");
  const status = assertBatchStatus(asString(formData.get("status")) || "draft");
  const expiresAt = asString(formData.get("expiresAt"));

  if (!label) {
    await setAdminFlash(
      {
        tone: "error",
        title: "Batch creation failed",
        message: "Batch label is required.",
      },
      "/admin"
    );
    redirectMembership();
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("invitation_batches")
    .insert({
      created_by_user_id: actorUserId,
      cycle_id: cycleId || null,
      expires_at: expiresAt || null,
      label,
      source,
      status,
    })
    .select("id")
    .single();

  if (error || !data) {
    await setAdminFlash(
      {
        tone: "error",
        title: "Batch creation failed",
        message: error?.message || "Unable to create invitation batch.",
      },
      "/admin"
    );
    redirectMembership();
  }

  await persistAudit(admin, {
    actor_user_id: actorUserId,
    action: "membership.invitation_batch_created",
    entity_type: "invitation_batch",
    entity_id: data.id,
    metadata: {
      cycleId: cycleId || null,
      label,
      source,
      status,
    },
  });

  revalidatePath("/admin/membership");
  await setAdminFlash(
    {
      tone: "success",
      title: "Invitation batch created",
      message: `${label} is ready for issuance workflow.`,
    },
    "/admin"
  );
  redirectMembership();
}

export async function issueInvitationsFromBatchAction(formData: FormData) {
  const auth = await requireAdminUser({ fallbackPath: "/admin/membership" });
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login?next=%2Fadmin%2Fmembership");
  }

  const batchId = asString(formData.get("batchId"));
  const onlyPendingRenewal = asBoolean(formData.get("onlyPendingRenewal"));
  const maxUses = Math.max(1, Number.parseInt(asString(formData.get("maxUses")) || "1", 10) || 1);
  const expiryDays = Math.max(
    1,
    Number.parseInt(
      asString(formData.get("invitationExpiresInDays")) ||
        String(DEFAULT_INVITATION_EXPIRY_DAYS),
      10
    ) || DEFAULT_INVITATION_EXPIRY_DAYS
  );

  if (!batchId) {
    await setAdminFlash(
      {
        tone: "error",
        title: "Batch issuance failed",
        message: "Missing invitation batch identifier.",
      },
      "/admin"
    );
    redirectMembership();
  }

  const admin = createAdminClient();
  const { data: batch, error: batchError } = await admin
    .from("invitation_batches")
    .select("id, cycle_id, label")
    .eq("id", batchId)
    .maybeSingle();

  if (batchError || !batch) {
    await setAdminFlash(
      {
        tone: "error",
        title: "Batch issuance failed",
        message: "Invitation batch could not be loaded.",
      },
      "/admin"
    );
    redirectMembership();
  }

  if (!batch.cycle_id) {
    await setAdminFlash(
      {
        tone: "error",
        title: "Batch issuance failed",
        message: "This batch is not linked to a cycle.",
      },
      "/admin"
    );
    redirectMembership();
  }

  let queue = admin
    .from("membership_cycle_memberships")
    .select(
      "id, member_id, state, members(id, is_profile_claimed, full_name, jnuits_id)"
    )
    .eq("cycle_id", batch.cycle_id);

  if (onlyPendingRenewal) {
    queue = queue.eq("state", "pending_renewal");
  } else {
    queue = queue.in("state", ["active", "pending_renewal", "renewed"]);
  }

  const { data: rows, error: queueError } = await queue.limit(200);

  if (queueError) {
    await setAdminFlash(
      {
        tone: "error",
        title: "Batch issuance failed",
        message: queueError.message,
      },
      "/admin"
    );
    redirectMembership();
  }

  let issued = 0;
  const nowIso = new Date().toISOString();

  for (const row of rows || []) {
    const relation = Array.isArray(row.members) ? row.members[0] : row.members;

    if (!relation || relation.is_profile_claimed) {
      continue;
    }

    const code = await getNextInvitationCode(admin);
    const expiresAt = getInvitationExpiryIso(expiryDays);

    const { error: inviteError } = await admin.from("member_invitations").insert({
      code_hash: code.codeHash,
      created_by_user_id: actorUserId,
      expires_at: expiresAt,
      max_uses: maxUses,
      member_id: relation.id,
      notes: `[batch:${batch.id}] ${batch.label}`,
    });

    if (!inviteError) {
      issued += 1;
    }
  }

  const { data: invitationRows } = await admin
    .from("member_invitations")
    .select("id, used_count")
    .ilike("notes", `%[batch:${batch.id}]%`);

  const issuedCount = (invitationRows || []).length;
  const claimedCount = (invitationRows || []).filter(
    (row: { used_count?: number }) => (row.used_count || 0) > 0
  ).length;

  await admin
    .from("invitation_batches")
    .update({
      claimed_count: claimedCount,
      issued_count: issuedCount,
      metadata: {
        generatedAt: nowIso,
        onlyPendingRenewal,
      },
      status: issuedCount > 0 ? "active" : "draft",
    })
    .eq("id", batch.id);

  await persistOperatorReport(admin, {
    created_by_user_id: actorUserId,
    report: {
      batchId: batch.id,
      claimedCount,
      cycleId: batch.cycle_id,
      issuedCount,
      issuedThisRun: issued,
      onlyPendingRenewal,
    },
    report_type: "membership_reconciliation",
    status: "completed",
    summary: `Invitation batch run completed for ${batch.label} (${issued} newly issued).`,
    title: `Invitation batch run: ${batch.label}`,
  });

  await persistAudit(admin, {
    actor_user_id: actorUserId,
    action: "membership.invitation_batch_issued",
    entity_type: "invitation_batch",
    entity_id: batch.id,
    metadata: {
      claimedCount,
      issuedCount,
      issuedThisRun: issued,
      onlyPendingRenewal,
    },
  });

  revalidatePath("/admin/membership");
  await setAdminFlash(
    {
      tone: "success",
      title: "Batch issuance completed",
      message: `${issued} new invitations issued in ${batch.label}.`,
    },
    "/admin"
  );
  redirectMembership();
}

export async function syncInvitationBatchMetricsAction(formData: FormData) {
  const auth = await requireAdminUser({ fallbackPath: "/admin/membership" });
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login?next=%2Fadmin%2Fmembership");
  }

  const batchId = asString(formData.get("batchId"));

  if (!batchId) {
    await setAdminFlash(
      {
        tone: "error",
        title: "Batch sync failed",
        message: "Missing invitation batch identifier.",
      },
      "/admin"
    );
    redirectMembership();
  }

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("member_invitations")
    .select("id, used_count")
    .ilike("notes", `%[batch:${batchId}]%`);

  if (error) {
    await setAdminFlash(
      {
        tone: "error",
        title: "Batch sync failed",
        message: error.message,
      },
      "/admin"
    );
    redirectMembership();
  }

  const issuedCount = (rows || []).length;
  const claimedCount = (rows || []).filter(
    (row: { used_count?: number }) => (row.used_count || 0) > 0
  ).length;

  const { error: updateError } = await admin
    .from("invitation_batches")
    .update({
      claimed_count: claimedCount,
      issued_count: issuedCount,
      metadata: {
        lastSyncedAt: new Date().toISOString(),
      },
    })
    .eq("id", batchId);

  if (updateError) {
    await setAdminFlash(
      {
        tone: "error",
        title: "Batch sync failed",
        message: updateError.message,
      },
      "/admin"
    );
    redirectMembership();
  }

  await persistAudit(admin, {
    actor_user_id: actorUserId,
    action: "membership.invitation_batch_synced",
    entity_type: "invitation_batch",
    entity_id: batchId,
    metadata: {
      claimedCount,
      issuedCount,
    },
  });

  revalidatePath("/admin/membership");
  await setAdminFlash(
    {
      tone: "success",
      title: "Batch metrics synced",
      message: `Issued ${issuedCount}, claimed ${claimedCount}.`,
    },
    "/admin"
  );
  redirectMembership();
}

export async function updateInvitationBatchStatusAction(formData: FormData) {
  const auth = await requireAdminUser({ fallbackPath: "/admin/membership" });
  const actorUserId = auth.user?.id;

  if (!actorUserId) {
    redirect("/login?next=%2Fadmin%2Fmembership");
  }

  const batchId = asString(formData.get("batchId"));
  const nextStatus = assertBatchStatus(asString(formData.get("nextStatus")) || "draft");

  if (!batchId) {
    await setAdminFlash(
      {
        tone: "error",
        title: "Batch status update failed",
        message: "Missing invitation batch identifier.",
      },
      "/admin"
    );
    redirectMembership();
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("invitation_batches")
    .update({
      status: nextStatus,
    })
    .eq("id", batchId);

  if (error) {
    await setAdminFlash(
      {
        tone: "error",
        title: "Batch status update failed",
        message: error.message,
      },
      "/admin"
    );
    redirectMembership();
  }

  await persistAudit(admin, {
    actor_user_id: actorUserId,
    action: "membership.invitation_batch_status_updated",
    entity_type: "invitation_batch",
    entity_id: batchId,
    metadata: {
      nextStatus,
    },
  });

  revalidatePath("/admin/membership");
  await setAdminFlash(
    {
      tone: "success",
      title: "Batch status updated",
      message: `Invitation batch is now ${nextStatus}.`,
    },
    "/admin"
  );
  redirectMembership();
}
