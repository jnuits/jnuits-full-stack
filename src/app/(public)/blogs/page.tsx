import Link from "next/link";
import { BlogCard } from "@/components/blogs/blog-card";
import { BlogFeatureCard } from "@/components/blogs/blog-feature-card";
import {
  getBlogCategories,
  normalizeBlogCategory,
} from "@/lib/content/blogs";
import { getPublishedBlogs } from "@/lib/content/public-content";

export default async function BlogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const selectedCategory =
    typeof resolvedSearchParams.category === "string"
      ? normalizeBlogCategory(resolvedSearchParams.category)
      : "";
  const publicBlogs = await getPublishedBlogs();
  const categories = getBlogCategories(publicBlogs);
  const visibleBlogs = selectedCategory
    ? publicBlogs.filter(
        (blog) => normalizeBlogCategory(blog.category) === selectedCategory
      )
    : publicBlogs;
  const featuredBlog = visibleBlogs[0] || null;
  const latestBlogs = visibleBlogs.slice(1);

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
      ) : (
        <section className="section-band blog-empty-state">
          <p className="section-divider">No articles</p>
          <h2>No published blog posts found</h2>
          <p>
            Published society stories will appear here after editorial review.
          </p>
        </section>
      )}

      {latestBlogs.length > 0 ? (
        <section className="blog-latest-section">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="section-divider">Latest articles</p>
              <h2 className="blog-section-heading blog-bengali-text">
                More from the community
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
      ) : featuredBlog ? (
        <section className="section-band blog-empty-state">
          <p className="section-divider">Latest articles</p>
          <h2>Only one article is published right now</h2>
          <p>More reviewed posts will appear here as the editorial lane grows.</p>
          <Link className="ghost-button" href="/portal/login?next=/portal/blogs">
            Members can submit drafts from the portal
          </Link>
        </section>
      ) : null}
    </div>
  );
}
