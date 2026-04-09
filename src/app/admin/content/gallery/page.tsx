import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";
import { ADMIN_FLASH_COOKIE_NAME, parseAdminFlash } from "@/lib/admin/flash";
import { saveGalleryEntry } from "@/app/admin/content/actions";
import { EmptyState } from "@/components/ui/empty-state";
import { Image } from "lucide-react";

type GalleryRecord = {
  id: string;
  title: string;
  caption: string | null;
  status: string;
  sort_order: number;
  media_asset_id: string;
  updated_at: string;
};

type MediaAssetOption = { id: string; title: string | null; public_id: string; media_kind: string };

export const metadata = { title: "Gallery — Admin | JnUITS" };

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = createAdminClient();
  const cookieStore = await cookies();
  const flash = parseAdminFlash(cookieStore.get(ADMIN_FLASH_COOKIE_NAME)?.value);
  const resolved = await searchParams;
  const editId = typeof resolved.edit === "string" ? resolved.edit : "";

  const [galleryResult, mediaResult] = await Promise.all([
    admin
      .from("gallery_entries")
      .select("id, title, caption, status, sort_order, media_asset_id, updated_at")
      .order("sort_order", { ascending: true })
      .limit(30),
    admin.from("media_assets").select("id, title, public_id, media_kind").order("created_at", { ascending: false }).limit(50),
  ]);

  const entries = (galleryResult.data || []) as GalleryRecord[];
  const media = (mediaResult.data || []) as MediaAssetOption[];
  const selected = entries.find((e) => e.id === editId) || null;

  return (
    <div className="grid gap-8">
      <div className="admin-page-header">
        <div>
          <p className="admin-page-header__breadcrumb">Admin / Content</p>
          <h1 className="admin-page-header__title">Gallery</h1>
          <p className="admin-page-header__desc">
            Manage gallery entries. Each entry links a title and caption to a Cloudinary media asset.
          </p>
        </div>
        <span className="abadge abadge--info">{entries.length} entries</span>
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
          <div className="admin-metric-card__icon"><Image size={16} /></div>
          <p className="admin-metric-card__label">Total entries</p>
          <p className="admin-metric-card__value">{entries.length}</p>
          <p className="admin-metric-card__sub">All statuses</p>
        </div>
        <div className="admin-metric-card" data-tone="success">
          <p className="admin-metric-card__label">Published</p>
          <p className="admin-metric-card__value">{entries.filter((e) => e.status === "published").length}</p>
          <p className="admin-metric-card__sub">Live on site</p>
        </div>
        <div className="admin-metric-card">
          <p className="admin-metric-card__label">Draft</p>
          <p className="admin-metric-card__value">{entries.filter((e) => e.status === "draft").length}</p>
          <p className="admin-metric-card__sub">Not yet live</p>
        </div>
      </div>

      {/* Form */}
      <section>
        <p className="admin-section-label">{selected ? `Editing: ${selected.title}` : "Add gallery entry"}</p>
        <div className="admin-review-card">
          <form action={saveGalleryEntry} className="grid gap-4">
            <input type="hidden" name="entryId" value={selected?.id || ""} />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="input-label sm:col-span-2">
                Title
                <input defaultValue={selected?.title || ""} name="title" placeholder="Gallery headline" required />
              </label>
              <label className="input-label sm:col-span-2">
                Caption
                <textarea defaultValue={selected?.caption || ""} name="caption" placeholder="Gallery caption" rows={3} />
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
                Sort order
                <input defaultValue={selected?.sort_order || 100} name="sortOrder" type="number" />
              </label>
              <label className="input-label sm:col-span-2">
                Media asset
                <select defaultValue={selected?.media_asset_id || ""} name="mediaAssetId" required>
                  <option value="">Select a media asset</option>
                  {media.map((a) => (
                    <option key={a.id} value={a.id}>{a.title || a.public_id} ({a.media_kind})</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap gap-3">
              <button className="admin-btn admin-btn--primary" type="submit">
                {selected ? "Update gallery entry" : "Add gallery entry"}
              </button>
              {selected && (
                <Link href="/admin/content/gallery" className="admin-btn admin-btn--ghost">Clear editor</Link>
              )}
            </div>
          </form>
        </div>
      </section>

      {/* Entry list */}
      <section>
        <p className="admin-section-label">Gallery entries</p>
        {entries.length === 0 ? (
          <EmptyState title="No gallery entries" description="Add gallery entries using the form above." />
        ) : (
          <div className="admin-card-list">
            {entries.map((entry) => (
              <div key={entry.id} className="admin-card-row">
                <div className="admin-hub-tile__icon" style={{ flexShrink: 0 }}>
                  <Image size={16} />
                </div>
                <div className="admin-card-row__body">
                  <p className="admin-card-row__title">{entry.title}</p>
                  <p className="admin-card-row__meta">Sort: {entry.sort_order} · Updated {new Date(entry.updated_at).toLocaleDateString("en-BD")}</p>
                </div>
                <div className="admin-card-row__actions">
                  <span className={`abadge abadge--${entry.status === "published" ? "published" : "draft"}`}>{entry.status}</span>
                  <Link href={`/admin/content/gallery?edit=${entry.id}`} className="admin-btn admin-btn--ghost" style={{ padding: "0.3rem 0.75rem", fontSize: "0.77rem" }}>Edit</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
