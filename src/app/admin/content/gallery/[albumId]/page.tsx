import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { GalleryAlbumBulkUploadPanel } from "@/components/admin/gallery-album-bulk-upload-panel";
import { GalleryAlbumReorderPanel } from "@/components/admin/gallery-album-reorder-panel";
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
import { createAdminClient } from "@/lib/supabase/admin";

type AlbumRow = {
  category: string;
  cloudinary_folder: string | null;
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
  media_assets?: {
    alt_text: string | null;
    height: number | null;
    public_id: string;
    secure_url: string;
    title: string | null;
    width: number | null;
  } | null;
};

export const metadata = { title: "Gallery Album Editor — Admin | JnUITS" };

const ADMIN_ALBUM_ITEMS_PER_PAGE = 20;

function toMonth(value: number | null) {
  return value ? String(value).padStart(2, "0") : "00";
}

function parsePage(value: string | string[] | undefined) {
  if (typeof value !== "string") {
    return 1;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function buildAlbumEditorPageHref(albumId: string, page: number) {
  const params = new URLSearchParams();

  if (page > 1) {
    params.set("itemPage", String(page));
  }

  const queryString = params.toString();

  return queryString
    ? `/admin/content/gallery/${albumId}?${queryString}`
    : `/admin/content/gallery/${albumId}`;
}

function buildPageNumbers(currentPage: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  return Array.from(
    new Set([1, currentPage - 1, currentPage, currentPage + 1, totalPages])
  )
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((first, second) => first - second);
}

export default async function GalleryAlbumEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ albumId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { albumId } = await params;
  const queryParams = await searchParams;
  const admin = createAdminClient();
  const cookieStore = await cookies();
  const flash = parseAdminFlash(cookieStore.get(ADMIN_FLASH_COOKIE_NAME)?.value);
  const [{ data: album }, { data: itemsData }] = await Promise.all([
    admin
      .from("gallery_albums")
      .select("id, slug, title, event_name, description, year, month, starts_on, ends_on, category, status, featured, cloudinary_folder, deleted_at")
      .eq("id", albumId)
      .maybeSingle(),
    admin
      .from("gallery_album_items")
      .select("id, title, description, alt_text, source_caption, width, height, blur_data_url, sort_order, is_cover, status, deleted_at, media_assets(public_id, secure_url, alt_text, title, width, height)")
      .eq("album_id", albumId)
      .order("deleted_at", { ascending: true, nullsFirst: true })
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true }),
  ]);

  if (!album) {
    notFound();
  }

  const typedAlbum = album as AlbumRow;
  const items = (itemsData || []) as ItemRow[];
  const activeItems = items.filter((item) => !item.deleted_at);
  const deletedItems = items.filter((item) => item.deleted_at);
  const requestedItemPage = parsePage(queryParams.itemPage);
  const totalItemPages = Math.max(
    1,
    Math.ceil(items.length / ADMIN_ALBUM_ITEMS_PER_PAGE)
  );
  const currentItemPage = Math.min(requestedItemPage, totalItemPages);
  const itemStart = (currentItemPage - 1) * ADMIN_ALBUM_ITEMS_PER_PAGE;
  const visibleItems = items.slice(
    itemStart,
    itemStart + ADMIN_ALBUM_ITEMS_PER_PAGE
  );
  const firstVisibleItem = items.length ? itemStart + 1 : 0;
  const lastVisibleItem = Math.min(itemStart + visibleItems.length, items.length);
  const itemPageNumbers = buildPageNumbers(currentItemPage, totalItemPages);
  const configured = isCloudinaryConfigured();
  const publicConfig = configured ? getCloudinaryPublicConfig() : null;
  const defaultFolder =
    typedAlbum.cloudinary_folder ||
    `${CLOUDINARY_PROJECT_ROOT_FOLDER}/gallery/${typedAlbum.year}/${toMonth(
      typedAlbum.month
    )}/${typedAlbum.slug}`;

  return (
    <div className="grid gap-8">
      <div className="admin-page-header">
        <div>
          <p className="admin-page-header__breadcrumb">
            Admin / Content / Gallery
          </p>
          <h1 className="admin-page-header__title">{typedAlbum.title}</h1>
          <p className="admin-page-header__desc">
            Edit album metadata, register Cloudinary uploads, manage bulk image
            states, choose a cover image, and control public visibility.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="admin-btn admin-btn--ghost" href="/admin/content/gallery">
            Back to albums
          </Link>
          <Link className="admin-btn admin-btn--ghost" href={`/gallery/${typedAlbum.slug}`} target="_blank">
            Public page
          </Link>
        </div>
      </div>

      {flash && (
        <section className="flash-panel" data-tone={flash.tone}>
          <p className="admin-section-label">Operator feedback</p>
          <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold">
            {flash.title}
          </h2>
          <p className="mt-1 text-sm leading-7">{flash.message}</p>
        </section>
      )}

      <section className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
        <div className="grid gap-6">
          <form action={saveGalleryAlbum} className="admin-review-card grid gap-4">
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
              <input defaultValue={typedAlbum.event_name || typedAlbum.title} name="eventName" />
            </label>
            <label className="input-label">
              Description
              <textarea defaultValue={typedAlbum.description || ""} name="description" rows={4} />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="input-label">
                Year
                <input defaultValue={typedAlbum.year} min="2015" name="year" type="number" />
              </label>
              <label className="input-label">
                Month
                <input defaultValue={typedAlbum.month || ""} max="12" min="1" name="month" type="number" />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="input-label">
                Start date
                <input defaultValue={typedAlbum.starts_on || ""} name="startsOn" type="date" />
              </label>
              <label className="input-label">
                End date
                <input defaultValue={typedAlbum.ends_on || ""} name="endsOn" type="date" />
              </label>
            </div>
            <label className="input-label">
              Category
              <input defaultValue={typedAlbum.category} name="category" />
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
                <select defaultValue={typedAlbum.featured ? "true" : "false"} name="featured">
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </label>
            </div>
            <button className="admin-btn admin-btn--primary" type="submit">
              Save album
            </button>
          </form>

          <div className="admin-review-card grid gap-3">
            <p className="admin-section-label">Lifecycle</p>
            <div className="flex flex-wrap gap-3">
              {["publish", "archive", "delete", "restore"].map((intent) => (
                <form action={updateGalleryAlbumLifecycle} key={intent}>
                  <input name="albumId" type="hidden" value={typedAlbum.id} />
                  <input name="intent" type="hidden" value={intent} />
                  <button className="admin-btn admin-btn--ghost" type="submit">
                    {intent.charAt(0).toUpperCase() + intent.slice(1)}
                  </button>
                </form>
              ))}
            </div>
            <p className="text-sm leading-7 text-[var(--muted-foreground)]">
              Delete is soft by default. It hides the album while Supabase keeps
              metadata and Cloudinary keeps the media recoverable for at least
              30 days.
            </p>
          </div>

          <GalleryAlbumBulkUploadPanel
            albumId={typedAlbum.id}
            cloudName={publicConfig?.cloudName || ""}
            configured={configured}
            defaultFolder={defaultFolder}
          />

          <GalleryAlbumReorderPanel
            action={reorderGalleryAlbumItems}
            albumId={typedAlbum.id}
            items={activeItems.map((item) => ({
              id: item.id,
              title: item.title || item.media_assets?.title || item.media_assets?.public_id || "Gallery image",
            }))}
          />
        </div>

        <section className="grid gap-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="admin-section-label">Images</p>
              <h2 className="admin-card-row__title">
                {activeItems.length} active · {deletedItems.length} removed
              </h2>
              {items.length ? (
                <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
                  Showing {firstVisibleItem}-{lastVisibleItem} of {items.length}{" "}
                  image record(s).
                </p>
              ) : null}
            </div>
          </div>

          <form action={bulkUpdateGalleryAlbumItems} className="admin-review-card grid gap-4">
            <input name="albumId" type="hidden" value={typedAlbum.id} />
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <label className="input-label">
                Bulk action
                <select defaultValue="archive" name="intent">
                  <option value="publish">Publish selected</option>
                  <option value="archive">Archive selected</option>
                  <option value="restore">Restore selected</option>
                  <option value="remove">Remove from album</option>
                  <option value="delete">Soft-delete item records</option>
                </select>
              </label>
              <div className="flex items-end">
                <button className="admin-btn admin-btn--primary w-full" type="submit">
                  Apply to selected
                </button>
              </div>
            </div>

            <div className="grid gap-4">
              {visibleItems.map((item) => {
                const secureUrl = item.media_assets?.secure_url;
                const imageUrl = secureUrl
                  ? transformCloudinaryUrl(secureUrl, "detailGrid")
                  : "";

                return (
                  <article className="grid gap-4 rounded-[1.35rem] border border-[var(--line)] bg-[var(--background)] p-4 lg:grid-cols-[10rem_1fr]" key={item.id}>
                    <label className="relative min-h-36 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--muted)]">
                      <input className="absolute left-3 top-3 z-10 h-5 w-5" name="itemIds" type="checkbox" value={item.id} />
                      {imageUrl ? (
                        <Image
                          alt={item.alt_text || item.title || ""}
                          className="object-cover"
                          fill
                          sizes="10rem"
                          src={imageUrl}
                        />
                      ) : null}
                    </label>
                    <div className="grid gap-3">
                      <div className="flex flex-wrap gap-2">
                        <span className={`abadge abadge--${item.status === "published" ? "published" : "draft"}`}>
                          {item.deleted_at ? "removed" : item.status}
                        </span>
                        {item.is_cover ? <span className="abadge abadge--info">Cover</span> : null}
                        <span className="abadge">Sort {item.sort_order}</span>
                      </div>
                      <div className="grid gap-3 rounded-2xl border border-[var(--line)] p-3">
                        <input name="albumId" type="hidden" value={typedAlbum.id} form={`item-${item.id}`} />
                        <input name="itemId" type="hidden" value={item.id} form={`item-${item.id}`} />
                        <div className="grid gap-3 md:grid-cols-2">
                          <label className="input-label">
                            Title
                            <input defaultValue={item.title || ""} form={`item-${item.id}`} name="title" />
                          </label>
                          <label className="input-label">
                            Alt text
                            <input defaultValue={item.alt_text || ""} form={`item-${item.id}`} name="altText" />
                          </label>
                        </div>
                        <label className="input-label">
                          Description
                          <textarea defaultValue={item.description || item.source_caption || ""} form={`item-${item.id}`} name="description" rows={2} />
                        </label>
                        <div className="grid gap-3 sm:grid-cols-4">
                          <label className="input-label">
                            Sort
                            <input defaultValue={item.sort_order} form={`item-${item.id}`} name="sortOrder" type="number" />
                          </label>
                          <label className="input-label">
                            Status
                            <select defaultValue={item.status} form={`item-${item.id}`} name="status">
                              <option value="draft">Draft</option>
                              <option value="published">Published</option>
                              <option value="archived">Archived</option>
                            </select>
                          </label>
                          <label className="input-label">
                            Cover
                            <select defaultValue={item.is_cover ? "true" : "false"} form={`item-${item.id}`} name="isCover">
                              <option value="false">No</option>
                              <option value="true">Yes</option>
                            </select>
                          </label>
                          <div className="flex items-end">
                            <button className="admin-btn admin-btn--ghost w-full" form={`item-${item.id}`} type="submit">
                              Save
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {totalItemPages > 1 ? (
              <nav
                aria-label="Album image editor pages"
                className="flex flex-wrap items-center justify-center gap-2"
              >
                {currentItemPage > 1 ? (
                  <Link
                    className="admin-btn admin-btn--ghost"
                    href={buildAlbumEditorPageHref(albumId, currentItemPage - 1)}
                  >
                    Previous
                  </Link>
                ) : (
                  <span className="admin-btn admin-btn--ghost pointer-events-none opacity-50">
                    Previous
                  </span>
                )}

                {itemPageNumbers.map((pageNumber) => (
                  <Link
                    aria-current={
                      pageNumber === currentItemPage ? "page" : undefined
                    }
                    className={`admin-btn ${
                      pageNumber === currentItemPage
                        ? "admin-btn--primary"
                        : "admin-btn--ghost"
                    }`}
                    href={buildAlbumEditorPageHref(albumId, pageNumber)}
                    key={pageNumber}
                  >
                    {pageNumber}
                  </Link>
                ))}

                {currentItemPage < totalItemPages ? (
                  <Link
                    className="admin-btn admin-btn--ghost"
                    href={buildAlbumEditorPageHref(albumId, currentItemPage + 1)}
                  >
                    Next
                  </Link>
                ) : (
                  <span className="admin-btn admin-btn--ghost pointer-events-none opacity-50">
                    Next
                  </span>
                )}
              </nav>
            ) : null}
          </form>

          {visibleItems.map((item) => (
            <form action={saveGalleryAlbumItem} id={`item-${item.id}`} key={`form-${item.id}`} />
          ))}
        </section>
      </section>
    </div>
  );
}
