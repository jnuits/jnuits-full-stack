import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GalleryLoadMore } from "@/components/gallery/gallery-load-more";
import { getGalleryAlbumBySlug } from "@/lib/content/gallery";

function toLabel(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDateRange(startsOn: string | null, endsOn: string | null, year: number) {
  if (!startsOn) {
    return String(year);
  }

  const formatter = new Intl.DateTimeFormat("en-BD", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const start = formatter.format(new Date(startsOn));

  if (!endsOn || endsOn === startsOn) {
    return start;
  }

  return `${start} - ${formatter.format(new Date(endsOn))}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ identifier: string }>;
}) {
  const { identifier } = await params;
  const album = await getGalleryAlbumBySlug(identifier);

  if (!album) {
    return {
      title: "Gallery album not found | JnUITS",
    };
  }

  return {
    title: `${album.title} | Gallery | JnUITS`,
    description:
      album.description ||
      `Photos from ${album.eventName}, preserved in the JnUITS gallery archive.`,
  };
}

export default async function GalleryDetailPage({
  params,
}: {
  params: Promise<{ identifier: string }>;
}) {
  const { identifier } = await params;
  const album = await getGalleryAlbumBySlug(identifier);

  if (!album) {
    notFound();
  }

  return (
    <div className="shell py-10 sm:py-12">
      <article className="overflow-hidden rounded-[2rem] border border-[var(--line)] bg-[var(--card)] shadow-2xl">
        <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="grid content-between gap-8 p-6 sm:p-8">
            <div>
              <Link className="queue-link" href="/gallery">
                Back to gallery
              </Link>
              <span className="eyebrow mt-8 inline-flex">
                {album.year} · {toLabel(album.category)}
              </span>
              <h1 className="section-title mt-4">{album.title}</h1>
              <p className="section-copy mt-5">
                {album.description || album.eventName}
              </p>
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--background)] p-4">
                <dt className="text-[var(--muted-foreground)]">Event</dt>
                <dd className="mt-1 font-semibold">{album.eventName}</dd>
              </div>
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--background)] p-4">
                <dt className="text-[var(--muted-foreground)]">Date</dt>
                <dd className="mt-1 font-semibold">
                  {formatDateRange(album.startsOn, album.endsOn, album.year)}
                </dd>
              </div>
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--background)] p-4">
                <dt className="text-[var(--muted-foreground)]">Photos</dt>
                <dd className="mt-1 font-semibold">{album.itemCount}</dd>
              </div>
            </dl>
          </div>

          <div className="relative min-h-[360px] overflow-hidden bg-[var(--muted)] lg:min-h-[560px]">
            {album.cover ? (
              <Image
                alt={album.cover.altText}
                blurDataURL={album.cover.blurDataURL || undefined}
                className="object-cover"
                fill
                placeholder={album.cover.blurDataURL ? "blur" : "empty"}
                priority
                sizes="(min-width: 1024px) 52vw, 100vw"
                src={album.cover.fullUrl}
              />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          </div>
        </div>
      </article>

      <section className="mt-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="section-divider">Album photos</p>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,4vw,3.5rem)] leading-none tracking-[-0.05em]">
              Browse this album
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-7 text-[var(--muted-foreground)]">
            Photos stay visual-first. Short unique titles or descriptions appear
            only when they add context; repeated Facebook captions are replaced
            with clean image titles.
          </p>
        </div>

        <GalleryLoadMore
          albumTitle={album.title}
          albumSlug={album.slug}
          initialItems={album.items}
          initialNextCursor={album.nextCursor}
        />
      </section>
    </div>
  );
}
