import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApiPermission } from "@/lib/admin/api-auth";
import { buildSignedCloudinaryFormAssetUrl, loadVerifiedCloudinaryFormAsset } from "@/lib/forms/cloudinary-assets";
import type { FormSubmissionAsset } from "@/lib/forms/upload-proof";
import { withApiGuard } from "@/lib/security/with-api-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";

export const runtime = "nodejs";
const idSchema = z.string().uuid();

type AssetRow = {
  bytes: number;
  cloudinary_asset_id: string;
  cloudinary_folder: string;
  cloudinary_public_id: string;
  cloudinary_version: string;
  content_type: FormSubmissionAsset["contentType"];
  field_id: string;
  form_submission_id: string;
  id: string;
  sha256: string;
};

async function GETHandler(_request: NextRequest, context: { params: Promise<{ assetId?: string; formId?: string; submissionId?: string }> }) {
  const permission = await requireAdminApiPermission("admin.forms.review", {
    forbiddenMessage: "Only authorized administrators can download form uploads.",
    unauthenticatedMessage: "Sign in before downloading form uploads.",
  });
  if (permission.response) return permission.response;

  const params = await context.params;
  const formId = idSchema.safeParse(params.formId);
  const submissionId = idSchema.safeParse(params.submissionId);
  const assetId = idSchema.safeParse(params.assetId);
  if (!formId.success || !submissionId.success || !assetId.success) {
    return NextResponse.json({ error: "Upload not found." }, { status: 404 });
  }

  const admin = asFlexibleClient(createAdminClient());
  const { data: submission } = await admin.from("form_submissions").select("id")
    .eq("id", submissionId.data).eq("form_definition_id", formId.data).maybeSingle();
  if (!submission) return NextResponse.json({ error: "Upload not found." }, { status: 404 });

  const { data, error } = await admin.from("form_submission_assets")
    .select("id, form_submission_id, field_id, cloudinary_asset_id, cloudinary_public_id, cloudinary_version, cloudinary_folder, bytes, content_type, sha256")
    .eq("id", assetId.data).eq("form_submission_id", submissionId.data).maybeSingle();
  const row = data as AssetRow | null;
  if (error || !row) return NextResponse.json({ error: "Upload not found." }, { status: 404 });

  const asset: FormSubmissionAsset = {
    bytes: row.bytes, cloudinaryAssetId: row.cloudinary_asset_id, cloudinaryFolder: row.cloudinary_folder,
    cloudinaryPublicId: row.cloudinary_public_id, cloudinaryVersion: row.cloudinary_version,
    contentType: row.content_type, fieldId: row.field_id,
    resourceType: row.content_type === "application/pdf" ? "raw" : "image",
    sha256: row.sha256, uploadId: row.cloudinary_public_id.replace(/\.pdf$/, ""),
  };

  try {
    await loadVerifiedCloudinaryFormAsset(asset);
    const provider = await fetch(buildSignedCloudinaryFormAssetUrl(asset), { signal: AbortSignal.timeout(10_000) });
    if (!provider.ok || !provider.body) throw new Error("Provider delivery failed.");

    await admin.from("audit_events").insert({
      action: "form.upload_downloaded", actor_user_id: permission.auth.user.id,
      entity_id: row.id, entity_type: "form_submission_asset",
      metadata: { field_id: row.field_id, form_definition_id: formId.data, form_submission_id: submissionId.data },
    });
    const extension = row.content_type === "application/pdf" ? "pdf" : row.content_type.split("/")[1];
    return new NextResponse(provider.body, { headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": `attachment; filename="form-upload-${row.id}.${extension}"`,
      "Content-Type": row.content_type,
      "X-Content-Type-Options": "nosniff",
    } });
  } catch {
    return NextResponse.json({ error: "The private upload is temporarily unavailable." }, { status: 503 });
  }
}

export const GET = withApiGuard(GETHandler, { requireAuth: true });
