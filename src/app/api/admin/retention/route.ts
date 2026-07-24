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

export const runtime = "nodejs";

const jobActionSchema = z.object({
  action: z.enum(["archive", "approve_purge"]),
  jobId: z.string().uuid(),
  scope: z.enum(["event", "form"]),
});
const purgeActionSchema = z.object({
  action: z.literal("purge"),
  confirmation: z.literal("PURGE"),
  jobId: z.string().uuid(),
  scope: z.enum(["event", "form"]),
});
const actionSchema = z.union([
  z.object({ action: z.literal("discover") }),
  jobActionSchema,
  purgeActionSchema,
]);

async function authorize() {
  return requireAdminApiPermission("admin.retention.manage", {
    forbiddenMessage: "Only authorized administrators can manage retention.",
    requireAal2: true,
    unauthenticatedMessage: "Sign in before managing retention.",
  });
}

async function handleGet() {
  const permission = await authorize();
  if (permission.response) return permission.response;

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

  try {
    const admin = asFlexibleClient(createAdminClient());
    if (parsed.data.action === "approve_purge") {
      await requireVerifiedRetentionArchive(admin, parsed.data.scope, parsed.data.jobId);
    }
    const result = await runRetentionAction(admin, {
      ...parsed.data,
      actorUserId: permission.auth.user.id,
    });
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
