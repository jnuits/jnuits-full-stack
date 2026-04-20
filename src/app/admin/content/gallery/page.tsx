import Link from "next/link";
import { cookies } from "next/headers";
import {
  AlertTriangle,
  Image as ImageIcon,
  Plus,
} from "lucide-react";
import { GalleryAlbumCreateFlow } from "@/components/admin/gallery-album-create-flow";
import { GalleryAlbumFilters } from "@/components/admin/gallery-album-filters";
import {
  AdminGalleryAlbumListItem,
  type AdminGalleryAlbumListItemAlbum,
} from "@/components/admin/gallery-album-list-item";
import { ADMIN_FLASH_COOKIE_NAME, parseAdminFlash } from "@/lib/admin/flash";
import {
  getCloudinaryPublicConfig,
  isCloudinaryConfigured,
} from "@/lib/cloudinary/config";
import { getSeedGalleryAdminData } from "@/lib/content/gallery-seed";
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
  updated_at: string;
  year: number;
};

type ItemRow = {
  album_id: string;
  id: string;
  is_cover: boolean;
  sort_order: number;
  status: string;
  media_assets?: {
    secure_url: string;
  } | null;
};

export const metadata = { title: "Gallery Albums — Admin | JnUITS" };

const ADMIN_ALBUMS_PER_PAGE = 12;
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

