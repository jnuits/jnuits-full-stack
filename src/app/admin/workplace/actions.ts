"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminPermission } from "@/lib/auth/session";
import {
  bulkReviewWorkplaceRequests,
  reviewWorkplaceRequest,
  updateMemberWorkplace,
} from "@/lib/admin/workplace";
import { createAdminClient } from "@/lib/supabase/admin";

type ActionResult = {
  message: string;
  ok: boolean;
};

const reviewSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  requestId: z.string().trim().min(1, "Request is required."),
  reviewNote: z.string().trim().max(1500).optional().default(""),
});

const bulkReviewSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  requestIds: z.array(z.string().trim().min(1)).min(1).max(100),
  reviewNote: z.string().trim().max(1500).optional().default(""),
});

const workplacePayloadSchema = z.object({
  currentOrganization: z.string().trim().max(180).optional().default(""),
  designation: z.string().trim().max(160).optional().default(""),
  facebookUrl: z.string().trim().max(300).optional().default(""),
  linkedinUrl: z.string().trim().max(300).optional().default(""),
  professionalVisibility: z
    .enum(["public", "members-only", "private"])
    .optional()
    .default("members-only"),
  websiteUrl: z.string().trim().max(300).optional().default(""),
  workLocation: z.string().trim().max(160).optional().default(""),
});

const directUpdateSchema = z.object({
  memberId: z.string().trim().min(1, "Member is required."),
  note: z.string().trim().min(4, "Admin correction note is required.").max(1500),
  payload: workplacePayloadSchema,
});

async function requireWorkplaceAdmin() {
  return requireAdminPermission("admin.membership.manage", {
    fallbackPath: "/admin/workplace",
  });
}

function revalidateWorkplacePaths() {
  revalidatePath("/admin/workplace");
  revalidatePath("/members");
  revalidatePath("/portal/profile");
  revalidatePath("/portal/profile/edit");
}

export async function reviewWorkplaceRequestAction(
  input: unknown
): Promise<ActionResult> {
  try {
    const auth = await requireWorkplaceAdmin();
    const actorUserId = auth.user?.id;
    const parsed = reviewSchema.parse(input);

    if (!actorUserId) {
      return { ok: false, message: "Admin session is missing." };
    }

    const result = await reviewWorkplaceRequest({
      actorUserId,
      admin: createAdminClient(),
      decision: parsed.decision,
      requestId: parsed.requestId,
      reviewNote: parsed.reviewNote,
    });

    revalidateWorkplacePaths();
    return {
      ok: true,
      message:
        parsed.decision === "approved"
          ? `${result.memberName}'s workplace request was approved.`
          : `${result.memberName}'s workplace request was rejected.`,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Unable to review workplace request.",
    };
  }
}

export async function bulkReviewWorkplaceRequestsAction(
  input: unknown
): Promise<ActionResult> {
  try {
    const auth = await requireWorkplaceAdmin();
    const actorUserId = auth.user?.id;
    const parsed = bulkReviewSchema.parse(input);

    if (!actorUserId) {
      return { ok: false, message: "Admin session is missing." };
    }

    const results = await bulkReviewWorkplaceRequests({
      actorUserId,
      admin: createAdminClient(),
      decision: parsed.decision,
      requestIds: parsed.requestIds,
      reviewNote: parsed.reviewNote,
    });

    revalidateWorkplacePaths();
    return {
      ok: true,
      message: `${results.length} of ${parsed.requestIds.length} workplace requests were ${parsed.decision}.`,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Unable to bulk review workplace requests.",
    };
  }
}

export async function updateMemberWorkplaceAction(
  input: unknown
): Promise<ActionResult> {
  try {
    const auth = await requireWorkplaceAdmin();
    const actorUserId = auth.user?.id;
    const parsed = directUpdateSchema.parse(input);

    if (!actorUserId) {
      return { ok: false, message: "Admin session is missing." };
    }

    const result = await updateMemberWorkplace({
      actorUserId,
      admin: createAdminClient(),
      memberId: parsed.memberId,
      note: parsed.note,
      payload: parsed.payload,
    });

    revalidateWorkplacePaths();
    return {
      ok: true,
      message: `${result.memberName}'s workplace profile was updated.`,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Unable to update member workplace profile.",
    };
  }
}
