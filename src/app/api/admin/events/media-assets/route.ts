import { type NextRequest, NextResponse } from "next/server";
import { requireAdminApiPermission } from "@/lib/admin/api-auth";
import { EVENT_MEDIA_PICKER_PAGE_SIZE } from "@/lib/content/events";
import { apiError } from "@/lib/errors/api-error";
import { withApiGuard } from "@/lib/security/with-api-guard";
import { createAdminClient } from "@/lib/supabase/admin";

function parsePage(value: string | null) {
  const parsed = Number(value || "1");

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

async function handleGet(request: NextRequest) {
  const permission = await requireAdminApiPermission("cms.events.manage", {
    forbiddenMessage: "Only event managers can browse event media assets.",
    unauthenticatedMessage: "Sign in before browsing media assets.",
  });

  if (permission.response) {
    return permission.response;
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() || "";
  const page = parsePage(url.searchParams.get("page"));
  const from = (page - 1) * EVENT_MEDIA_PICKER_PAGE_SIZE;
  const to = from + EVENT_MEDIA_PICKER_PAGE_SIZE - 1;
  const admin = createAdminClient();
  let builder = admin
    .from("media_assets")
    .select(
      "id, title, public_id, secure_url, thumbnail_url, alt_text",
      { count: "exact" }
    )
    .eq("media_kind", "image")
    .eq("provider", "cloudinary")
    .eq("is_public", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (query) {
    const escaped = query.replace(/[%_,]/g, (value) => `\\${value}`);

    builder = builder.or(
      `title.ilike.%${escaped}%,public_id.ilike.%${escaped}%`
    );
  }

  const { data, count, error } = await builder.range(from, to);

  if (error) {
    return apiError(error, {
      context: "admin.eventsMediaAssets",
      fallback: "Event media assets could not be loaded.",
    });
  }

  return NextResponse.json({
    items: (data || []).map((asset) => ({
      altText: asset.alt_text,
      id: asset.id,
      publicId: asset.public_id,
      secureUrl: asset.secure_url,
      thumbnailUrl: asset.thumbnail_url || asset.secure_url,
      title: asset.title,
    })),
    page,
    totalItems: count || 0,
    totalPages: Math.max(1, Math.ceil((count || 0) / EVENT_MEDIA_PICKER_PAGE_SIZE)),
  });
}

export const GET = withApiGuard(handleGet, {
  requireAuth: true,
});
