import { cookies } from "next/headers";
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
  slug: string;
  status: string;
  title: string;
  updated_at: string;
};

type ContentPostRecord = {
  id: string;
  content_type: string;
  slug: string;
  status: string;
  title: string;
  updated_at: string;
};

type GalleryRecord = {
  id: string;
  status: string;
  title: string;
  media_asset_id: string;
};

type DeveloperRecord = {
  id: string;
  is_lead: boolean;
  name: string;
  role: string;
  status: string;
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

export default async function AdminContentPage() {
  const admin = createAdminClient();
  const cookieStore = await cookies();
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
        .select("slug, status, title, updated_at")
        .order("slug", { ascending: true }),
      admin
        .from("content_posts")
        .select("id, content_type, slug, status, title, updated_at")
        .order("updated_at", { ascending: false })
        .limit(16),
      admin
        .from("gallery_entries")
        .select("id, title, status, media_asset_id")
        .order("updated_at", { ascending: false })
        .limit(12),
      admin
        .from("developer_profiles")
        .select("id, name, role, status, is_lead")
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
              Save public page copy and structured body JSON
            </h2>
          </div>
          <div className="portal-form-grid">
            <label className="input-label">
              Page
              <select defaultValue="about" name="slug">
                <option value="home">Home</option>
                <option value="about">About</option>
                <option value="contact">Contact</option>
                <option value="footer">Footer</option>
              </select>
            </label>
            <label className="input-label">
              Status
              <select defaultValue="draft" name="status">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </label>
            <label className="input-label sm:col-span-2">
              Eyebrow
              <input name="eyebrow" placeholder="Institutional profile" />
            </label>
            <label className="input-label sm:col-span-2">
              Title
              <input name="title" placeholder="Public page title" required />
            </label>
            <label className="input-label sm:col-span-2">
              Summary
              <textarea name="summary" placeholder="Page summary" rows={4} />
            </label>
            <label className="input-label sm:col-span-2">
              Body JSON
              <textarea
                name="bodyJson"
                placeholder='{"story":["..."],"missionTitle":"...","missionPoints":["..."]}'
                rows={8}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="primary-button" type="submit">
              Save content page
            </button>
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
              Create blogs, notices, and events in one publishing model
            </h2>
          </div>
          <div className="portal-form-grid">
            <label className="input-label">
              Content type
              <select defaultValue="blog" name="contentType">
                <option value="blog">Blog</option>
                <option value="notice">Notice</option>
                <option value="event">Event</option>
              </select>
            </label>
            <label className="input-label">
              Status
              <select defaultValue="draft" name="status">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label className="input-label sm:col-span-2">
              Title
              <input name="title" placeholder="Public content title" required />
            </label>
            <label className="input-label">
              Slug
              <input name="slug" placeholder="generated-if-empty" />
            </label>
            <label className="input-label">
              Category or focus
              <input name="category" placeholder="Platform, Operations, Workshop" />
            </label>
            <label className="input-label sm:col-span-2">
              Summary
              <textarea name="summary" placeholder="Short summary" rows={3} />
            </label>
            <label className="input-label sm:col-span-2">
              Excerpt
              <textarea name="excerpt" placeholder="Optional excerpt" rows={3} />
            </label>
            <label className="input-label sm:col-span-2">
              Body
              <textarea name="body" placeholder="Body copy or notice detail" rows={6} />
            </label>
            <label className="input-label">
              Published at
              <input name="publishedAt" type="datetime-local" />
            </label>
            <label className="input-label">
              Read time
              <input name="readTime" placeholder="5 min read" />
            </label>
            <label className="input-label">
              Starts at
              <input name="startsAt" type="datetime-local" />
            </label>
            <label className="input-label">
              Ends at
              <input name="endsAt" type="datetime-local" />
            </label>
            <label className="input-label">
              Location
              <input name="location" placeholder="Event location" />
            </label>
            <label className="input-label">
              CTA href
              <input name="ctaHref" placeholder="https:// or internal route" />
            </label>
            <label className="input-label sm:col-span-2">
              Media asset
              <select name="mediaAssetId">
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
              Save content post
            </button>
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
              Link gallery captions to Cloudinary assets
            </h2>
          </div>
          <div className="portal-form-grid">
            <label className="input-label sm:col-span-2">
              Title
              <input name="title" placeholder="Gallery headline" required />
            </label>
            <label className="input-label sm:col-span-2">
              Caption
              <textarea name="caption" placeholder="Gallery caption" rows={4} />
            </label>
            <label className="input-label">
              Status
              <select defaultValue="draft" name="status">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label className="input-label">
              Sort order
              <input defaultValue={100} min={1} name="sortOrder" type="number" />
            </label>
            <label className="input-label sm:col-span-2">
              Media asset
              <select name="mediaAssetId" required>
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
              Save gallery entry
            </button>
          </div>
        </form>

        <form action={saveDeveloperProfile} className="section-band grid gap-4">
          <div>
            <span className="eyebrow">Developer credits</span>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.6rem)] leading-[0.96] tracking-[-0.04em]">
              Publish developer and contributor profiles
            </h2>
          </div>
          <div className="portal-form-grid">
            <label className="input-label">
              Name
              <input name="name" placeholder="Contributor name" required />
            </label>
            <label className="input-label">
              Role
              <input name="role" placeholder="Frontend systems lead" required />
            </label>
            <label className="input-label sm:col-span-2">
              Focus
              <input name="focus" placeholder="Migration delivery, content surfaces, operations" required />
            </label>
            <label className="input-label sm:col-span-2">
              Bio
              <textarea name="bio" placeholder="Short public bio" rows={4} required />
            </label>
            <label className="input-label">
              Status
              <select defaultValue="draft" name="status">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label className="input-label">
              Sort order
              <input defaultValue={100} min={1} name="sortOrder" type="number" />
            </label>
            <label className="input-label">
              Lead profile
              <select defaultValue="false" name="isLead">
                <option value="false">Regular profile</option>
                <option value="true">Lead profile</option>
              </select>
            </label>
            <label className="input-label">
              Media asset
              <select name="mediaAssetId">
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
              Save developer profile
            </button>
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
                </article>
              ))
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
