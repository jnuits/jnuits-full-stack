import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApiPermission } from "@/lib/admin/api-auth";
import {
  requireVerifiedRetentionArchive,
  RetentionArchiveVerificationError,
} from "@/lib/retention/approval";
import {
  listRetentionWorkspace,
  RetentionWorkflowError,
  runRetentionAction,
} from "@/lib/retention/operations";
import { withApiGuard } from "@/lib/security/with-api-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";
import { authorizeAdminOperation, adminVerificationFailureMessage } from "@/lib/auth/admin-verification/guard";
import { AdminVerificationStore } from "@/lib/auth/admin-verification/store";
import { getAdminReadProofCookieName } from "@/lib/auth/admin-verification/read-cookie";
import type { AdminOperationIntent } from "@/lib/auth/admin-verification/types";

export const runtime = "nodejs";

const proofSchema = z.string().trim().min(1).max(256).optional();
const jobActionSchema = z.strictObject({
  action: z.enum(["archive", "approve_purge"]),
  jobId: z.string().uuid(),
  scope: z.enum(["event", "form"]),
  verificationProof: proofSchema,
});
const purgeActionSchema = z.strictObject({
  action: z.literal("purge"),
  confirmation: z.literal("PURGE"),
  jobId: z.string().uuid(),
  scope: z.enum(["event", "form"]),
  verificationProof: proofSchema,
});
const actionSchema = z.union([
  z.strictObject({ action: z.literal("discover"), verificationProof: proofSchema }),
  jobActionSchema,
  purgeActionSchema,
]);

async function authorize() {
  return requireAdminApiPermission("admin.retention.manage", {
    forbiddenMessage: "Only authorized administrators can manage retention.",
    unauthenticatedMessage: "Sign in before managing retention.",
  });
}

async function handleGet(request: NextRequest) {
  const permission = await authorize();
  if (permission.response) return permission.response;
  const name = getAdminReadProofCookieName("admin.retention.read")!;
  const verified = await authorizeAdminOperation({ operation: "admin.retention.read", payload: {} }, request.cookies.get(name)?.value);
  if (!verified.ok) return NextResponse.json({ error: adminVerificationFailureMessage(verified.code), code: verified.code }, { status: 403, headers: { "Cache-Control": "private, no-store" } });

  try {
    const workspace = await listRetentionWorkspace(asFlexibleClient(createAdminClient()));
    return NextResponse.json(workspace, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof RetentionWorkflowError ? error.message : "Retention workspace could not be loaded.";
    const status = error instanceof RetentionWorkflowError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

async function handlePost(request: NextRequest) {
  const permission = await authorize();
  if (permission.response) return permission.response;

  const body = await request.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose a valid retention action. Purge requires typing PURGE." }, { status: 422 });
  }

  const { verificationProof, ...action } = parsed.data;
  const intent: AdminOperationIntent = { operation: `admin.retention.${action.action}`, payload: action.action === "discover" ? {} : {
    jobId: action.jobId, scope: action.scope, ...(action.action === "purge" ? { confirmation: action.confirmation } : {}),
  } };
  const verified = await authorizeAdminOperation(intent, verificationProof);
  if (!verified.ok) return NextResponse.json({ error: adminVerificationFailureMessage(verified.code), code: verified.code }, { status: 403, headers: { "Cache-Control": "private, no-store" } });

  try {
    const admin = asFlexibleClient(createAdminClient());
    if (action.action === "approve_purge") {
      await requireVerifiedRetentionArchive(admin, action.scope, action.jobId);
    } else if (action.action === "purge") {
      await requireVerifiedRetentionArchive(admin, action.scope, action.jobId, {
        allowedStatuses: ["purge_approved"],
        statusMessage: "Purge requires an archived, approved job.",
      });
    }
    const reservation = await new AdminVerificationStore().reserve(verified.value.prepared.actor, intent, verificationProof);
    if (!reservation.ok) return NextResponse.json({ error: adminVerificationFailureMessage(reservation.code), code: reservation.code }, { status: 403, headers: { "Cache-Control": "private, no-store" } });
    const result = await runRetentionAction(admin, {
      ...action,
      actorUserId: permission.auth.user.id,
    }, reservation.value.attemptId);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const verificationFailure = error instanceof RetentionArchiveVerificationError;
    const message = verificationFailure
      ? error.message
      : error instanceof RetentionWorkflowError
        ? error.message
        : "Retention action could not be completed.";
    const status = verificationFailure ? 409 : error instanceof RetentionWorkflowError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export const GET = withApiGuard(handleGet, { requireAuth: true });
export const POST = withApiGuard(handlePost, { requireAuth: true });
