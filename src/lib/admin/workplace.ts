import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";
import {
  getWorkplacePayloadEntries,
  parseWorkplaceUpdatePayload,
  type WorkplaceUpdatePayload,
} from "@/lib/members/workplace-payload";
import {
  buildWorkplaceAdminCorrectionEmail,
  buildWorkplaceRequestDecisionEmail,
} from "@/lib/notifications/email-builders";
import { sendEmail } from "@/lib/notifications/send-email";

type AdminClient = ReturnType<typeof createAdminClient>;

type WorkplaceMember = {
  current_organization?: null | string;
  designation?: null | string;
  email?: null | string;
  facebook_url?: null | string;
  full_name?: null | string;
  id: string;
  jnuits_id?: null | string;
  linkedin_url?: null | string;
  professional_visibility?: null | string;
  user_id?: null | string;
  website_url?: null | string;
  work_location?: null | string;
};

type WorkplaceRequest = {
  id: string;
  member_id: string;
  payload: unknown;
  requested_at?: string;
  request_type: string;
  status: string;
};

const WORKPLACE_SELECT =
  "id, full_name, email, jnuits_id, user_id, current_organization, designation, work_location, facebook_url, linkedin_url, website_url, professional_visibility";

const REQUEST_SELECT =
  "id, member_id, request_type, payload, status, requested_at, members(id, full_name, email, jnuits_id, user_id, current_organization, designation, work_location, facebook_url, linkedin_url, website_url, professional_visibility)";

function memberFromRequest(
  request: WorkplaceRequest & { members?: WorkplaceMember | WorkplaceMember[] | null }
) {
  return Array.isArray(request.members) ? request.members[0] || null : request.members || null;
}

