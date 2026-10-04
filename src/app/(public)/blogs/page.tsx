import Link from "next/link";
import { BlogCard } from "@/components/blogs/blog-card";
import { BlogFeatureCard } from "@/components/blogs/blog-feature-card";
import {
  getBlogCategories,
  normalizeBlogCategory,
} from "@/lib/content/blogs";
import * as publicContentModule from "@/lib/content/public-content";
import type { BlogPreview } from "@/lib/content/public-content";

export type BlogArchiveResult = {
  items: BlogPreview[];
  categories: string[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

function asString(value: unknown): string {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : "";
  }
  return typeof value === "string" ? value : "";
}

function asPositiveInteger(value: unknown): number {
  if (Array.isArray(value)) {
    return asPositiveInteger(value[0]);
  }
  if (!value) {
    return 1;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function buildBlogHref({
  category,
  page,
}: {
  category: string;
  page: number;
}) {
  const params = new URLSearchParams();

  if (category) {
    params.set("category", category);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const queryString = params.toString();
  return queryString ? `/blogs?${queryString}` : "/blogs";
}

function buildPageNumbers(currentPage: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  return Array.from(
    new Set([1, currentPage - 1, currentPage, currentPage + 1, totalPages])
  )
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((left, right) => left - right);
}

async function loadBlogArchive(filters: {
  page: number;
  category?: string;
}): Promise<BlogArchiveResult> {
  const dynamicFn = Reflect.get(
    publicContentModule,
    "getPublishedBlogArchive"
  ) as
    | ((filters: {
        page?: number;
        category?: string;
      }) => Promise<BlogArchiveResult>)
    | undefined;

  if (typeof dynamicFn === "function") {
    try {
      return await dynamicFn(filters);
    } catch {
      // Fall through to fallback
    }
  }

  // Graceful fallback conforming to getPublishedBlogArchive contract
  const pageSize = 24;
  const publicBlogs = await publicContentModule.getPublishedBlogs();
  const categories = getBlogCategories(publicBlogs);
  const normalizedCategory = filters.category
    ? normalizeBlogCategory(filters.category)
    : "";

  const filtered = normalizedCategory
    ? publicBlogs.filter(
        (blog) => normalizeBlogCategory(blog.category) === normalizedCategory
      )
    : publicBlogs;

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const normalizedPage = Math.min(filters.page, totalPages);
  const items = filtered.slice(
    (normalizedPage - 1) * pageSize,
    normalizedPage * pageSize
  );

  return {
    categories,
    items,
    page: normalizedPage,
    pageSize,
    totalItems,
    totalPages,
  };
}

export default async function BlogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const rawCategory = asString(resolvedSearchParams.category).trim();
  const selectedCategory = rawCategory
    ? normalizeBlogCategory(rawCategory)
    : "";
  const requestedPage = asPositiveInteger(resolvedSearchParams.page);

  const archive = await loadBlogArchive({
    category: selectedCategory,
    page: requestedPage,
  });

  const categories = archive.categories.length
    ? archive.categories
    : getBlogCategories(archive.items);

  // F7 Contract: On page 1 only, feature the first post and grid the rest.
  // On page > 1, do not feature any post; render all items in the grid (never drop the first item).
  const isFirstPage = archive.page === 1;
  const featuredBlog = isFirstPage ? archive.items[0] || null : null;
  const latestBlogs = isFirstPage ? archive.items.slice(1) : archive.items;
  const pageNumbers = buildPageNumbers(archive.page, archive.totalPages);

  return (
    <div className="shell blog-index-shell py-12">
      <section className="blog-index-hero">
        <div>
          <span className="eyebrow">JnUITS editorial</span>
          <h1 className="section-title blog-bengali-text mt-4">
            Stories, announcements, and technology reflections from the JnUITS community.
          </h1>
        </div>
        <p className="section-copy">
          Program updates, student initiatives, and society activities published
          for members, alumni, and the wider public audience.
        </p>
      </section>

      {categories.length > 1 ? (
        <nav className="blog-category-nav" aria-label="Blog categories">
          <Link
            aria-current={!selectedCategory ? "page" : undefined}
            className={!selectedCategory ? "is-active" : ""}
            href="/blogs"
          >
            All
          </Link>
          {categories.map((category) => (
            <Link
              aria-current={selectedCategory === category ? "page" : undefined}
              className={selectedCategory === category ? "is-active" : ""}
              href={`/blogs?category=${encodeURIComponent(category)}`}
              key={category}
            >
              {category}
            </Link>
          ))}
        </nav>
      ) : null}

      {featuredBlog ? (
        <BlogFeatureCard blog={featuredBlog} />
      ) : archive.items.length === 0 ? (
        <section className="section-band blog-empty-state">
          <p className="section-divider">No articles</p>
          <h2>No published blog posts found</h2>
          <p>
            {selectedCategory
              ? `No published articles found in category "${selectedCategory}".`
              : "Published society stories will appear here after editorial review."}
          </p>
          {selectedCategory ? (
            <Link className="secondary-button mt-4" href="/blogs">
              View all articles
            </Link>
          ) : null}
        </section>
      ) : null}

      {latestBlogs.length > 0 ? (
        <section className="blog-latest-section">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="section-divider">
                {isFirstPage ? "Latest articles" : `Page ${archive.page}`}
              </p>
              <h2 className="blog-section-heading blog-bengali-text">
                {isFirstPage ? "More from the community" : `All articles (Page ${archive.page} of ${archive.totalPages})`}
              </h2>
            </div>
            <Link className="ghost-button" href="/portal/login?next=/portal/blogs">
              Draft in portal
            </Link>
          </div>
          <div className="blog-card-grid">
            {latestBlogs.map((blog) => (
              <BlogCard blog={blog} key={blog.slug} />
            ))}
          </div>
        </section>
      ) : isFirstPage && featuredBlog ? (
        <section className="section-band blog-empty-state">
          <p className="section-divider">Latest articles</p>
          <h2>Only one article is published right now</h2>
          <p>More reviewed posts will appear here as the editorial lane grows.</p>
          <Link className="ghost-button" href="/portal/login?next=/portal/blogs">
            Members can submit drafts from the portal
          </Link>
        </section>
      ) : null}

      {archive.totalPages > 1 ? (
        <nav aria-label="Blog pages" className="notices-pagination mt-8">
          <Link
            aria-disabled={archive.page <= 1}
            className={`secondary-button ${
              archive.page <= 1 ? "pointer-events-none opacity-50" : ""
            }`}
            href={buildBlogHref({
              category: selectedCategory,
              page: Math.max(1, archive.page - 1),
            })}
          >
            Previous
          </Link>
          {pageNumbers.map((pageNumber) => (
            <Link
              aria-current={pageNumber === archive.page ? "page" : undefined}
              className={
                pageNumber === archive.page ? "primary-button" : "secondary-button"
              }
              href={buildBlogHref({
                category: selectedCategory,
                page: pageNumber,
              })}
              key={pageNumber}
            >
              {pageNumber}
            </Link>
          ))}
          <Link
            aria-disabled={archive.page >= archive.totalPages}
            className={`secondary-button ${
              archive.page >= archive.totalPages
                ? "pointer-events-none opacity-50"
                : ""
            }`}
            href={buildBlogHref({
              category: selectedCategory,
              page: Math.min(archive.totalPages, archive.page + 1),
            })}
          >
            Next
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
