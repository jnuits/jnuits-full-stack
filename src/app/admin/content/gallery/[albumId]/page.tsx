import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  Archive,
  ExternalLink,
  Image as ImageIcon,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { GalleryAlbumBulkUploadPanel } from "@/components/admin/gallery-album-bulk-upload-panel";
import {
  GalleryAlbumMediaGrid,
  type GalleryAlbumMediaGridItem,
} from "@/components/admin/gallery-album-media-grid";
import { GalleryAlbumTabs } from "@/components/admin/gallery-album-tabs";
import {
  bulkUpdateGalleryAlbumItems,
  reorderGalleryAlbumItems,
  saveGalleryAlbum,
  saveGalleryAlbumItem,
  updateGalleryAlbumLifecycle,
} from "@/app/admin/content/gallery/actions";
import { ADMIN_FLASH_COOKIE_NAME, parseAdminFlash } from "@/lib/admin/flash";
import { CLOUDINARY_PROJECT_ROOT_FOLDER } from "@/lib/branding";
import {
  getCloudinaryPublicConfig,
  isCloudinaryConfigured,
} from "@/lib/cloudinary/config";
import { transformCloudinaryUrl } from "@/lib/cloudinary/urls";
import { getSeedGalleryAdminEditorData } from "@/lib/content/gallery-seed";
import { createAdminClient } from "@/lib/supabase/admin";

type AlbumRow = {
  category: string;
  cloudinary_folder: string | null;
  cover_item_id: string | null;
  deleted_at: string | null;
  description: string | null;
  ends_on: string | null;
  event_name: string | null;
  featured: boolean;
  id: string;
  month: number | null;
  slug: string;
  starts_on: string | null;
  status: string;
  title: string;
  year: number;
};

type ItemRow = {
  alt_text: string | null;
  blur_data_url: string | null;
  deleted_at: string | null;
  description: string | null;
  height: number | null;
  id: string;
  is_cover: boolean;
  sort_order: number;
  source_caption: string | null;
  status: string;
  title: string | null;
  width: number | null;
  media_assets?:
    | {
        alt_text: string | null;
        height: number | null;
        public_id: string;
        secure_url: string;
        title: string | null;
        width: number | null;
      }
    | {
        alt_text: string | null;
        height: number | null;
        public_id: string;
        secure_url: string;
        title: string | null;
        width: number | null;
      }[]
    | null;
};

export const metadata = { title: "Gallery Album Editor — Admin | JnUITS" };

const GALLERY_CATEGORIES = [
  { label: "Workshop / Training", value: "workshop-training" },
  { label: "Competition", value: "competition" },
  { label: "Ceremony / Community", value: "ceremony-community" },
  { label: "Community / Social", value: "community-social" },
  { label: "Tour", value: "tour" },
  { label: "Institutional", value: "institutional" },
  { label: "Member Outreach", value: "member-outreach" },
  { label: "Other Real Event", value: "other-real-event" },
];

function toMonth(value: number | null) {
  return value ? String(value).padStart(2, "0") : "00";
}

function firstRecord<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value || null;
}

function statusBadgeClass(status: string, deletedAt?: string | null) {
  if (deletedAt) {
    return "abadge--rejected";
  }

  if (status === "published") {
    return "abadge--published";
  }

  if (status === "archived") {
    return "abadge--draft";
  }

  return "abadge--active";
}

function photoLabel(albumTitle: string, index: number) {
  return `${albumTitle} - Photo ${index + 1}`;
}

function compactItemText(value: string | null | undefined, fallback: string) {
  const text = String(value || "").trim();

  return text && text.length <= 140 ? text : fallback;
}

function compactItemDescription(value: string | null | undefined) {
  const text = String(value || "").trim();

  return text && text.length <= 260 ? text : "";
}

