import { cookies } from "next/headers";
import Link from "next/link";
import {
  saveContentPage,
  saveContentPost,
  saveDeveloperProfile,
  saveGalleryEntry,
  saveMediaAsset,
} from "@/app/admin/content/actions";
import { CloudinaryUploadPanel } from "@/components/admin/cloudinary-upload-panel";
import { MemberBlogSubmissionsPanel } from "@/components/admin/member-blog-submissions-panel";
import {
  ADMIN_FLASH_COOKIE_NAME,
  parseAdminFlash,
} from "@/lib/admin/flash";
import {
  getCloudinaryPublicConfig,
  isCloudinaryConfigured,
} from "@/lib/cloudinary/config";
import { CLOUDINARY_PROJECT_ROOT_FOLDER } from "@/lib/branding";
import { createAdminClient } from "@/lib/supabase/admin";

type MediaAssetOption = {
  id: string;
  media_kind: string;
  public_id: string;
  secure_url: string;
  title: string | null;
};

type ContentPageRecord = {
  body: unknown;
  eyebrow: string | null;
  slug: string;
  status: string;
  summary: string | null;
  title: string;
  updated_at: string;
};

type ContentPostRecord = {
  body: string | null;
  category: string | null;
  cta_href: string | null;
  id: string;
  content_type: string;
  ends_at: string | null;
  excerpt: string | null;
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

type GalleryRecord = {
  caption: string | null;
  id: string;
  media_asset_id: string;
  sort_order: number;
  status: string;
  title: string;
  updated_at: string;
};

type DeveloperRecord = {
  bio: string;
  focus: string;
  id: string;
  is_lead: boolean;
  media_asset_id: string | null;
  name: string;
  role: string;
  sort_order: number;
  status: string;
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

function resolveSearchParam(
  value: string | string[] | undefined
) {
  return typeof value === "string" ? value : "";
}

function serializeJson(value: unknown) {
  if (!value) {
    return "";
  }

  return JSON.stringify(value, null, 2);
}

function formatDateTimeInput(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export default async function AdminContentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = createAdminClient();
  const cookieStore = await cookies();
  const resolvedSearchParams = await searchParams;
  const cloudinaryConfigured = isCloudinaryConfigured();
  const cloudinaryConfig = cloudinaryConfigured
    ? getCloudinaryPublicConfig()
    : null;
  const flash = parseAdminFlash(
    cookieStore.get(ADMIN_FLASH_COOKIE_NAME)?.value
  );

  const [
    mediaResult,
    pagesResult,
    postsResult,
    galleryResult,
    developersResult,
    submittedBlogsResult,
  ] =
    await Promise.all([
      admin
        .from("media_assets")
        .select("id, title, public_id, media_kind, secure_url")
        .order("created_at", { ascending: false })
        .limit(20),
      admin
        .from("content_pages")
        .select("slug, status, title, eyebrow, summary, body, updated_at")
        .order("slug", { ascending: true }),
      admin
        .from("content_posts")
        .select("id, content_type, slug, status, title, category, summary, excerpt, body, read_time, published_at, starts_at, ends_at, location, cta_href, media_asset_id, updated_at")
        .order("updated_at", { ascending: false })
        .limit(16),
      admin
        .from("gallery_entries")
        .select("id, title, caption, status, sort_order, media_asset_id, updated_at")
        .order("updated_at", { ascending: false })
        .limit(12),
      admin
        .from("developer_profiles")
        .select("id, name, role, focus, bio, status, is_lead, sort_order, media_asset_id, updated_at")
        .order("updated_at", { ascending: false })
        .limit(12),
      admin
        .from("content_posts")
        .select(
          "id, title, slug, summary, category, read_time, submitted_at, updated_at, review_note, author_member_id, members!content_posts_author_member_id_fkey(full_name, jnuits_id, email)"
        )
        .eq("content_type", "blog")
        .eq("status", "submitted")
        .order("submitted_at", { ascending: true })
        .limit(8),
    ]);

  const mediaAssets = (mediaResult.data || []) as MediaAssetOption[];
  const pageRows = (pagesResult.data || []) as ContentPageRecord[];
  const postRows = (postsResult.data || []) as ContentPostRecord[];
  const galleryRows = (galleryResult.data || []) as GalleryRecord[];
  const developerRows = (developersResult.data || []) as DeveloperRecord[];
  const submittedBlogs =
    (submittedBlogsResult.data || []) as MemberBlogSubmission[];
  const selectedPageSlug = resolveSearchParam(resolvedSearchParams.editPage);
  const selectedPostId = resolveSearchParam(resolvedSearchParams.editPost);
  const selectedGalleryId = resolveSearchParam(resolvedSearchParams.editGallery);
  const selectedDeveloperId = resolveSearchParam(resolvedSearchParams.editDeveloper);
  const selectedPage =
    pageRows.find((page) => page.slug === selectedPageSlug) || null;
  const selectedPost =
    postRows.find((post) => post.id === selectedPostId) || null;
  const selectedGallery =
    galleryRows.find((entry) => entry.id === selectedGalleryId) || null;
  const selectedDeveloper =
    developerRows.find((profile) => profile.id === selectedDeveloperId) || null;

  return (
    <div className="grid gap-8">
      <div>
        <div className="workspace-topbar">
          <span className="eyebrow">Content and media admin</span>
          <span className="status-pill">
            {cloudinaryConfigured
              ? "Cloudinary env detected"
              : "Cloudinary env still needed"}
          </span>
        </div>
        <h1 className="section-title text-[2.5rem]">
          Manage public content and Cloudinary-backed media metadata
        </h1>
        <p className="section-copy mt-3">
          Public collections now have a real admin lane. Large photos and videos
          stay in Cloudinary; Supabase stores only the metadata and publishing
          relationships.
        </p>
      </div>

      {flash ? (
        <section className="flash-panel" data-tone={flash.tone}>
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-[var(--muted)]">
            Operator feedback
          </p>
          <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-[-0.03em]">
            {flash.title}
          </h2>
          <p className="section-copy mt-2">{flash.message}</p>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="metric-card">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--muted)]">
            Media assets
          </p>
          <p className="metric-card__value mt-3">{mediaAssets.length}</p>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            Cloudinary image/video references available for public pages.
          </p>
        </article>
        <article className="metric-card">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--muted)]">
            Page singletons
          </p>
          <p className="metric-card__value mt-3">{pageRows.length}</p>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            Home, about, contact, and footer can now live in Supabase.
          </p>
        </article>
        <article className="metric-card">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--muted)]">
            Collection posts
          </p>
          <p className="metric-card__value mt-3">{postRows.length}</p>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            Blogs, notices, and events now share one moderated post model.
          </p>
        </article>
        <article className="metric-card">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--muted)]">
            Gallery + developers
          </p>
          <p className="metric-card__value mt-3">
            {galleryRows.length + developerRows.length}
          </p>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            Extra public collections now sit on their own durable tables.
          </p>
        </article>
      </section>

      <CloudinaryUploadPanel
        cloudName={cloudinaryConfig?.cloudName || "unconfigured"}
        configured={cloudinaryConfigured}
        defaultFolder={CLOUDINARY_PROJECT_ROOT_FOLDER}
      />

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="section-band">
          <span className="eyebrow">Editing status</span>
          <div className="mt-5 grid gap-3">
            <article className="route-tile">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3>{selectedPage ? `Editing page: ${selectedPage.slug}` : "Singleton editor idle"}</h3>
                <span className="status-pill">
                  {selectedPage ? selectedPage.status : "Create"}
                </span>
              </div>
              <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                {selectedPage
                  ? "The singleton form below is prefilled from the current published or draft row."
                  : "Pick a page row below to load its current content into the editor."}
              </p>
            </article>
            <article className="route-tile">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3>{selectedPost ? `Editing post: ${selectedPost.slug}` : "Collection editor idle"}</h3>
                <span className="status-pill">
                  {selectedPost ? selectedPost.status : "Create"}
                </span>
              </div>
              <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                {selectedPost
                  ? "The blog, notice, or event form is loaded with the selected row for update."
                  : "Use the recent collection list to edit an existing row or create a new one."}
              </p>
            </article>
          </div>
        </article>
        <article className="section-band">
          <span className="eyebrow">Operator note</span>
          <div className="mt-5 grid gap-3">
            <article className="route-tile">
              <h3>Brand-managed singleton content</h3>
              <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                Home, about, contact, and footer are now editable from this workspace, and the public routes read them directly.
              </p>
            </article>
            <article className="route-tile">
              <h3>Cloudinary project root</h3>
              <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                New uploads are constrained under <code>{CLOUDINARY_PROJECT_ROOT_FOLDER}</code> so gallery, album, and video media stay organized.
              </p>
            </article>
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <form action={saveMediaAsset} className="section-band grid gap-4">
          <div>
            <span className="eyebrow">Manual Cloudinary registry</span>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.6rem)] leading-[0.96] tracking-[-0.04em]">
              Register an existing Cloudinary asset when upload happened elsewhere
            </h2>
          </div>
          <div className="portal-form-grid">
            <label className="input-label">
              Title
              <input name="title" placeholder="Workshop cover image" />
            </label>
            <label className="input-label">
              Public ID
              <input name="publicId" placeholder="jnuits/events/workshop-cover" required />
            </label>
            <label className="input-label">
              Media kind
              <select defaultValue="image" name="mediaKind">
                <option value="image">Image</option>
                <option value="video">Video</option>
              </select>
            </label>
            <label className="input-label">
              Resource type
              <input defaultValue="image" name="resourceType" placeholder="image or video" required />
            </label>
            <label className="input-label sm:col-span-2">
              Secure URL
              <input
                name="secureUrl"
                placeholder="https://res.cloudinary.com/..."
                required
              />
            </label>
            <label className="input-label sm:col-span-2">
              Thumbnail URL
              <input name="thumbnailUrl" placeholder="Optional Cloudinary thumbnail URL" />
            </label>
            <label className="input-label">
              Width
              <input name="width" type="number" />
            </label>
            <label className="input-label">
              Height
              <input name="height" type="number" />
            </label>
            <label className="input-label">
              Bytes
              <input name="bytes" type="number" />
            </label>
            <label className="input-label">
              Duration (seconds)
              <input name="durationSeconds" type="number" step="0.01" />
            </label>
            <label className="input-label">
              Format
              <input name="format" placeholder="jpg, webp, mp4" />
            </label>
            <label className="input-label">
              Public visibility
              <select defaultValue="true" name="isPublic">
                <option value="true">Public</option>
                <option value="false">Internal only</option>
              </select>
            </label>
            <label className="input-label sm:col-span-2">
              Alt text
              <input name="altText" placeholder="Accessible description" />
            </label>
            <label className="input-label sm:col-span-2">
              Metadata JSON
              <textarea
                name="metadataJson"
                placeholder='{"source":"cloudinary","folder":"jnuits/jnuits-full-stack/gallery"}'
                rows={4}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="primary-button" type="submit">
              Save media asset
            </button>
          </div>
        </form>

        <div className="section-band grid gap-4">
          <div>
            <span className="eyebrow">Current media</span>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.6rem)] leading-[0.96] tracking-[-0.04em]">
              Recently registered Cloudinary assets
            </h2>
          </div>
          <div className="grid gap-3">
            {mediaAssets.length === 0 ? (
              <div className="empty-state">
                No Cloudinary media metadata is stored yet. Register assets here
                before linking them into public content.
              </div>
            ) : (
              mediaAssets.map((asset) => (
                <article key={asset.id} className="route-tile">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3>{asset.title || asset.public_id}</h3>
                    <span className="status-pill">{asset.media_kind}</span>
                  </div>
                  <p className="mt-2 break-all text-sm leading-7 text-[var(--muted)]">
                    {asset.public_id}
                  </p>
                </article>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
        <form action={saveContentPage} className="section-band grid gap-4">
          <div>
            <span className="eyebrow">Singleton pages</span>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.6rem)] leading-[0.96] tracking-[-0.04em]">
              {selectedPage ? `Update ${selectedPage.slug}` : "Save public page copy and structured body JSON"}
            </h2>
          </div>
          <div className="portal-form-grid">
            <label className="input-label">
              Page
              <select defaultValue={selectedPage?.slug || "about"} name="slug">
                <option value="home">Home</option>
                <option value="about">About</option>
                <option value="contact">Contact</option>
                <option value="footer">Footer</option>
              </select>
            </label>
            <label className="input-label">
              Status
              <select defaultValue={selectedPage?.status || "draft"} name="status">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </label>
            <label className="input-label sm:col-span-2">
              Eyebrow
              <input
                defaultValue={selectedPage?.eyebrow || ""}
                name="eyebrow"
                placeholder="Institutional profile"
              />
            </label>
            <label className="input-label sm:col-span-2">
              Title
              <input
                defaultValue={selectedPage?.title || ""}
                name="title"
                placeholder="Public page title"
                required
              />
            </label>
            <label className="input-label sm:col-span-2">
              Summary
              <textarea
                defaultValue={selectedPage?.summary || ""}
                name="summary"
                placeholder="Page summary"
                rows={4}
              />
            </label>
            <label className="input-label sm:col-span-2">
              Body JSON
              <textarea
                defaultValue={serializeJson(selectedPage?.body)}
                name="bodyJson"
                placeholder='{"story":["..."],"missionTitle":"...","missionPoints":["..."]}'
                rows={8}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="primary-button" type="submit">
              {selectedPage ? "Update content page" : "Save content page"}
            </button>
            {selectedPage ? (
              <Link href="/admin/content" className="ghost-button">
                Clear editor
              </Link>
            ) : null}
          </div>
        </form>

        <article className="section-band">
          <span className="eyebrow">Stored page rows</span>
          <div className="mt-5 grid gap-3">
            {pageRows.length === 0 ? (
              <div className="empty-state">
                No singleton page rows have been saved yet.
              </div>
            ) : (
              pageRows.map((page) => (
                <article key={page.slug} className="route-tile">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3>{page.title}</h3>
                    <span className="status-pill">{page.status}</span>
                  </div>
                  <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                    {page.slug}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link href={`/admin/content?editPage=${page.slug}`} className="queue-link">
                      Edit page row
                    </Link>
                    <span className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                      Updated {new Date(page.updated_at).toLocaleDateString("en-BD")}
                    </span>
                  </div>
                </article>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <form action={saveContentPost} className="section-band grid gap-4">
          <div>
            <span className="eyebrow">Collection posts</span>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.6rem)] leading-[0.96] tracking-[-0.04em]">
              {selectedPost
                ? `Update ${selectedPost.content_type}: ${selectedPost.title}`
                : "Create blogs, notices, and events in one publishing model"}
            </h2>
          </div>
          <input type="hidden" name="postId" value={selectedPost?.id || ""} />
          <div className="portal-form-grid">
            <label className="input-label">
              Content type
              <select defaultValue={selectedPost?.content_type || "blog"} name="contentType">
                <option value="blog">Blog</option>
                <option value="notice">Notice</option>
                <option value="event">Event</option>
              </select>
            </label>
            <label className="input-label">
              Status
              <select defaultValue={selectedPost?.status || "draft"} name="status">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label className="input-label sm:col-span-2">
              Title
              <input
                defaultValue={selectedPost?.title || ""}
                name="title"
                placeholder="Public content title"
                required
              />
            </label>
            <label className="input-label">
              Slug
              <input
                defaultValue={selectedPost?.slug || ""}
                name="slug"
                placeholder="generated-if-empty"
              />
            </label>
            <label className="input-label">
              Category or focus
              <input
                defaultValue={selectedPost?.category || ""}
                name="category"
                placeholder="Platform, Operations, Workshop"
              />
            </label>
            <label className="input-label sm:col-span-2">
              Summary
              <textarea
                defaultValue={selectedPost?.summary || ""}
                name="summary"
                placeholder="Short summary"
                rows={3}
              />
            </label>
            <label className="input-label sm:col-span-2">
              Excerpt
              <textarea
                defaultValue={selectedPost?.excerpt || ""}
                name="excerpt"
                placeholder="Optional excerpt"
                rows={3}
              />
            </label>
            <label className="input-label sm:col-span-2">
              Body
              <textarea
                defaultValue={selectedPost?.body || ""}
                name="body"
                placeholder="Body copy or notice detail"
                rows={6}
              />
            </label>
            <label className="input-label">
              Published at
              <input
                defaultValue={formatDateTimeInput(selectedPost?.published_at || null)}
                name="publishedAt"
                type="datetime-local"
              />
            </label>
            <label className="input-label">
              Read time
              <input
                defaultValue={selectedPost?.read_time || ""}
                name="readTime"
                placeholder="5 min read"
              />
            </label>
            <label className="input-label">
              Starts at
              <input
                defaultValue={formatDateTimeInput(selectedPost?.starts_at || null)}
                name="startsAt"
                type="datetime-local"
              />
            </label>
            <label className="input-label">
              Ends at
              <input
                defaultValue={formatDateTimeInput(selectedPost?.ends_at || null)}
                name="endsAt"
                type="datetime-local"
              />
            </label>
            <label className="input-label">
              Location
              <input
                defaultValue={selectedPost?.location || ""}
                name="location"
                placeholder="Event location"
              />
            </label>
            <label className="input-label">
              CTA href
              <input
                defaultValue={selectedPost?.cta_href || ""}
                name="ctaHref"
                placeholder="https:// or internal route"
              />
            </label>
            <label className="input-label sm:col-span-2">
              Media asset
              <select defaultValue={selectedPost?.media_asset_id || ""} name="mediaAssetId">
                <option value="">No linked media asset</option>
                {mediaAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.title || asset.public_id} • {asset.media_kind}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="primary-button" type="submit">
              {selectedPost ? "Update content post" : "Save content post"}
            </button>
            {selectedPost ? (
              <Link href="/admin/content" className="ghost-button">
                Clear editor
              </Link>
            ) : null}
          </div>
        </form>

        <article className="section-band">
          <span className="eyebrow">Recent collection rows</span>
          <div className="mt-5 grid gap-3">
            {postRows.length === 0 ? (
              <div className="empty-state">
                No public collection rows have been saved yet.
              </div>
            ) : (
              postRows.map((post) => (
                <article key={post.id} className="route-tile">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3>{post.title}</h3>
                    <span className="status-pill">
                      {post.content_type} • {post.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                    {post.slug}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link href={`/admin/content?editPost=${post.id}`} className="queue-link">
                      Edit content row
                    </Link>
                    <span className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                      Updated {new Date(post.updated_at).toLocaleDateString("en-BD")}
                    </span>
                  </div>
                </article>
              ))
            )}
          </div>
        </article>
      </section>

      <MemberBlogSubmissionsPanel submissions={submittedBlogs} />

      <section className="grid gap-4 xl:grid-cols-2">
        <form action={saveGalleryEntry} className="section-band grid gap-4">
          <div>
            <span className="eyebrow">Gallery</span>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.6rem)] leading-[0.96] tracking-[-0.04em]">
              {selectedGallery
                ? `Update gallery entry: ${selectedGallery.title}`
                : "Link gallery captions to Cloudinary assets"}
            </h2>
          </div>
          <input type="hidden" name="entryId" value={selectedGallery?.id || ""} />
          <div className="portal-form-grid">
            <label className="input-label sm:col-span-2">
              Title
              <input
                defaultValue={selectedGallery?.title || ""}
                name="title"
                placeholder="Gallery headline"
                required
              />
            </label>
            <label className="input-label sm:col-span-2">
              Caption
              <textarea
                defaultValue={selectedGallery?.caption || ""}
                name="caption"
                placeholder="Gallery caption"
                rows={4}
              />
            </label>
            <label className="input-label">
              Status
              <select defaultValue={selectedGallery?.status || "draft"} name="status">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label className="input-label">
              Sort order
              <input
                defaultValue={selectedGallery?.sort_order || 100}
                min={1}
                name="sortOrder"
                type="number"
              />
            </label>
            <label className="input-label sm:col-span-2">
              Media asset
              <select defaultValue={selectedGallery?.media_asset_id || ""} name="mediaAssetId" required>
                <option value="">Select Cloudinary media</option>
                {mediaAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.title || asset.public_id}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="primary-button" type="submit">
              {selectedGallery ? "Update gallery entry" : "Save gallery entry"}
            </button>
            {selectedGallery ? (
              <Link href="/admin/content" className="ghost-button">
                Clear editor
              </Link>
            ) : null}
          </div>
        </form>

        <form action={saveDeveloperProfile} className="section-band grid gap-4">
          <div>
            <span className="eyebrow">Developer credits</span>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.6rem)] leading-[0.96] tracking-[-0.04em]">
              {selectedDeveloper
                ? `Update contributor profile: ${selectedDeveloper.name}`
                : "Publish developer and contributor profiles"}
            </h2>
          </div>
          <input type="hidden" name="profileId" value={selectedDeveloper?.id || ""} />
          <div className="portal-form-grid">
            <label className="input-label">
              Name
              <input
                defaultValue={selectedDeveloper?.name || ""}
                name="name"
                placeholder="Contributor name"
                required
              />
            </label>
            <label className="input-label">
              Role
              <input
                defaultValue={selectedDeveloper?.role || ""}
                name="role"
                placeholder="Frontend systems lead"
                required
              />
            </label>
            <label className="input-label sm:col-span-2">
              Focus
              <input
                defaultValue={selectedDeveloper?.focus || ""}
                name="focus"
                placeholder="Migration delivery, content surfaces, operations"
                required
              />
            </label>
            <label className="input-label sm:col-span-2">
              Bio
              <textarea
                defaultValue={selectedDeveloper?.bio || ""}
                name="bio"
                placeholder="Short public bio"
                rows={4}
                required
              />
            </label>
            <label className="input-label">
              Status
              <select defaultValue={selectedDeveloper?.status || "draft"} name="status">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label className="input-label">
              Sort order
              <input
                defaultValue={selectedDeveloper?.sort_order || 100}
                min={1}
                name="sortOrder"
                type="number"
              />
            </label>
            <label className="input-label">
              Lead profile
              <select
                defaultValue={selectedDeveloper?.is_lead ? "true" : "false"}
                name="isLead"
              >
                <option value="false">Regular profile</option>
                <option value="true">Lead profile</option>
              </select>
            </label>
            <label className="input-label">
              Media asset
              <select defaultValue={selectedDeveloper?.media_asset_id || ""} name="mediaAssetId">
                <option value="">No linked media asset</option>
                {mediaAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.title || asset.public_id}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="primary-button" type="submit">
              {selectedDeveloper ? "Update contributor profile" : "Save developer profile"}
            </button>
            {selectedDeveloper ? (
              <Link href="/admin/content" className="ghost-button">
                Clear editor
              </Link>
            ) : null}
          </div>
        </form>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="section-band">
          <span className="eyebrow">Gallery registry</span>
          <div className="mt-5 grid gap-3">
            {galleryRows.length === 0 ? (
              <div className="empty-state">No gallery rows saved yet.</div>
            ) : (
              galleryRows.map((entry) => (
                <article key={entry.id} className="route-tile">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3>{entry.title}</h3>
                    <span className="status-pill">{entry.status}</span>
                  </div>
                  <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                    Asset {entry.media_asset_id}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link href={`/admin/content?editGallery=${entry.id}`} className="queue-link">
                      Edit gallery row
                    </Link>
                    <span className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                      Updated {new Date(entry.updated_at).toLocaleDateString("en-BD")}
                    </span>
                  </div>
                </article>
              ))
            )}
          </div>
        </article>
        <article className="section-band">
          <span className="eyebrow">Developer registry</span>
          <div className="mt-5 grid gap-3">
            {developerRows.length === 0 ? (
              <div className="empty-state">No developer profiles saved yet.</div>
            ) : (
              developerRows.map((developer) => (
                <article key={developer.id} className="route-tile">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3>{developer.name}</h3>
                    <span className="status-pill">
                      {developer.status}
                      {developer.is_lead ? " • lead" : ""}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                    {developer.role}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link href={`/admin/content?editDeveloper=${developer.id}`} className="queue-link">
                      Edit contributor row
                    </Link>
                    <span className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                      Updated {new Date(developer.updated_at).toLocaleDateString("en-BD")}
                    </span>
                  </div>
                </article>
              ))
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
