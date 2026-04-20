import { revalidatePath } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext, hasOperatorRole } from "@/lib/auth/session";
import { insertAuditEvent } from "@/lib/content/media-assets";
import { withApiGuard } from "@/lib/security/with-api-guard";
import { createAdminClient } from "@/lib/supabase/admin";

const albumCreateSchema = z.object({
  category: z.string().trim().min(1).max(80),
  cloudinaryFolder: z.string().trim().max(220).optional().default(""),
  description: z.string().trim().max(8000).optional().default(""),
  endsOn: z.string().trim().max(40).optional().default(""),
  eventName: z.string().trim().max(220).optional().default(""),
  featured: z.boolean().optional().default(false),
  month: z.coerce.number().int().min(1).max(12),
  slug: z.string().trim().min(1).max(160),
  startsOn: z.string().trim().max(40).optional().default(""),
  status: z.enum(["draft", "published", "archived"]).default("published"),
  title: z.string().trim().min(1).max(220),
  year: z.coerce.number().int().min(2015).max(2100),
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 140);
}

function nullableDate(value: string) {
  return value || null;
}

async function handlePost(request: NextRequest) {
  const auth = await getAuthContext();

  if (!auth.user) {
    return NextResponse.json(
      { message: "Sign in before creating gallery albums." },
      { status: 401 }
    );
  }

  if (!hasOperatorRole(auth.roles)) {
    return NextResponse.json(
      { message: "Only operators can create gallery albums." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = albumCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message:
          parsed.error.issues[0]?.message ||
          "Provide valid gallery album metadata.",
      },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const slug = slugify(data.slug || data.title);

  if (!slug) {
    return NextResponse.json(
      { message: "Album title or slug must produce a valid URL slug." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: saved, error } = await admin
    .from("gallery_albums")
    .insert({
      category: data.category,
      cloudinary_folder: data.cloudinaryFolder || null,
      description: data.description || null,
      ends_on: nullableDate(data.endsOn),
      event_name: data.eventName || data.title,
      featured: data.featured,
      month: data.month,
      slug,
      starts_on: nullableDate(data.startsOn),
      status: data.status,
      title: data.title,
      year: data.year,
      created_by_user_id: auth.user.id,
      source: "manual",
      source_metadata: {
        source: "admin-create-album-upload-flow",
      },
    })
    .select("id, slug, title, cloudinary_folder")
    .single();

  if (error || !saved) {
    return NextResponse.json(
      {
        message:
          error?.code === "23505"
            ? "An album with this slug already exists. Choose a unique slug."
            : error?.message || "Gallery album could not be created.",
      },
      { status: error?.code === "23505" ? 409 : 500 }
    );
  }

  await insertAuditEvent(admin, {
    action: "gallery.album_created",
    actorUserId: auth.user.id,
    entityId: saved.id,
    entityType: "gallery_album",
    metadata: { slug: saved.slug, status: data.status },
  });

  revalidatePath("/gallery");
  revalidatePath("/admin/content/gallery");

  return NextResponse.json(
    {
      data: {
        cloudinaryFolder: saved.cloudinary_folder,
        id: saved.id,
        slug: saved.slug,
        title: saved.title,
      },
      message: "Gallery album created.",
    },
    { status: 201 }
  );
}

export const POST = withApiGuard(handlePost);
