import { requireAdminPagePermission as requireAdminPermission } from "@/lib/admin/activity/page-access";
import Link from "next/link";
import { cookies } from "next/headers";
import { AutoSubmitForm } from "@/components/admin/auto-submit-form";
import { saveContentPost } from "@/app/admin/content/actions";
import {
  BlogMediaSelect,
  type BlogMediaOption,
} from "@/components/admin/blog-media-select";
import { BlogPublishChecklist } from "@/components/admin/blog-publish-checklist";
import { MarkdownEditor } from "@/components/admin/markdown-editor";
import { MemberBlogSubmissionsPanel } from "@/components/admin/member-blog-submissions-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { ADMIN_FLASH_COOKIE_NAME, parseAdminFlash } from "@/lib/admin/flash";
import {
  getBlogCategories,
  getBlogHref,
  makeBlogTeaser,
  normalizeBlogCategory,
} from "@/lib/content/blogs";
import { createAdminClient } from "@/lib/supabase/admin";
import { BookOpen, Clock, Filter } from "lucide-react";

type ContentPostRecord = {
  body: string | null;
  category: string | null;
  content_type: string;
  cta_href: string | null;
  ends_at: string | null;
  excerpt: string | null;
  id: string;
  location: string | null;
  media_asset_id: string | null;
  published_at: string | null;
  read_time: string | null;
  slug: string;
  starts_at: string | null;
  status: string;
  summary: string | null;
  title: string;
  updated_at: string;
};

type MemberBlogSubmission = {
  author_member_id: string | null;
  body: string | null;
  category: string | null;
  excerpt: string | null;
  id: string;
  read_time: string | null;
  review_note: string | null;
  slug: string;
  submitted_at: string | null;
  summary: string | null;
  title: string;
  updated_at: string;
  members?:
    | { email?: string | null; full_name?: string | null; jnuits_id?: string | null }
    | { email?: string | null; full_name?: string | null; jnuits_id?: string | null }[]
    | null;
};

type MediaAssetOption = BlogMediaOption;

export const metadata = { title: "Blogs - Admin | JnUITS" };

