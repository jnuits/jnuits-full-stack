import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Image as ImageIcon } from "lucide-react";
import { GalleryDescriptionToggle } from "@/components/gallery/gallery-description-toggle";
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
              <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                <Link
                  className="inline-flex items-center gap-2 rounded-full py-1 text-sm font-semibold text-[var(--muted-foreground)] transition hover:-translate-x-0.5 hover:text-[var(--primary)]"
                  href="/gallery"
                >
                  <ArrowLeft aria-hidden="true" size={16} strokeWidth={2.25} />
                  Back to gallery
                </Link>
                <span className="eyebrow inline-flex">
                  {album.year} · {toLabel(album.category)}
                </span>
              </div>
              <h1 className="section-title mt-4">{album.title}</h1>
              <GalleryDescriptionToggle
                text={album.description || album.eventName}
              />
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
                unoptimized
              />
            ) : (
              <div className="grid h-full place-items-center p-6 text-center text-[var(--muted-foreground)]">
                <div className="grid justify-items-center gap-3">
                  <ImageIcon size={36} />
                  <span className="text-xs font-bold uppercase tracking-[0.2em]">
                    Cover image pending
                  </span>
                </div>
              </div>
            )}
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
