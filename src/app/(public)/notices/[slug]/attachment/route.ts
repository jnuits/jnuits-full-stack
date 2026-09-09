import { NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { getPublishedNoticeByIdentifier } from "@/lib/content/public-content";

export const revalidate = 60;

function isCloudinaryUrl(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);

    return url.protocol === "https:" && url.hostname === "res.cloudinary.com";
  } catch {
    return false;
  }
}

function attachmentFileName(slug: string, contentType: string | null) {
  const extension = contentType?.includes("pdf") ? "pdf" : "bin";

  return `${slug}.${extension}`;
}

// Only genuinely passive types may render inline on our origin. Anything else
// (HTML/SVG/XML planted as a Cloudinary raw asset) is forced to download so a
// hostile payload can never execute in the site's context.
export function mayRenderInline(contentType: string) {
  const normalized = contentType.toLowerCase().split(";", 1)[0]?.trim();

  return new Set([
    "application/pdf",
    "image/avif",
    "image/gif",
    "image/jpeg",
    "image/png",
    "image/webp",
  ]).has(normalized || "");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const notice = await getPublishedNoticeByIdentifier(slug);

  if (!notice?.ctaHref || !isCloudinaryUrl(notice.ctaHref)) {
    notFound();
  }

  const upstream = await fetch(notice.ctaHref, {
    next: { revalidate: 60 },
  });

  if (!upstream.ok || !upstream.body) {
    notFound();
  }

  const contentType =
    upstream.headers.get("content-type") || "application/octet-stream";

  return new NextResponse(upstream.body, {
    headers: {
      "Cache-Control": "public, max-age=60, s-maxage=60",
      "Content-Disposition": `${mayRenderInline(contentType) ? "inline" : "attachment"}; filename="${attachmentFileName(
        notice.slug,
        contentType
      )}"`,
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
