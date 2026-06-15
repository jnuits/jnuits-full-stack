export const BLOG_CARD_TEASER_LENGTH = 180;
export const BLOG_FEATURE_TEASER_LENGTH = 320;
export const BLOG_FALLBACK_IMAGE_SRC = "/images/home-group.jpg";

type BlogTeaserSource = {
  body?: null | string;
  excerpt?: null | string;
  fallback?: string;
  summary?: null | string;
};

type BlogPublishValidationInput = {
  body: string;
  publishedAt: string;
  slug: string;
  status: string;
  summary: string;
  title: string;
};

type ContentPostRevalidationInput = {
  contentType: string;
  previousSlug?: null | string;
  slug: string;
};

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stripMarkdownLinks(value: string) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

export function stripMarkdownForTeaser(value: string) {
  const withoutCodeBlocks = value.replace(/```[\s\S]*?```/g, " ");
  const withoutInlineCode = withoutCodeBlocks.replace(/`([^`]+)`/g, "$1");
  const withoutLinks = stripMarkdownLinks(withoutInlineCode);

  return collapseWhitespace(
    withoutLinks
      .replace(/<[^>]+>/g, " ")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^>\s?/gm, "")
      .replace(/^[\s-]*(?:[-*+]|\d+\.)\s+/gm, "")
      .replace(/[*_~]{1,3}/g, "")
      .replace(/\|/g, " ")
  );
}

export function clampText(value: string, maxLength: number) {
  const normalized = collapseWhitespace(value);

  if (Array.from(normalized).length <= maxLength) {
    return normalized;
  }

  const clipped = Array.from(normalized).slice(0, Math.max(0, maxLength - 3)).join("");
  const boundary = clipped.lastIndexOf(" ");
  const safeClip = boundary > Math.floor(maxLength * 0.62) ? clipped.slice(0, boundary) : clipped;

  return `${safeClip.trimEnd()}...`;
}

export function makeBlogTeaser(
  source: BlogTeaserSource,
  maxLength = BLOG_CARD_TEASER_LENGTH
) {
  const candidate =
    source.summary || source.excerpt || source.body || source.fallback || "";

  return clampText(stripMarkdownForTeaser(candidate), maxLength);
}

export function normalizeBlogCategory(value: null | string | undefined) {
  return collapseWhitespace(value || "Blog");
}

export function getBlogCategories<T extends { category?: null | string }>(
  blogs: T[]
) {
  return Array.from(
    new Set(
      blogs
        .map((blog) => normalizeBlogCategory(blog.category))
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));
}

export function isBlogFallbackImage(src: null | string | undefined) {
  return !src || src === BLOG_FALLBACK_IMAGE_SRC;
}

export function decodeBlogIdentifier(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function getBlogHref(slug: string) {
  return `/blogs/${encodeURIComponent(slug)}`;
}

export function getBlogPublishValidationError(
  input: BlogPublishValidationInput
) {
  if (input.status !== "published") {
    return null;
  }

  if (!input.title.trim()) {
    return "Published blogs require a title.";
  }

  if (!input.slug.trim()) {
    return "Published blogs require a public slug.";
  }

  if (!input.summary.trim()) {
    return "Published blogs require a summary for listing cards and metadata.";
  }

  if (!input.body.trim()) {
    return "Published blogs require a markdown body.";
  }

  if (!input.publishedAt.trim()) {
    return "Published blogs require a publish date.";
  }

  return null;
}

export function getContentPostRevalidationPaths({
  contentType,
  previousSlug,
  slug,
}: ContentPostRevalidationInput) {
  const paths = new Set<string>(["/admin/content"]);

  if (contentType === "blog") {
    paths.add("/admin/content/blogs");
    paths.add("/blogs");
    paths.add(`/blogs/${slug}`);
    if (previousSlug && previousSlug !== slug) {
      paths.add(`/blogs/${previousSlug}`);
    }
  }

  if (contentType === "event") {
    paths.add("/events");
    paths.add(`/events/${slug}`);
    if (previousSlug && previousSlug !== slug) {
      paths.add(`/events/${previousSlug}`);
    }
  }

  if (contentType === "notice") {
    paths.add("/notices");
    paths.add(`/notices/${slug}`);
    if (previousSlug && previousSlug !== slug) {
      paths.add(`/notices/${previousSlug}`);
    }
  }

  return Array.from(paths);
}
