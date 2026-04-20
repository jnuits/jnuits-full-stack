import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getGalleryAlbumItemsPage } from "@/lib/content/gallery";

const querySchema = z.object({
  cursor: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(40).optional().default(20),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    cursor: url.searchParams.get("cursor") || undefined,
    limit: url.searchParams.get("limit") || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Provide a valid gallery pagination request." },
      { status: 400 }
    );
  }

  const page = await getGalleryAlbumItemsPage({
    cursor: parsed.data.cursor,
    limit: parsed.data.limit,
    slug,
  });

  return NextResponse.json(page, { status: 200 });
}
