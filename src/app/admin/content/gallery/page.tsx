import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { AlertTriangle, Image as ImageIcon, Plus } from "lucide-react";
import { saveGalleryAlbum, updateGalleryAlbumLifecycle } from "@/app/admin/content/gallery/actions";
import { ADMIN_FLASH_COOKIE_NAME, parseAdminFlash } from "@/lib/admin/flash";
import { transformCloudinaryUrl } from "@/lib/cloudinary/urls";
import { getSeedGalleryAdminData } from "@/lib/content/gallery-seed";
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
  updated_at: string;
  year: number;
};

type ItemRow = {
  album_id: string;
  id: string;
  is_cover: boolean;
  media_assets?: {
    secure_url: string;
  } | null;
};

export const metadata = { title: "Gallery Albums — Admin | JnUITS" };

const ADMIN_ALBUMS_PER_PAGE = 20;

function toLabel(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

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

function formatAlbumDate(album: Pick<AlbumRow, "ends_on" | "starts_on" | "year">) {
  if (!album.starts_on) {
    return String(album.year);
  }

  const formatter = new Intl.DateTimeFormat("en-BD", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const start = formatter.format(new Date(album.starts_on));

  if (!album.ends_on || album.ends_on === album.starts_on) {
    return start;
  }

  return `${start} - ${formatter.format(new Date(album.ends_on))}`;
}

function AlbumCreateFields({ disabled = false }: { disabled?: boolean }) {
  return (
    <>
      <div>
        <p className="admin-section-label">Create album</p>
        <h2 className="admin-card-row__title">Manual album metadata</h2>
        <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
          Create late-uploaded event albums here. Images stay in Cloudinary;
          Supabase stores the album and media metadata only.
        </p>
      </div>
      <label className="input-label">
        Title
        <input
          disabled={disabled}
          name="title"
          placeholder="Inauguration & Fresher's Reception 2025"
          required
        />
      </label>
      <label className="input-label">
        Slug
        <input
          disabled={disabled}
          name="slug"
          placeholder="inauguration-fresher-reception-2025"
        />
      </label>
      <label className="input-label">
        Event name
        <input
          disabled={disabled}
          name="eventName"
          placeholder="Inauguration & Fresher's Reception 2025"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="input-label">
          Year
          <input disabled={disabled} min="2015" name="year" required type="number" />
        </label>
        <label className="input-label">
          Month
          <input disabled={disabled} max="12" min="1" name="month" type="number" />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="input-label">
          Start date
          <input disabled={disabled} name="startsOn" type="date" />
        </label>
        <label className="input-label">
          End date
          <input disabled={disabled} name="endsOn" type="date" />
        </label>
      </div>
      <label className="input-label">
        Category
        <select defaultValue="other-real-event" disabled={disabled} name="category">
          <option value="workshop-training">Workshop / Training</option>
          <option value="competition">Competition</option>
          <option value="ceremony-community">Ceremony / Community</option>
          <option value="tour">Tour</option>
          <option value="institutional">Institutional</option>
          <option value="member-outreach">Member Outreach</option>
          <option value="other-real-event">Other Real Event</option>
        </select>
      </label>
      <label className="input-label">
        Description
        <textarea
          disabled={disabled}
          name="description"
          placeholder="Short public album description"
          rows={3}
        />
      </label>
      <label className="input-label">
        Cloudinary folder
        <input
          disabled={disabled}
          name="cloudinaryFolder"
          placeholder="jnuits/jnuits-full-stack/gallery/YYYY/MM/album-slug"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="input-label">
          Status
          <select defaultValue="published" disabled={disabled} name="status">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label className="input-label">
          Featured
          <select defaultValue="false" disabled={disabled} name="featured">
            <option value="false">No</option>
            <option value="true">Yes</option>
          </select>
        </label>
      </div>
    </>
  );
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
        "id, slug, title, event_name, description, year, month, starts_on, ends_on, category, status, featured, cloudinary_folder, deleted_at, updated_at"
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
          .select("id, album_id, is_cover, media_assets(secure_url)")
          .in("album_id", albumIds)
          .is("deleted_at", null);
  const items = (itemResult.data || []) as ItemRow[];
  const itemCountByAlbum = new Map<string, number>();
  const coverByAlbum = new Map<string, string>();

  for (const item of items) {
    itemCountByAlbum.set(item.album_id, (itemCountByAlbum.get(item.album_id) || 0) + 1);

    if (item.is_cover && item.media_assets?.secure_url) {
      coverByAlbum.set(item.album_id, item.media_assets.secure_url);
    }
  }

  const years = Array.from(new Set(albums.map((album) => album.year))).sort(
    (left, right) => right - left
  );
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
    <div className="grid gap-8">
      <div className="admin-page-header">
        <div>
          <p className="admin-page-header__breadcrumb">Admin / Content</p>
          <h1 className="admin-page-header__title">Gallery albums</h1>
          <p className="admin-page-header__desc">
            Album-first workspace for public gallery import, publishing,
            metadata, soft deletion, and Cloudinary-backed media operations.
          </p>
        </div>
        <span className={`abadge ${seedPreviewMode ? "abadge--draft" : "abadge--info"}`}>
          {seedPreviewMode ? "Seed preview" : `${albums.length} albums`}
        </span>
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

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        {seedPreviewMode ? (
          <div className="admin-review-card grid gap-4">
            <AlbumCreateFields />
            <button
              className="admin-btn admin-btn--primary opacity-60"
              disabled
              type="button"
            >
              <Plus size={15} />
              Apply schema to enable create
            </button>
            <p className="text-sm leading-7 text-[var(--muted-foreground)]">
              This is the exact create-album workflow for late-uploaded
              content, including event month/year and description edits. The
              fields are visible for operator review, but the save action is
              disabled because <code>gallery_albums</code> does not exist in
              Supabase yet.
            </p>
          </div>
        ) : (
          <div className="admin-review-card">
            <form action={saveGalleryAlbum} className="grid gap-4">
              <AlbumCreateFields />
              <button className="admin-btn admin-btn--primary" type="submit">
                <Plus size={15} />
                Create album
              </button>
            </form>
          </div>
        )}

        <div className="grid gap-5">
          <section className="admin-review-card">
            <form action="/admin/content/gallery" className="grid gap-3 md:grid-cols-[1fr_10rem_10rem_auto]">
              <label className="input-label">
                Search
                <input defaultValue={typeof params.q === "string" ? params.q : ""} name="q" placeholder="Album title, category, or slug" />
              </label>
              <label className="input-label">
                Status
                <select defaultValue={status} name="status">
                  <option value="">All</option>
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <label className="input-label">
                Year
                <select defaultValue={year} name="year">
                  <option value="">All</option>
                  {years.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end">
                <button className="admin-btn admin-btn--primary w-full" type="submit">
                  Filter
                </button>
              </div>
            </form>
          </section>

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
                <article className="admin-card-row items-stretch" key={album.id}>
                  <div className="relative min-h-28 w-32 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--muted)]">
                    {coverUrl ? (
                      <Image
                        alt=""
                        className="object-cover"
                        fill
                        sizes="8rem"
                        src={transformCloudinaryUrl(coverUrl, "albumCard")}
                      />
                    ) : null}
                  </div>
                  <div className="admin-card-row__body">
                    <div className="flex flex-wrap gap-2">
                      <span className={`abadge abadge--${album.status === "published" ? "published" : "draft"}`}>
                        {album.deleted_at ? "deleted" : album.status}
                      </span>
                      <span className="abadge abadge--info">{album.year}</span>
                      <span className="abadge">{toLabel(album.category)}</span>
                      <span className="abadge">{itemCountByAlbum.get(album.id) || 0} images</span>
                      {album.featured ? <span className="abadge abadge--info">Featured</span> : null}
                    </div>
                    <h2 className="admin-card-row__title mt-3">{album.title}</h2>
                    <p className="admin-card-row__meta">
                      /gallery/{album.slug} · {formatAlbumDate(album)} · Updated {new Date(album.updated_at).toLocaleDateString("en-BD")}
                    </p>
                    <p className="admin-card-row__meta">
                      Event: {album.event_name || album.title}
                      {album.cloudinary_folder ? ` · Folder: ${album.cloudinary_folder}` : ""}
                    </p>
                    {album.description ? (
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--muted-foreground)]">
                        {album.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="admin-card-row__actions">
                    {seedPreviewMode ? (
                      <>
                        <span className="admin-btn admin-btn--ghost opacity-60" aria-disabled="true">
                          Edit metadata
                        </span>
                        <span className="admin-btn admin-btn--ghost opacity-60" aria-disabled="true">
                          Publish/archive
                        </span>
                        <span className="admin-btn admin-btn--ghost opacity-60" aria-disabled="true">
                          Soft delete
                        </span>
                      </>
                    ) : (
                      <Link className="admin-btn admin-btn--ghost" href={`/admin/content/gallery/${album.id}`}>
                        Open editor
                      </Link>
                    )}
                    <Link className="admin-btn admin-btn--ghost" href={`/gallery/${album.slug}`} target="_blank">
                      Public
                    </Link>
                    {seedPreviewMode ? null : (
                      <>
                        <form action={updateGalleryAlbumLifecycle}>
                          <input name="albumId" type="hidden" value={album.id} />
                          <input name="intent" type="hidden" value={album.status === "published" ? "archive" : "publish"} />
                          <button className="admin-btn admin-btn--ghost" type="submit">
                            {album.status === "published" ? "Archive" : "Publish"}
                          </button>
                        </form>
                        <form action={updateGalleryAlbumLifecycle}>
                          <input name="albumId" type="hidden" value={album.id} />
                          <input name="intent" type="hidden" value={album.deleted_at ? "restore" : "delete"} />
                          <button className="admin-btn admin-btn--ghost" type="submit">
                            {album.deleted_at ? "Restore" : "Soft delete"}
                          </button>
                        </form>
                      </>
                    )}
                  </div>
                </article>
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
        </div>
      </section>
    </div>
  );
}