function workplaceSnapshot(member: WorkplaceMember | null | undefined) {
  return {
    currentOrganization: member?.current_organization || null,
    designation: member?.designation || null,
    facebookUrl: member?.facebook_url || null,
    linkedinUrl: member?.linkedin_url || null,
    professionalVisibility: member?.professional_visibility || "members-only",
    websiteUrl: member?.website_url || null,
    workLocation: member?.work_location || null,
  };
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeWorkplacePayload(input: unknown): WorkplaceUpdatePayload {
  const parsed = parseWorkplaceUpdatePayload(input);
  return {
    currentOrganization: normalizeText(parsed.currentOrganization) || undefined,
    designation: normalizeText(parsed.designation) || undefined,
    facebookUrl: normalizeText(parsed.facebookUrl) || undefined,
    linkedinUrl: normalizeText(parsed.linkedinUrl) || undefined,
    professionalVisibility:
      normalizeText(parsed.professionalVisibility) || "members-only",
    websiteUrl: normalizeText(parsed.websiteUrl) || undefined,
    workLocation: normalizeText(parsed.workLocation) || undefined,
  };
}

function buildMemberUpdate(
  payload: WorkplaceUpdatePayload,
  previous: ReturnType<typeof workplaceSnapshot>
) {
  return {
    current_organization:
      payload.currentOrganization !== undefined
        ? payload.currentOrganization || null
        : previous.currentOrganization,
    designation:
      payload.designation !== undefined ? payload.designation || null : previous.designation,
    facebook_url:
      payload.facebookUrl !== undefined ? payload.facebookUrl || null : previous.facebookUrl,
    linkedin_url:
      payload.linkedinUrl !== undefined ? payload.linkedinUrl || null : previous.linkedinUrl,
    professional_visibility:
      payload.professionalVisibility || previous.professionalVisibility || "members-only",
    updated_at: new Date().toISOString(),
    website_url:
      payload.websiteUrl !== undefined ? payload.websiteUrl || null : previous.websiteUrl,
    work_location:
      payload.workLocation !== undefined ? payload.workLocation || null : previous.workLocation,
  };
}

async function persistWorkplaceAudit(
  admin: AdminClient,
  payload: {
    action: string;
    actorUserId: null | string;
    entityId: null | string;
    entityType: string;
    metadata?: Record<string, unknown>;
  }
) {
  await asFlexibleClient(admin).from("audit_events" as string).insert({
    action: payload.action,
    actor_user_id: payload.actorUserId,
    entity_id: payload.entityId,
    entity_type: payload.entityType,
    metadata: payload.metadata || {},
  });
}

async function notifyMember(options: {
  email?: null | string;
  html: string;
  subject: string;
}) {
  if (!options.email) return;

  try {
    await sendEmail({
      html: options.html,
      subject: options.subject,
      to: options.email,
    });
  } catch {
    // Email failures must not roll back the reviewed request.
  }
}

export async function reviewWorkplaceRequest(options: {
  actorUserId: string;
  admin: AdminClient;
  decision: "approved" | "rejected";
  requestId: string;
  reviewNote?: string;
}) {
  const flexibleAdmin = asFlexibleClient(options.admin);
  const { data, error } = await flexibleAdmin
    .from("profile_update_requests" as string)
    .select(REQUEST_SELECT)
    .eq("id", options.requestId)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message || "Workplace request could not be loaded.");
  }

  const request = data as WorkplaceRequest & {
    members?: WorkplaceMember | WorkplaceMember[] | null;
  };
  const member = memberFromRequest(request);

  if (request.request_type !== "workplace_update") {
    throw new Error("Only workplace update requests can be reviewed here.");
  }

  if (request.status !== "pending") {
    throw new Error("This workplace request has already been processed.");
  }

  if (!member?.id) {
    throw new Error("Linked member record could not be loaded.");
  }

  const payload = normalizeWorkplacePayload(request.payload);
  const entries = getWorkplacePayloadEntries(payload);

  if (entries.length === 0) {
    throw new Error("This request does not contain any workplace fields.");
  }

  const nowIso = new Date().toISOString();
  const previousSnapshot = workplaceSnapshot(member);
  const appliedSnapshot =
    options.decision === "approved"
      ? {
          ...previousSnapshot,
          ...payload,
        }
      : {};

  if (options.decision === "approved") {
    const { error: memberError } = await flexibleAdmin
      .from("members" as string)
      .update(buildMemberUpdate(payload, previousSnapshot))
      .eq("id", member.id);

    if (memberError) {
      throw new Error(memberError.message);
    }
  }

  const { error: requestError } = await flexibleAdmin
    .from("profile_update_requests" as string)
    .update({
      applied_payload_snapshot: appliedSnapshot,
      decision_reason: options.reviewNote || null,
      previous_payload_snapshot: previousSnapshot,
      review_note: options.reviewNote || null,
      reviewed_at: nowIso,
      reviewed_by_user_id: options.actorUserId,
      status: options.decision,
      updated_at: nowIso,
    })
    .eq("id", request.id);

  if (requestError) {
    throw new Error(requestError.message);
  }

  await flexibleAdmin.from("membership_lifecycle_events" as string).insert({
    created_by_user_id: options.actorUserId,
    event_type:
      options.decision === "approved"
        ? "workplace_update_approved"
        : "workplace_update_rejected",
    member_id: member.id,
    metadata: {
      requestId: request.id,
      reviewNote: options.reviewNote || null,
      updatedFields: entries.map((entry) => entry.key),
    },
    summary:
      options.decision === "approved"
        ? "A moderated workplace update request was approved."
        : "A moderated workplace update request was rejected.",
  });

  await persistWorkplaceAudit(options.admin, {
    action:
      options.decision === "approved"
        ? "member.workplace_update_request_approved"
        : "member.workplace_update_request_rejected",
    actorUserId: options.actorUserId,
    entityId: request.id,
    entityType: "profile_update_request",
    metadata: {
      memberId: member.id,
      reviewNote: options.reviewNote || null,
      updatedFields: entries.map((entry) => entry.key),
    },
  });

  await notifyMember({
    email: member.email,
    html: buildWorkplaceRequestDecisionEmail({
      approved: options.decision === "approved",
      memberName: member.full_name || "JnUITS member",
      reviewNote: options.reviewNote || null,
      updatedFields: entries.map((entry) => entry.label),
    }),
    subject:
      options.decision === "approved"
        ? "Your JnUITS workplace update was approved"
        : "Your JnUITS workplace update was reviewed",
  });

  return {
    memberId: member.id,
    memberName: member.full_name || "Linked member",
    requestId: request.id,
  };
}