export default async function GalleryAlbumEditorPage({
  params,
}: {
  params: Promise<{ albumId: string }>;
}) {
  const { albumId } = await params;
  const admin = createAdminClient();
  const cookieStore = await cookies();
  const flash = parseAdminFlash(cookieStore.get(ADMIN_FLASH_COOKIE_NAME)?.value);
  const [albumResult, itemResult, seedEditorData] = await Promise.all([
    admin
      .from("gallery_albums")
      .select(
        "id, slug, title, event_name, description, year, month, starts_on, ends_on, category, status, featured, cover_item_id, cloudinary_folder, deleted_at"
      )
      .eq("id", albumId)
      .maybeSingle(),
    admin
      .from("gallery_album_items")
      .select(
        "id, title, description, alt_text, source_caption, width, height, blur_data_url, sort_order, is_cover, status, deleted_at, media_assets(public_id, secure_url, alt_text, title, width, height)"
      )
      .eq("album_id", albumId)
      .order("deleted_at", { ascending: true, nullsFirst: true })
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true }),
    getSeedGalleryAdminEditorData(albumId),
  ]);
  const seedPreviewMode =
    Boolean(albumResult.error) || Boolean(itemResult.error) || !albumResult.data;
  const album = seedPreviewMode ? seedEditorData?.album : albumResult.data;
  const itemsData = seedPreviewMode ? seedEditorData?.items : itemResult.data;

  if (!album) {
    notFound();
  }

  const typedAlbum = album as AlbumRow;
  const items = (itemsData || []) as ItemRow[];
  const activeItems = items.filter((item) => !item.deleted_at);
  const publicItems = activeItems.filter((item) => item.status === "published");
  const deletedItems = items.filter((item) => item.deleted_at);
  const coverItem =
    publicItems.find((item) => item.id === typedAlbum.cover_item_id) ||
    publicItems.find((item) => item.is_cover) ||
    publicItems[0] ||
    activeItems[0] ||
    null;
  const coverMedia = firstRecord(coverItem?.media_assets);
  const configured = isCloudinaryConfigured();
  const publicConfig = configured ? getCloudinaryPublicConfig() : null;
  const defaultFolder =
    typedAlbum.cloudinary_folder ||
    `${CLOUDINARY_PROJECT_ROOT_FOLDER}/gallery/${typedAlbum.year}/${toMonth(
      typedAlbum.month
    )}/${typedAlbum.slug}`;
  const mediaGridItems: GalleryAlbumMediaGridItem[] = activeItems.map(
    (item, index) => {
      const fallback = photoLabel(typedAlbum.title, index);
      const media = firstRecord(item.media_assets);
      const imageUrl = media?.secure_url
        ? transformCloudinaryUrl(media.secure_url, "detailGrid")
        : "";
      const width = item.width || media?.width || 1200;
      const height = item.height || media?.height || 800;

      return {
        altText: compactItemText(item.alt_text || media?.alt_text, fallback),
        blurDataURL: item.blur_data_url,
        deletedAt: item.deleted_at,
        description: compactItemDescription(item.description),
        height,
        id: item.id,
        imageUrl,
        isCover: item.is_cover || item.id === typedAlbum.cover_item_id,
        sortOrder: item.sort_order,
        status: item.status,
        title: compactItemText(item.title || media?.title, fallback),
        width,
      };
    }
  );

  const albumDetails = (
    <section className="admin-album-details-grid">
      <div className="grid gap-6">
        <section className="admin-review-card">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="admin-section-label">Album cover</p>
              <h2 className="admin-card-row__title">Public preview image</h2>
              <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
                Set the cover from the media tab. If none is selected, the first
                active published image becomes the public cover.
              </p>
            </div>
            <span
              className={`abadge ${statusBadgeClass(
                typedAlbum.status,
                typedAlbum.deleted_at
              )}`}
            >
              {typedAlbum.deleted_at ? "deleted" : typedAlbum.status}
            </span>
          </div>
          <div className="relative min-h-72 overflow-hidden rounded-[1.2rem] border border-[var(--line)] bg-[var(--muted)]">
            {coverMedia?.secure_url ? (
              <Image
                alt={coverItem?.alt_text || coverItem?.title || typedAlbum.title}
                className="object-cover"
                fill
                sizes="(min-width: 1280px) 32rem, 100vw"
                src={transformCloudinaryUrl(coverMedia.secure_url, "albumCard")}
              />
            ) : (
              <div className="admin-gallery-cover-fallback">
                <ImageIcon size={22} />
                <span>No cover selected</span>
              </div>
            )}
          </div>
        </section>

        <div className="admin-review-card">
          <p className="admin-section-label">Danger zone</p>
          <h2 className="admin-card-row__title">Lifecycle controls</h2>
          <p className="text-sm leading-7 text-[var(--muted-foreground)]">
            Archive hides an album from public views. Soft delete keeps metadata
            recoverable; Cloudinary assets are not deleted by this action.
          </p>
          <div className="flex flex-wrap gap-3">
            {seedPreviewMode ? (
              <button
                className="admin-btn admin-btn--ghost opacity-60"
                disabled
                type="button"
              >
                Apply schema to enable lifecycle
              </button>
            ) : typedAlbum.deleted_at ? (
              <form action={updateGalleryAlbumLifecycle}>
                <input name="albumId" type="hidden" value={typedAlbum.id} />
                <input name="intent" type="hidden" value="restore" />
                <button className="admin-btn admin-btn--ghost" type="submit">
                  <RotateCcw size={15} />
                  Restore album
                </button>
              </form>
            ) : (
              <>
                <form action={updateGalleryAlbumLifecycle}>
                  <input name="albumId" type="hidden" value={typedAlbum.id} />
                  <input
                    name="intent"
                    type="hidden"
                    value={
                      typedAlbum.status === "published" ? "archive" : "publish"
                    }
                  />
                  <button className="admin-btn admin-btn--ghost" type="submit">
                    <Archive size={15} />
                    {typedAlbum.status === "published"
                      ? "Archive album"
                      : "Publish album"}
                  </button>
                </form>
                <form action={updateGalleryAlbumLifecycle}>
                  <input name="albumId" type="hidden" value={typedAlbum.id} />
                  <input name="intent" type="hidden" value="delete" />
                  <button className="admin-btn admin-btn--danger" type="submit">
                    <Trash2 size={15} />
                    Soft delete
                  </button>
                </form>
              </>
            )}
          </div>
          <p className="text-sm leading-7 text-[var(--muted-foreground)]">
            Removed image records: {deletedItems.length}. Restore flows can be
            expanded later without touching Cloudinary source files.
          </p>
        </div>
      </div>

      <form action={saveGalleryAlbum} className="admin-review-card">
        <fieldset className="contents" disabled={seedPreviewMode}>
          <input name="albumId" type="hidden" value={typedAlbum.id} />
          <div>
            <p className="admin-section-label">Album metadata</p>
            <h2 className="admin-card-row__title">Public album details</h2>
          </div>
          <label className="input-label">
            Title
            <input defaultValue={typedAlbum.title} name="title" required />
          </label>
          <label className="input-label">
            Slug
            <input defaultValue={typedAlbum.slug} name="slug" required />
          </label>
          <label className="input-label">
            Event name
            <input
              defaultValue={typedAlbum.event_name || typedAlbum.title}
              name="eventName"
            />
          </label>
          <label className="input-label">
            Album description
            <textarea
              defaultValue={typedAlbum.description || ""}
              name="description"
              rows={8}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="input-label">
              Year
              <input
                defaultValue={typedAlbum.year}
                min="2015"
                name="year"
                type="number"
              />
            </label>
            <label className="input-label">
              Month
              <input
                defaultValue={typedAlbum.month || ""}
                max="12"
                min="1"
                name="month"
                type="number"
              />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="input-label">
              Start date
              <input
                defaultValue={typedAlbum.starts_on || ""}
                name="startsOn"
                type="date"
              />
            </label>
            <label className="input-label">
              End date
              <input
                defaultValue={typedAlbum.ends_on || ""}
                name="endsOn"
                type="date"
              />
            </label>
          </div>
          <label className="input-label">
            Category
            <select defaultValue={typedAlbum.category} name="category">
              {GALLERY_CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
          <label className="input-label">
            Cloudinary folder
            <input defaultValue={defaultFolder} name="cloudinaryFolder" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="input-label">
              Status
              <select defaultValue={typedAlbum.status} name="status">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label className="input-label">
              Featured
              <select
                defaultValue={typedAlbum.featured ? "true" : "false"}
                name="featured"
              >
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </label>
          </div>
          <button className="admin-btn admin-btn--primary" type="submit">
            Save album details
          </button>
        </fieldset>
      </form>
    </section>
  );

  const mediaWorkspace = (
    <section className="grid gap-6">
      {seedPreviewMode ? (
        <div className="admin-review-card">
          <p className="admin-section-label">Add photos</p>
          <h2 className="admin-card-row__title">Cloudinary upload registration</h2>
          <p className="text-sm leading-7 text-[var(--muted-foreground)]">
            This panel uploads images to Cloudinary and stores only image
            metadata plus album links in Supabase. It is disabled until the
            gallery metadata tables exist.
          </p>
          <button
            className="admin-btn admin-btn--primary justify-self-start opacity-60"
            disabled
            type="button"
          >
            Apply schema to enable photo add/remove
          </button>
        </div>
      ) : (
        <GalleryAlbumBulkUploadPanel
          albumId={typedAlbum.id}
          cloudName={publicConfig?.cloudName || ""}
          configured={configured}
          defaultFolder={defaultFolder}
        />
      )}

      <GalleryAlbumMediaGrid
        albumId={typedAlbum.id}
        bulkAction={bulkUpdateGalleryAlbumItems}
        disabled={seedPreviewMode}
        itemAction={saveGalleryAlbumItem}
        items={mediaGridItems}
        key={mediaGridItems
          .map(
            (item) =>
              `${item.id}:${item.sortOrder}:${item.status}:${item.isCover}:${item.title}`
          )
          .join("|")}
        reorderAction={reorderGalleryAlbumItems}
      />
    </section>
  );

  return (
    <div className="admin-gallery-workspace grid gap-8">
      <div className="admin-page-header admin-page-header--gallery-editor">
        <div>
          <p className="admin-page-header__breadcrumb">
            Admin / Content / Gallery
          </p>
          <h1 className="admin-page-header__title">{typedAlbum.title}</h1>
          <p className="admin-page-header__desc">
            Edit album details separately from media operations. Photos remain
            in Cloudinary; Supabase stores metadata and album links only.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="admin-btn admin-btn--ghost" href="/admin/content/gallery">
            Back to albums
          </Link>
          <Link
            aria-label={`Open public page for ${typedAlbum.title}`}
            className="admin-icon-button"
            href={`/gallery/${typedAlbum.slug}`}
            rel="noreferrer"
            target="_blank"
            title="Open public page"
          >
            <ExternalLink aria-hidden="true" size={16} strokeWidth={2.25} />
            <span className="sr-only">Open public page</span>
          </Link>
        </div>
      </div>

      {seedPreviewMode ? (
        <section className="flash-panel" data-tone="error">
          <div className="flex flex-wrap items-start gap-4">
            <div className="admin-metric-card__icon">
              <AlertTriangle size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="admin-section-label">Schema required</p>
              <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold">
                This editor is showing seed data until the gallery tables exist.
              </h2>
              <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
                Apply{" "}
                <code>supabase/migrations/20260420000000_gallery_album_rebuild.sql</code>{" "}
                and run <code>npm run gallery:import -- --apply</code> to enable
                saving album metadata, adding photos, removing photos, and
                lifecycle actions.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {flash ? (
        <section className="flash-panel" data-tone={flash.tone}>
          <p className="admin-section-label">Operator feedback</p>
          <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold">
            {flash.title}
          </h2>
          <p className="mt-1 text-sm leading-7">{flash.message}</p>
        </section>
      ) : null}

      <GalleryAlbumTabs
        details={albumDetails}
        media={mediaWorkspace}
        mediaCount={activeItems.length}
        removedCount={deletedItems.length}
      />
    </div>
  );
}
