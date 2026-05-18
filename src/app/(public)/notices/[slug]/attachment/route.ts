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
      "Content-Disposition": `inline; filename="${attachmentFileName(
        notice.slug,
        contentType
      )}"`,
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