export async function bulkReviewWorkplaceRequests(options: {
  actorUserId: string;
  admin: AdminClient;
  decision: "approved" | "rejected";
  requestIds: string[];
  reviewNote?: string;
}) {
  const results = [];

  for (const requestId of options.requestIds) {
    try {
      results.push(
        await reviewWorkplaceRequest({
          actorUserId: options.actorUserId,
          admin: options.admin,
          decision: options.decision,
          requestId,
          reviewNote: options.reviewNote,
        })
      );
    } catch {
      // Continue reviewing the selected queue; surface aggregate counts to UI.
    }
  }

  await persistWorkplaceAudit(options.admin, {
    action: "member.workplace_update_requests_bulk_reviewed",
    actorUserId: options.actorUserId,
    entityId: null,
    entityType: "profile_update_request",
    metadata: {
      decision: options.decision,
      requested: options.requestIds.length,
      reviewed: results.length,
    },
  });

  return results;
}

export async function updateMemberWorkplace(options: {
  actorUserId: string;
  admin: AdminClient;
  memberId: string;
  note: string;
  payload: WorkplaceUpdatePayload;
}) {
  const flexibleAdmin = asFlexibleClient(options.admin);
  const { data: member, error } = await flexibleAdmin
    .from("members" as string)
    .select(WORKPLACE_SELECT)
    .eq("id", options.memberId)
    .maybeSingle();

  if (error || !member) {
    throw new Error(error?.message || "Member workplace record could not be loaded.");
  }

  const typedMember = member as WorkplaceMember;
  const previousSnapshot = workplaceSnapshot(typedMember);
  const payload = normalizeWorkplacePayload(options.payload);
  const updatePayload = buildMemberUpdate(payload, previousSnapshot);

  const { error: updateError } = await flexibleAdmin
    .from("members" as string)
    .update(updatePayload)
    .eq("id", typedMember.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  await flexibleAdmin.from("membership_lifecycle_events" as string).insert({
    created_by_user_id: options.actorUserId,
    event_type: "workplace_admin_corrected",
    member_id: typedMember.id,
    metadata: {
      note: options.note,
      previousPayload: previousSnapshot,
      appliedPayload: payload,
    },
    summary: "An admin corrected the member workplace profile.",
  });

  await persistWorkplaceAudit(options.admin, {
    action: "member.workplace_admin_corrected",
    actorUserId: options.actorUserId,
    entityId: typedMember.id,
    entityType: "member",
    metadata: {
      note: options.note,
      previousPayload: previousSnapshot,
      appliedPayload: payload,
    },
  });

  await notifyMember({
    email: typedMember.email,
    html: buildWorkplaceAdminCorrectionEmail({
      memberName: typedMember.full_name || "JnUITS member",
      note: options.note,
    }),
    subject: "Your JnUITS workplace profile was updated",
  });

  return {
    memberId: typedMember.id,
    memberName: typedMember.full_name || "Linked member",
  };
}

export async function cancelWorkplaceRequest(options: {
  admin: AdminClient;
  requestId: string;
  userId: string;
}) {
  const flexibleAdmin = asFlexibleClient(options.admin);
  const { data, error } = await flexibleAdmin
    .from("profile_update_requests" as string)
    .select(REQUEST_SELECT)
    .eq("id", options.requestId)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message || "Workplace request could not be loaded.");
  }

  const request = data as WorkplaceRequest & {
    members?: WorkplaceMember | WorkplaceMember[] | null;
  };
  const member = memberFromRequest(request);

  if (!member || member.user_id !== options.userId) {
    throw new Error("You cannot cancel this workplace request.");
  }

  if (request.request_type !== "workplace_update" || request.status !== "pending") {
    throw new Error("Only pending workplace requests can be cancelled.");
  }

  const nowIso = new Date().toISOString();
  const { error: updateError } = await flexibleAdmin
    .from("profile_update_requests" as string)
    .update({
      decision_reason: "Cancelled by requester",
      metadata: { cancelledAt: nowIso, cancelledByUserId: options.userId },
      review_note: "Cancelled by requester",
      reviewed_at: nowIso,
      status: "cancelled",
      updated_at: nowIso,
    })
    .eq("id", request.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  await persistWorkplaceAudit(options.admin, {
    action: "member.workplace_update_request_cancelled",
    actorUserId: options.userId,
    entityId: request.id,
    entityType: "profile_update_request",
    metadata: { memberId: member.id },
  });
}
