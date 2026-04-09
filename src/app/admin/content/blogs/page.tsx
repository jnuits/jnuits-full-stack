import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";
import { ADMIN_FLASH_COOKIE_NAME, parseAdminFlash } from "@/lib/admin/flash";
import { saveContentPost } from "@/app/admin/content/actions";
import { MemberBlogSubmissionsPanel } from "@/components/admin/member-blog-submissions-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { BookOpen, Clock } from "lucide-react";

type ContentPostRecord = {
  id: string;
  content_type: string;
  slug: string;
  status: string;
  title: string;
  category: string | null;
  summary: string | null;
  excerpt: string | null;
  body: string | null;
  read_time: string | null;
  published_at: string | null;
  starts_at: string | null;
  ends_at: string | null;
  location: string | null;
  cta_href: string | null;
  media_asset_id: string | null;
  updated_at: string;
};

type MemberBlogSubmission = {
  author_member_id: string | null;
  category: string | null;
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

type MediaAssetOption = { id: string; title: string | null; public_id: string; media_kind: string };

export const metadata = { title: "Blogs — Admin | JnUITS" };

export default async function BlogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = createAdminClient();
  const cookieStore = await cookies();
  const flash = parseAdminFlash(cookieStore.get(ADMIN_FLASH_COOKIE_NAME)?.value);
  const resolved = await searchParams;
  const editId = typeof resolved.edit === "string" ? resolved.edit : "";

  const [postsResult, submissionsResult, mediaResult] = await Promise.all([
    admin
      .from("content_posts")
      .select("id, content_type, slug, status, title, category, summary, excerpt, body, read_time, published_at, starts_at, ends_at, location, cta_href, media_asset_id, updated_at")
      .eq("content_type", "blog")
      .order("updated_at", { ascending: false })
      .limit(20),
    admin
      .from("content_posts")
      .select("id, title, slug, summary, category, read_time, submitted_at, updated_at, review_note, author_member_id, members!content_posts_author_member_id_fkey(full_name, jnuits_id, email)")
      .eq("content_type", "blog")
      .eq("status", "submitted")
      .order("submitted_at", { ascending: true })
      .limit(10),
    admin.from("media_assets").select("id, title, public_id, media_kind").order("created_at", { ascending: false }).limit(30),
  ]);

  const posts = (postsResult.data || []) as ContentPostRecord[];
  const submissions = (submissionsResult.data || []) as MemberBlogSubmission[];
  const media = (mediaResult.data || []) as MediaAssetOption[];
  const selected = posts.find((p) => p.id === editId) || null;

  return (
    <div className="grid gap-8">
      <div className="admin-page-header">
        <div>
          <p className="admin-page-header__breadcrumb">Admin / Content</p>
          <h1 className="admin-page-header__title">Blogs</h1>
          <p className="admin-page-header__desc">
            Create and manage blog posts. Review member-submitted blog drafts before they go live.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {submissions.length > 0 && (
            <span className="abadge abadge--pending">
              <Clock size={10} /> {submissions.length} pending
            </span>
          )}
        </div>
      </div>

      {flash && (
        <section className="flash-panel" data-tone={flash.tone}>
          <p className="admin-section-label">Operator feedback</p>
          <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold">{flash.title}</h2>
          <p className="mt-1 text-sm leading-7">{flash.message}</p>
        </section>
      )}

      {/* Metrics */}
      <div className="admin-metric-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(11rem, 1fr))" }}>
        <div className="admin-metric-card" data-tone="info">
          <div className="admin-metric-card__icon"><BookOpen size={16} /></div>
          <p className="admin-metric-card__label">Total blogs</p>
          <p className="admin-metric-card__value">{posts.length}</p>
          <p className="admin-metric-card__sub">All statuses</p>
        </div>
        <div className="admin-metric-card" data-tone="success">
          <p className="admin-metric-card__label">Published</p>
          <p className="admin-metric-card__value">{posts.filter((p) => p.status === "published").length}</p>
          <p className="admin-metric-card__sub">Live on site</p>
        </div>
        <div className="admin-metric-card" data-tone="warning">
          <p className="admin-metric-card__label">Member submissions</p>
          <p className="admin-metric-card__value">{submissions.length}</p>
          <p className="admin-metric-card__sub">Awaiting review</p>
        </div>
      </div>

      {/* Member Submissions */}
      {submissions.length > 0 && (
        <MemberBlogSubmissionsPanel submissions={submissions} />
      )}

      {/* Blog Create/Edit Form */}
      <section>
        <p className="admin-section-label">{selected ? `Editing: ${selected.title}` : "Create new blog post"}</p>
        <div className="admin-review-card">
          <form action={saveContentPost} className="grid gap-4">
            <input type="hidden" name="postId" value={selected?.id || ""} />
            <input type="hidden" name="contentType" value="blog" />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="input-label sm:col-span-2">
                Title
                <input defaultValue={selected?.title || ""} name="title" placeholder="Blog post title" required />
              </label>
              <label className="input-label">
                Slug
                <input defaultValue={selected?.slug || ""} name="slug" placeholder="generated-if-empty" />
              </label>
              <label className="input-label">
                Status
                <select defaultValue={selected?.status || "draft"} name="status">
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <label className="input-label">
                Category
                <input defaultValue={selected?.category || ""} name="category" placeholder="Platform, Operations" />
              </label>
              <label className="input-label">
                Read time
                <input defaultValue={selected?.read_time || ""} name="readTime" placeholder="5 min read" />
              </label>
              <label className="input-label sm:col-span-2">
                Summary
                <textarea defaultValue={selected?.summary || ""} name="summary" placeholder="Short summary" rows={3} />
              </label>
              <label className="input-label sm:col-span-2">
                Body
                <textarea defaultValue={selected?.body || ""} name="body" placeholder="Blog body content" rows={8} />
              </label>
              <label className="input-label">
                Published at
                <input defaultValue={selected?.published_at?.slice(0, 16) || ""} name="publishedAt" type="datetime-local" />
              </label>
              <label className="input-label">
                Media asset
                <select defaultValue={selected?.media_asset_id || ""} name="mediaAssetId">
                  <option value="">No media</option>
                  {media.map((a) => (
                    <option key={a.id} value={a.id}>{a.title || a.public_id} ({a.media_kind})</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap gap-3">
              <button className="admin-btn admin-btn--primary" type="submit">
                {selected ? "Update blog post" : "Save blog post"}
              </button>
              {selected && (
                <Link href="/admin/content/blogs" className="admin-btn admin-btn--ghost">Clear editor</Link>
              )}
            </div>
          </form>
        </div>
      </section>

      {/* Post list */}
      <section>
        <p className="admin-section-label">All blog posts</p>
        {posts.length === 0 ? (
          <EmptyState title="No blog posts yet" description="Create your first blog post using the form above." />
        ) : (
          <div className="admin-card-list">
            {posts.map((post) => (
              <div key={post.id} className="admin-card-row">
                <div className="admin-card-row__body">
                  <p className="admin-card-row__title">{post.title}</p>
                  <p className="admin-card-row__meta">
                    {post.slug} · {post.category || "No category"} · Updated {new Date(post.updated_at).toLocaleDateString("en-BD")}
                  </p>
                </div>
                <div className="admin-card-row__actions">
                  <span className={`abadge abadge--${post.status === "published" ? "published" : post.status === "draft" ? "draft" : "draft"}`}>
                    {post.status}
                  </span>
                  <Link href={`/admin/content/blogs?edit=${post.id}`} className="admin-btn admin-btn--ghost" style={{ padding: "0.3rem 0.75rem", fontSize: "0.77rem" }}>
                    Edit
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