function parsePage(value: string | string[] | undefined) {
  if (typeof value !== "string") {
    return 1;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function buildAdminGalleryPageHref({
  page,
  query,
  status,
  year,
}: {
  page: number;
  query: string;
  status: string;
  year: string;
}) {
  const params = new URLSearchParams();

  if (query) {
    params.set("q", query);
  }

  if (status) {
    params.set("status", status);
  }

  if (year) {
    params.set("year", year);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const queryString = params.toString();

  return queryString
    ? `/admin/content/gallery?${queryString}`
    : "/admin/content/gallery";
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

function firstRecord<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value || null;
}

function getMediaSecureUrl(item: ItemRow | undefined) {
  const media = firstRecord(item?.media_assets);

  return media?.secure_url || "";
}

export default async function GalleryAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = createAdminClient();
  const cookieStore = await cookies();
  const flash = parseAdminFlash(cookieStore.get(ADMIN_FLASH_COOKIE_NAME)?.value);
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.toLowerCase().trim() : "";
  const status = typeof params.status === "string" ? params.status : "";
  const year = typeof params.year === "string" ? params.year : "";
  const requestedPage = parsePage(params.page);

  const [albumResult, seedData] = await Promise.all([
    admin
      .from("gallery_albums")
      .select(
        "id, slug, title, event_name, description, year, month, starts_on, ends_on, category, status, featured, cover_item_id, cloudinary_folder, deleted_at, updated_at"
      )
      .order("year", { ascending: false })
      .order("month", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false })
      .limit(1000),
    getSeedGalleryAdminData(),
  ]);
  const albumData = albumResult.data || [];
  const seedPreviewMode = Boolean(albumResult.error);
  const albums = (
    seedPreviewMode ? seedData.albums : albumData
  ) as AlbumRow[];
  const albumIds = albums.map((album) => album.id);
  const itemResult =
    seedPreviewMode || !albumIds.length
      ? { data: seedPreviewMode ? seedData.items : [] }
      : await admin
          .from("gallery_album_items")
          .select("id, album_id, is_cover, sort_order, status, media_assets(secure_url)")
          .in("album_id", albumIds)
          .is("deleted_at", null)
          .order("sort_order", { ascending: true })
          .order("id", { ascending: true });
  const items = (itemResult.data || []) as ItemRow[];
  const itemCountByAlbum = new Map<string, number>();
  const itemsByAlbum = new Map<string, ItemRow[]>();
  const coverByAlbum = new Map<string, string>();

  for (const item of items) {
    itemCountByAlbum.set(item.album_id, (itemCountByAlbum.get(item.album_id) || 0) + 1);

    if (!itemsByAlbum.has(item.album_id)) {
      itemsByAlbum.set(item.album_id, []);
    }

    itemsByAlbum.get(item.album_id)?.push(item);
  }

  for (const album of albums) {
    const albumItems = itemsByAlbum.get(album.id) || [];
    const coverItem =
      albumItems.find((item) => item.id === album.cover_item_id) ||
      albumItems.find((item) => item.is_cover) ||
      albumItems.find((item) => item.status === "published") ||
      albumItems[0];
    const coverUrl = getMediaSecureUrl(coverItem);

    if (coverUrl) {
      coverByAlbum.set(album.id, coverUrl);
    }
  }

  const years = Array.from(new Set(albums.map((album) => album.year))).sort(
    (left, right) => right - left
  );
  const cloudinaryConfigured = isCloudinaryConfigured();
  const cloudinaryPublicConfig = cloudinaryConfigured
    ? getCloudinaryPublicConfig()
    : null;
  const now = new Date();
  const filteredAlbums = albums.filter((album) => {
    if (status && album.status !== status) {
      return false;
    }

    if (year && String(album.year) !== year) {
      return false;
    }

    if (!query) {
      return true;
    }

    return `${album.title} ${album.description || ""} ${album.category} ${album.slug}`
      .toLowerCase()
      .includes(query);
  });
  const totalPages = Math.max(
    1,
    Math.ceil(filteredAlbums.length / ADMIN_ALBUMS_PER_PAGE)
  );
  const currentPage = Math.min(requestedPage, totalPages);
  const albumStart = (currentPage - 1) * ADMIN_ALBUMS_PER_PAGE;
  const paginatedAlbums = filteredAlbums.slice(
    albumStart,
    albumStart + ADMIN_ALBUMS_PER_PAGE
  );
  const firstVisibleAlbum = filteredAlbums.length ? albumStart + 1 : 0;
  const lastVisibleAlbum = Math.min(
    albumStart + paginatedAlbums.length,
    filteredAlbums.length
  );
  const pageNumbers = buildPageNumbers(currentPage, totalPages);

  return (
    <div className="admin-gallery-workspace grid gap-7">
      <div className="admin-page-header admin-gallery-header">
        <div className="admin-gallery-header__copy">
          <p className="admin-page-header__breadcrumb">Admin / Content</p>
          <h1 className="admin-page-header__title">Gallery albums</h1>
          <p className="admin-page-header__desc">
            Album-first workspace for public gallery import, publishing,
            metadata, soft deletion, and Cloudinary-backed media operations.
          </p>
        </div>
        <div className="admin-gallery-header__actions">
          <span className={`abadge ${seedPreviewMode ? "abadge--draft" : "abadge--info"}`}>
            {seedPreviewMode ? "Seed preview" : `${albums.length} albums`}
          </span>
          <details className="admin-gallery-create-menu">
            <summary className="admin-btn admin-btn--primary">
              <Plus aria-hidden="true" size={15} />
              New album
            </summary>
            <div className="admin-gallery-create-menu__panel">
              <GalleryAlbumCreateFlow
                categories={GALLERY_CATEGORIES}
                cloudName={cloudinaryPublicConfig?.cloudName || ""}
                cloudinaryConfigured={cloudinaryConfigured}
                defaultMonth={now.getMonth() + 1}
                defaultYear={now.getFullYear()}
                disabled={seedPreviewMode}
              />
              {seedPreviewMode ? (
                <p className="text-sm leading-7 text-[var(--muted-foreground)]">
                  The workflow is ready, but saving is disabled because{" "}
                  <code>gallery_albums</code> does not exist in Supabase yet.
                </p>
              ) : null}
            </div>
          </details>
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

      {seedPreviewMode && (
        <section className="flash-panel" data-tone={albumResult.error ? "error" : "success"}>
          <div className="flex flex-wrap items-start gap-4">
            <div className="admin-metric-card__icon">
              <AlertTriangle size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="admin-section-label">
                {albumResult.error ? "Database schema missing" : "Seed preview mode"}
              </p>
              <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold">
                Showing the sanitized gallery seed until Supabase import is complete.
              </h2>
              {albumResult.error ? (
                <p className="mt-2 text-sm leading-7">
                  Supabase returned: {albumResult.error.message}
                </p>
              ) : null}
              <div className="mt-5 grid gap-3 rounded-2xl border border-[var(--line)] bg-[var(--background)] p-4 text-sm leading-7">
                <p>
                  Preview source: <code>plan/data/jnuits-gallery-seed.json</code>{" "}
                  with {seedData.summary.albumCount || albums.length} albums,{" "}
                  {seedData.summary.albumItemCount || items.length} linked photos,
                  and {seedData.summary.mediaAssetCount || 0} Cloudinary media assets.
                </p>
                <p>
                  Write operations remain disabled in preview mode. Apply{" "}
                  <code>supabase/migrations/20260420000000_gallery_album_rebuild.sql</code>{" "}
                  and run <code>npm run gallery:import -- --apply</code> to enable
                  full album editing. The CRUD controls below are shown for
                  workflow review, but submit actions stay disabled until the
                  Supabase metadata tables exist.
                </p>
                <p>
                  Gallery images are not stored in Supabase. Images remain in
                  Cloudinary; Supabase stores album records, image metadata, and
                  album-item links only.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="admin-metric-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(11rem, 1fr))" }}>
        <div className="admin-metric-card" data-tone="info">
          <div className="admin-metric-card__icon">
            <ImageIcon size={16} />
          </div>
          <p className="admin-metric-card__label">Total albums</p>
          <p className="admin-metric-card__value">{albums.length}</p>
          <p className="admin-metric-card__sub">All statuses</p>
        </div>
        <div className="admin-metric-card" data-tone="success">
          <p className="admin-metric-card__label">Published</p>
          <p className="admin-metric-card__value">
            {albums.filter((album) => album.status === "published" && !album.deleted_at).length}
          </p>
          <p className="admin-metric-card__sub">Visible publicly</p>
        </div>
        <div className="admin-metric-card">
          <p className="admin-metric-card__label">Archived</p>
          <p className="admin-metric-card__value">
            {albums.filter((album) => album.status === "archived").length}
          </p>
          <p className="admin-metric-card__sub">Hidden from public</p>
        </div>
        <div className="admin-metric-card" data-tone="warning">
          <p className="admin-metric-card__label">Soft deleted</p>
          <p className="admin-metric-card__value">
            {albums.filter((album) => album.deleted_at).length}
          </p>
          <p className="admin-metric-card__sub">Recoverable metadata</p>
        </div>
      </div>

      <section className="grid gap-5">
        <GalleryAlbumFilters
          query={query}
          status={status}
          year={year}
          years={years}
        />

          <section className="grid gap-3">
            <p className="admin-section-label">Album queue</p>
            {!filteredAlbums.length ? (
              <div className="empty-state">
                No gallery albums match the current filters. If the schema is
                ready, use the create form to add a manual album or run{" "}
                <code>npm run gallery:import -- --apply</code> for the
                historical archive.
              </div>
            ) : null}
            {filteredAlbums.length ? (
              <p className="text-sm leading-6 text-[var(--muted-foreground)]">
                Showing {firstVisibleAlbum}-{lastVisibleAlbum} of{" "}
                {filteredAlbums.length} album(s).
              </p>
            ) : null}
            {paginatedAlbums.map((album) => {
              const coverUrl = coverByAlbum.get(album.id);

              return (
                <AdminGalleryAlbumListItem
                  album={album as AdminGalleryAlbumListItemAlbum}
                  coverUrl={coverUrl}
                  imageCount={itemCountByAlbum.get(album.id) || 0}
                  key={album.id}
                  seedPreviewMode={seedPreviewMode}
                />
              );
            })}
            {totalPages > 1 ? (
              <nav
                aria-label="Admin gallery album pages"
                className="mt-3 flex flex-wrap items-center justify-center gap-2"
              >
                {currentPage > 1 ? (
                  <Link
                    className="admin-btn admin-btn--ghost"
                    href={buildAdminGalleryPageHref({
                      page: currentPage - 1,
                      query,
                      status,
                      year,
                    })}
                  >
                    Previous
                  </Link>
                ) : (
                  <span className="admin-btn admin-btn--ghost pointer-events-none opacity-50">
                    Previous
                  </span>
                )}

                {pageNumbers.map((pageNumber) => (
                  <Link
                    aria-current={
                      pageNumber === currentPage ? "page" : undefined
                    }
                    className={`admin-btn ${
                      pageNumber === currentPage
                        ? "admin-btn--primary"
                        : "admin-btn--ghost"
                    }`}
                    href={buildAdminGalleryPageHref({
                      page: pageNumber,
                      query,
                      status,
                      year,
                    })}
                    key={pageNumber}
                  >
                    {pageNumber}
                  </Link>
                ))}

                {currentPage < totalPages ? (
                  <Link
                    className="admin-btn admin-btn--ghost"
                    href={buildAdminGalleryPageHref({
                      page: currentPage + 1,
                      query,
                      status,
                      year,
                    })}
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
          </section>
      </section>
    </div>
  );
}
