import { type NextRequest, NextResponse } from "next/server";
import { getAuthContext, hasOperatorRole } from "@/lib/auth/session";
import { EVENT_MEDIA_PICKER_PAGE_SIZE } from "@/lib/content/events";
import { withApiGuard } from "@/lib/security/with-api-guard";
import { createAdminClient } from "@/lib/supabase/admin";

function parsePage(value: string | null) {
  const parsed = Number(value || "1");

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

async function handleGet(request: NextRequest) {
  const auth = await getAuthContext();

  if (!auth.user) {
    return NextResponse.json(
      { message: "Sign in before browsing media assets." },
      { status: 401 }
    );
  }

  if (!hasOperatorRole(auth.roles)) {
    return NextResponse.json(
      { message: "Only operators can browse event media assets." },
      { status: 403 }
    );
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
    return NextResponse.json({ message: error.message }, { status: 500 });
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
