import Image from "next/image";
import Link from "next/link";
import { Image as ImageIcon } from "lucide-react";
import { GalleryArchiveFilters } from "@/components/gallery/gallery-archive-filters";
import {
  getGalleryAlbums,
  getGalleryFilterOptions,
} from "@/lib/content/gallery";

export const metadata = {
  title: "Gallery | JnUITS",
  description:
    "Explore Jagannath University IT Society event albums, tours, competitions, workshops, and community activities.",
};

const ALBUMS_PER_PAGE = 12;

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

function buildGalleryPageHref({
  category,
  page,
  query,
  year,
}: {
  category: string;
  page: number;
  query: string;
  year: string;
}) {
  const params = new URLSearchParams();

  if (query) {
    params.set("q", query);
  }

  if (year) {
    params.set("year", year);
  }

  if (category) {
    params.set("category", category);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const queryString = params.toString();

  return queryString ? `/gallery?${queryString}` : "/gallery";
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

function AlbumCoverFallback({ title }: { title: string }) {
  return (
    <div className="grid h-full min-h-full place-items-center bg-[var(--muted)] p-5 text-center">
      <div className="grid justify-items-center gap-2 text-[var(--muted-foreground)]">
        <ImageIcon size={24} />
        <span className="text-xs font-bold uppercase tracking-[0.18em]">
          {title}
        </span>
      </div>
    </div>
  );
}

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";
  const year = typeof params.year === "string" ? params.year : "";
  const category = typeof params.category === "string" ? params.category : "";
  const requestedPage = parsePage(params.page);
  const [albums, filters] = await Promise.all([
    getGalleryAlbums({ category, query, year }),
    getGalleryFilterOptions(),
  ]);
  const featuredAlbums = albums.filter((album) => album.featured).slice(0, 3);
  const heroAlbums = (featuredAlbums.length ? featuredAlbums : albums).slice(0, 3);
  const totalImages = albums.reduce((sum, album) => sum + album.itemCount, 0);
  const totalPages = Math.max(1, Math.ceil(albums.length / ALBUMS_PER_PAGE));
  const currentPage = Math.min(requestedPage, totalPages);
  const albumStart = (currentPage - 1) * ALBUMS_PER_PAGE;
  const paginatedAlbums = albums.slice(
    albumStart,
    albumStart + ALBUMS_PER_PAGE
  );
  const firstVisibleAlbum = albums.length ? albumStart + 1 : 0;
  const lastVisibleAlbum = Math.min(
    albumStart + paginatedAlbums.length,
    albums.length
  );
  const pageNumbers = buildPageNumbers(currentPage, totalPages);

  return (
    <div className="shell py-10 sm:py-12">
      <section className="grid gap-8 overflow-hidden rounded-[2rem] border border-[var(--line)] bg-[var(--card)] p-5 shadow-2xl sm:p-7 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
        <div className="grid gap-6">
          <div>
            <span className="eyebrow">JnUITS gallery archive</span>
            <h1 className="section-title mt-4">
              Event albums, campus moments, and society memories by year.
            </h1>
            <p className="section-copy mt-5">
              Browse offline programs, tours, competitions, workshops, prize
              giving events, and member activities preserved from the JnUITS
              public archive.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--background)] p-4">
              <p className="text-2xl font-semibold">{albums.length}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                Albums
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--background)] p-4">
              <p className="text-2xl font-semibold">{totalImages}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                Photos
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--background)] p-4">
              <p className="text-2xl font-semibold">{filters.years.length}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                Years
              </p>
            </div>
          </div>
        </div>

        {heroAlbums.length ? (
          <div className="grid min-h-[320px] gap-3 sm:grid-cols-[1.1fr_0.9fr]">
            {heroAlbums.map((album, index) => (
              <Link
                className={`group relative overflow-hidden rounded-[1.5rem] border border-[var(--line)] bg-[var(--muted)] ${
                  index === 0 ? "min-h-[320px] sm:row-span-2" : "min-h-[152px]"
                }`}
                href={`/gallery/${album.slug}`}
                key={album.id}
              >
                {album.cover ? (
                  <Image
                    alt={album.cover.altText}
                    blurDataURL={album.cover.blurDataURL || undefined}
                    className="object-cover transition duration-700 group-hover:scale-105"
                    fill
                    placeholder={album.cover.blurDataURL ? "blur" : "empty"}
                    priority={index === 0}
                    sizes={index === 0 ? "(min-width: 1024px) 48vw, 100vw" : "(min-width: 1024px) 24vw, 100vw"}
                    src={album.cover.thumbnailUrl}
                    unoptimized
                  />
                ) : (
                  <AlbumCoverFallback title={album.title} />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/70">
                    {album.year} · {toLabel(album.category)}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold leading-tight">
                    {album.title}
                  </h2>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="grid min-h-[320px] place-items-center rounded-[1.5rem] border border-dashed border-[var(--line)] bg-[var(--background)] p-6 text-center">
            <div className="max-w-sm">
              <p className="section-divider">Import pending</p>
              <h2 className="mt-4 text-2xl font-semibold tracking-[-0.03em]">
                Historical gallery albums are being prepared.
              </h2>
              <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
                Once the operator import finishes, this area will show JnUITS
                event albums, tours, workshops, competitions, and campus photos.
              </p>
            </div>
          </div>
        )}
      </section>

      <GalleryArchiveFilters
        categories={filters.categories}
        category={category}
        key={`${query}:${year}:${category}`}
        query={query}
        year={year}
        years={filters.years}
      />

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="section-divider">Albums</p>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,4vw,3.5rem)] leading-none tracking-[-0.05em]">
              {albums.length ? "Browse the archive" : "No albums found"}
            </h2>
            {albums.length ? (
              <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
                Showing {firstVisibleAlbum}-{lastVisibleAlbum} of{" "}
                {albums.length} albums.
              </p>
            ) : null}
          </div>
          {(query || year || category) && (
            <Link className="secondary-button" href="/gallery">
              Clear filters
            </Link>
          )}
        </div>

        {albums.length ? (
          <>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {paginatedAlbums.map((album) => (
                <Link
                  className="gallery-album-card group overflow-hidden rounded-[1.5rem] border border-[var(--line)] bg-[var(--card)] shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
                  href={`/gallery/${album.slug}`}
                  key={album.id}
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-[var(--muted)]">
                    {album.cover ? (
                      <Image
                        alt={album.cover.altText}
                        blurDataURL={album.cover.blurDataURL || undefined}
                        className="object-cover transition duration-700 group-hover:scale-105"
                        fill
                        placeholder={album.cover.blurDataURL ? "blur" : "empty"}
                        sizes="(min-width: 1280px) 30vw, (min-width: 640px) 45vw, 100vw"
                        src={album.cover.thumbnailUrl}
                        unoptimized
                      />
                    ) : (
                      <AlbumCoverFallback title={album.title} />
                    )}
                  </div>
                  <div className="grid gap-3 p-5">
                    <div className="flex flex-wrap gap-2">
                      <span className="status-pill">{album.year}</span>
                      <span className="status-pill">
                        {toLabel(album.category)}
                      </span>
                      <span className="status-pill">
                        {album.itemCount} photos
                      </span>
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold leading-tight text-[var(--foreground)]">
                        {album.title}
                      </h3>
                      <p className="gallery-album-card__description mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                        {album.description || album.eventName}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {totalPages > 1 ? (
              <nav
                aria-label="Gallery album pages"
                className="mt-8 flex flex-wrap items-center justify-center gap-2"
              >
                {currentPage > 1 ? (
                  <Link
                    className="secondary-button"
                    href={buildGalleryPageHref({
                      category,
                      page: currentPage - 1,
                      query,
                      year,
                    })}
                  >
                    Previous
                  </Link>
                ) : (
                  <span className="secondary-button pointer-events-none opacity-50">
                    Previous
                  </span>
                )}

                {pageNumbers.map((pageNumber) => (
                  <Link
                    aria-current={
                      pageNumber === currentPage ? "page" : undefined
                    }
                    className={`gallery-page-number ${
                      pageNumber === currentPage ? "primary-button" : "secondary-button"
                    }`}
                    href={buildGalleryPageHref({
                      category,
                      page: pageNumber,
                      query,
                      year,
                    })}
                    key={pageNumber}
                  >
                    {pageNumber}
                  </Link>
                ))}

                {currentPage < totalPages ? (
                  <Link
                    className="secondary-button"
                    href={buildGalleryPageHref({
                      category,
                      page: currentPage + 1,
                      query,
                      year,
                    })}
                  >
                    Next
                  </Link>
                ) : (
                  <span className="secondary-button pointer-events-none opacity-50">
                    Next
                  </span>
                )}
              </nav>
            ) : null}
          </>
        ) : (
          <div className="empty-state mt-6">
            No published gallery albums are available yet. The archive will
            appear here after the Supabase gallery migration and import finish.
          </div>
        )}
      </section>
    </div>
  );
}