function formatAdminDate(value: null | string) {
  if (!value) {
    return "Not set";
  }

  return new Date(value).toLocaleDateString("en-BD", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function blogStatusBadgeClass(status: string) {
  if (status === "published") return "abadge--published";
  if (status === "pending_review") return "abadge--pending";
  if (status === "change_requested") return "abadge--rejected";
  if (status === "archived") return "abadge--draft";
  return "abadge--draft";
}

function normalizeFilter(value: string | string[] | undefined, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function filterPosts(
  posts: ContentPostRecord[],
  filters: { category: string; q: string; status: string }
) {
  const query = filters.q.toLowerCase();

  return posts.filter((post) => {
    const statusMatches =
      filters.status === "all" || !filters.status || post.status === filters.status;
    const categoryMatches =
      !filters.category ||
      normalizeBlogCategory(post.category) === normalizeBlogCategory(filters.category);
    const queryMatches =
      !query ||
      [post.title, post.slug, post.summary, post.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));

    return statusMatches && categoryMatches && queryMatches;
  });
}

export default async function BlogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPermission("cms.blogs.review", { fallbackPath: "/admin/dashboard" });
  const admin = createAdminClient();
  const cookieStore = await cookies();
  const flash = parseAdminFlash(cookieStore.get(ADMIN_FLASH_COOKIE_NAME)?.value);
  const resolved = await searchParams;
  const editId = normalizeFilter(resolved.edit);
  const filters = {
    category: normalizeFilter(resolved.category),
    q: normalizeFilter(resolved.q),
    status: normalizeFilter(resolved.status, "all") || "all",
  };

  const [postsResult, submissionsResult, mediaResult] = await Promise.all([
    admin
      .from("content_posts")
      .select("id, content_type, slug, status, title, category, summary, excerpt, body, read_time, published_at, starts_at, ends_at, location, cta_href, media_asset_id, updated_at")
      .eq("content_type", "blog")
      .order("updated_at", { ascending: false })
      .limit(60),
    admin
      .from("content_posts")
      .select("id, title, slug, summary, excerpt, body, category, read_time, submitted_at, updated_at, review_note, author_member_id, members!content_posts_author_member_id_fkey(full_name, jnuits_id, email)")
      .eq("content_type", "blog")
      .eq("status", "pending_review")
      .order("submitted_at", { ascending: true })
      .limit(10),
    admin
      .from("media_assets")
      .select("id, title, public_id, media_kind, secure_url, thumbnail_url, alt_text")
      .eq("media_kind", "image")
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const posts = (postsResult.data || []) as ContentPostRecord[];
  const submissions = (submissionsResult.data || []) as MemberBlogSubmission[];
  const media = (mediaResult.data || []) as MediaAssetOption[];
  const selected = posts.find((post) => post.id === editId) || null;
  const postCategories = getBlogCategories(posts);
  const filteredPosts = filterPosts(posts, filters);

  return (
    <div className="grid gap-8">
      <div className="admin-page-header">
        <div>
          <p className="admin-page-header__breadcrumb">Admin / Content</p>
          <h1 className="admin-page-header__title">Blogs</h1>
          <p className="admin-page-header__desc">
            Create markdown-first blog posts and review member-submitted drafts before they go live.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {submissions.length > 0 ? (
            <span className="abadge abadge--pending">
              <Clock size={10} /> {submissions.length} pending
            </span>
          ) : null}
        </div>
      </div>

      {flash ? (
        <section className="flash-panel" data-tone={flash.tone}>
          <p className="admin-section-label">Operator feedback</p>
          <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold">
            {flash.title}
          </h2>
          <p className="mt-1 text-sm leading-7">{flash.message}</p>
        </section>
      ) : null}

      <div
        className="admin-metric-grid"
      >
        <div className="admin-metric-card" data-tone="info">
          <div className="admin-metric-card__icon">
            <BookOpen size={16} />
          </div>
          <p className="admin-metric-card__label">Total blogs</p>
          <p className="admin-metric-card__value">{posts.length}</p>
          <p className="admin-metric-card__sub">Loaded editorial records</p>
        </div>
        <div className="admin-metric-card" data-tone="success">
          <p className="admin-metric-card__label">Published</p>
          <p className="admin-metric-card__value">
            {posts.filter((post) => post.status === "published").length}
          </p>
          <p className="admin-metric-card__sub">Live on site</p>
        </div>
        <div className="admin-metric-card" data-tone="warning">
          <p className="admin-metric-card__label">Member submissions</p>
          <p className="admin-metric-card__value">{submissions.length}</p>
          <p className="admin-metric-card__sub">Awaiting review</p>
        </div>
      </div>

      {submissions.length > 0 ? (
        <MemberBlogSubmissionsPanel submissions={submissions} />
      ) : null}

      <section>
        <p className="admin-section-label">
          {selected ? `Editing: ${selected.title}` : "Create new blog post"}
        </p>
        <form action={saveContentPost} className="blog-admin-workspace">
          <input name="postId" type="hidden" value={selected?.id || ""} />
          <input name="contentType" type="hidden" value="blog" />
          <input name="status" type="hidden" value={selected?.status || "draft"} />

          <div className="blog-admin-main">
            <label className="input-label">
              Title
              <input
                defaultValue={selected?.title || ""}
                name="title"
                placeholder="Blog post title"
                required
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="input-label">
                Slug
                <input
                  defaultValue={selected?.slug || ""}
                  name="slug"
                  placeholder="generated-if-empty"
                />
              </label>
              <label className="input-label">
                Related link
                <input
                  defaultValue={selected?.cta_href || ""}
                  name="ctaHref"
                  placeholder="https:// or /internal-link"
                />
              </label>
            </div>

            <label className="input-label">
              Summary
              <textarea
                defaultValue={selected?.summary || ""}
                name="summary"
                placeholder="Short summary for listing cards and metadata"
                rows={3}
              />
            </label>

            <label className="input-label">
              Feature teaser
              <textarea
                defaultValue={selected?.excerpt || ""}
                name="excerpt"
                placeholder="Optional longer teaser for featured cards"
                rows={2}
              />
            </label>

            <MarkdownEditor
              defaultValue={selected?.body || ""}
              name="body"
              placeholder="Write the full blog body in Markdown..."
              previewLabel="Public preview"
              previewTitle="Rendered blog article"
            />
          </div>

          <aside className="blog-admin-sidebar">
            <div className="blog-admin-sidebar__section">
              <p className="admin-section-label">Publication settings</p>
              <div className="blog-status-surface">
                <span>Current status</span>
                <strong>{(selected?.status || "draft").replaceAll("_", " ")}</strong>
              </div>
              <label className="input-label">
                Published at
                <input
                  defaultValue={selected?.published_at?.slice(0, 16) || ""}
                  name="publishedAt"
                  type="datetime-local"
                />
              </label>
              <label className="input-label">
                Category
                <input
                  defaultValue={selected?.category || ""}
                  name="category"
                  placeholder="Platform, Operations"
                />
              </label>
              <label className="input-label">
                Read time
                <input
                  defaultValue={selected?.read_time || ""}
                  name="readTime"
                  placeholder="5 min read"
                />
              </label>
            </div>

            <BlogMediaSelect
              assets={media}
              defaultValue={selected?.media_asset_id || ""}
            />

            <div className="blog-admin-sidebar__section">
              <p className="admin-section-label">SEO preview</p>
              <div className="blog-seo-preview">
                <strong className="blog-bengali-text">
                  {selected?.title || "Blog title"}
                </strong>
                <span>/blogs/{selected?.slug || "generated-slug"}</span>
                <p>
                  {makeBlogTeaser(
                    {
                      body: selected?.body,
                      excerpt: selected?.excerpt,
                      fallback: "Summary preview appears after saving the form.",
                      summary: selected?.summary,
                    },
                    155
                  )}
                </p>
              </div>
            </div>

            <div className="blog-admin-sidebar__section">
              <p className="admin-section-label">Publish checklist</p>
              <BlogPublishChecklist
                defaults={{
                  body: selected?.body || "",
                  publishedAt: selected?.published_at?.slice(0, 16) || "",
                  summary: selected?.summary || "",
                  title: selected?.title || "",
                }}
              />
            </div>

            <div className="blog-admin-actions">
              <button
                className="admin-btn admin-btn--ghost"
                name="intent"
                type="submit"
                value="save"
              >
                {selected ? "Save changes" : "Save draft"}
              </button>
              <button
                className="admin-btn admin-btn--primary"
                name="intent"
                type="submit"
                value="publish"
              >
                Publish
              </button>
              {selected?.status === "published" ? (
                <Link
                  className="admin-btn admin-btn--ghost"
                  href={getBlogHref(selected.slug)}
                  target="_blank"
                >
                  View public
                </Link>
              ) : null}
              {selected ? (
                <button
                  className="admin-btn admin-btn--ghost"
                  name="intent"
                  type="submit"
                  value="archive"
                >
                  Archive
                </button>
              ) : null}
              {selected ? (
                <Link className="admin-btn admin-btn--ghost" href="/admin/content/blogs">
                  Clear editor
                </Link>
              ) : null}
            </div>
          </aside>
        </form>
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="admin-section-label">All blog posts</p>
            <h2 className="admin-card-row__title">Editorial registry</h2>
          </div>
          <AutoSubmitForm action="/admin/content/blogs" className="blog-post-filters">
            <div className="blog-post-filters__search">
              <Filter aria-hidden="true" size={14} />
              <input
                defaultValue={filters.q}
                name="q"
                placeholder="Search title, slug, category"
              />
            </div>
            <select defaultValue={filters.status} name="status">
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="pending_review">Pending review</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
              <option value="change_requested">Change requested</option>
            </select>
            <select defaultValue={filters.category} name="category">
              <option value="">All categories</option>
              {postCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <Link className="admin-btn admin-btn--ghost" href="/admin/content/blogs">
              Clear
            </Link>
          </AutoSubmitForm>
        </div>
        {filteredPosts.length === 0 ? (
          <EmptyState
            description="Create a post or adjust the filters to see more results."
            title="No blog posts found"
          />
        ) : (
          <div className="admin-card-list">
            {filteredPosts.slice(0, 6).map((post) => (
              <div className="admin-card-row" key={post.id}>
                <div className="admin-card-row__body">
                  <p className="admin-card-row__title blog-bengali-text">
                    {post.title}
                  </p>
                  <p className="admin-card-row__meta">
                    {post.slug} · {post.category || "No category"} · Updated{" "}
                    {formatAdminDate(post.updated_at)}
                  </p>
                  <p className="admin-card-row__meta">
                    {makeBlogTeaser(
                      {
                        body: post.body,
                        excerpt: post.excerpt,
                        summary: post.summary,
                      },
                      150
                    )}
                  </p>
                </div>
                <div className="admin-card-row__actions">
                  <span className={`abadge ${blogStatusBadgeClass(post.status)}`}>
                    {post.status.replaceAll("_", " ")}
                  </span>
                  <Link
                    className="admin-btn admin-btn--ghost"
                    href={`/admin/content/blogs?edit=${post.id}`}
                    style={{ fontSize: "0.77rem", padding: "0.3rem 0.75rem" }}
                  >
                    Edit
                  </Link>
                </div>
              </div>
            ))}
            {filteredPosts.length > 6 && (
              <details className="admin-expandable-details mt-2">
                <summary className="cursor-pointer text-xs font-semibold text-[var(--color-primary)] py-1 hover:underline">
                  Show {filteredPosts.length - 6} older blog posts
                </summary>
                <div className="admin-card-list mt-2">
                  {filteredPosts.slice(6).map((post) => (
                    <div className="admin-card-row" key={post.id}>
                      <div className="admin-card-row__body">
                        <p className="admin-card-row__title blog-bengali-text">
                          {post.title}
                        </p>
                        <p className="admin-card-row__meta">
                          {post.slug} · {post.category || "No category"} · Updated{" "}
                          {formatAdminDate(post.updated_at)}
                        </p>
                        <p className="admin-card-row__meta">
                          {makeBlogTeaser(
                            {
                              body: post.body,
                              excerpt: post.excerpt,
                              summary: post.summary,
                            },
                            150
                          )}
                        </p>
                      </div>
                      <div className="admin-card-row__actions">
                        <span className={`abadge ${blogStatusBadgeClass(post.status)}`}>
                          {post.status.replaceAll("_", " ")}
                        </span>
                        <Link
                          className="admin-btn admin-btn--ghost"
                          href={`/admin/content/blogs?edit=${post.id}`}
                          style={{ fontSize: "0.77rem", padding: "0.3rem 0.75rem" }}
                        >
                          Edit
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

