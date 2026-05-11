"use client";

import Image from "next/image";
import Lightbox, { type Slide } from "yet-another-react-lightbox";
import Captions from "yet-another-react-lightbox/plugins/captions";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { GalleryImage } from "@/lib/content/gallery";

type GalleryLoadMoreProps = {
  albumTitle: string;
  albumSlug: string;
  initialItems: GalleryImage[];
  initialNextCursor: string | null;
};

type GalleryPageResponse = {
  items: GalleryImage[];
  nextCursor: string | null;
};

const LIGHTBOX_PLUGINS = [Captions] as const;

function cleanText(value: string | null | undefined) {
  const trimmed = value?.replace(/\s+/g, " ").trim();

  return trimmed ? trimmed : "";
}

function normalizeText(value: string | null | undefined) {
  return cleanText(value).toLowerCase();
}

function countRepeatedText(items: GalleryImage[], selector: (item: GalleryImage) => string) {
  const counts = new Map<string, number>();

  for (const item of items) {
    const normalized = normalizeText(selector(item));

    if (normalized.length < 12) {
      continue;
    }

    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  }

  return counts;
}

function getDisplayCaption(
  item: GalleryImage,
  index: number,
  titleCounts: Map<string, number>,
  descriptionCounts: Map<string, number>
) {
  const title = cleanText(item.title);
  const description = cleanText(item.description);
  const normalizedTitle = normalizeText(title);
  const normalizedDescription = normalizeText(description);
  const isRepeatedTitle = (titleCounts.get(normalizedTitle) || 0) > 1;
  const isRepeatedDescription =
    (descriptionCounts.get(normalizedDescription) || 0) > 1;
  const displayTitle =
    title && title.length <= 80 && !isRepeatedTitle
      ? title
      : `Photo ${String(index + 1).padStart(2, "0")}`;
  const displayDescription =
    description &&
    description.length <= 140 &&
    normalizedDescription !== normalizedTitle &&
    !isRepeatedDescription
      ? description
      : "";

  return {
    description: displayDescription,
    title: displayTitle,
  };
}

export function GalleryLoadMore({
  albumTitle,
  albumSlug,
  initialItems,
  initialNextCursor,
}: GalleryLoadMoreProps) {
  const [items, setItems] = useState(initialItems);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const requestInFlight = useRef(false);
  const visibleItems = useMemo(() => {
    const titleCounts = countRepeatedText(items, (item) => item.title);
    const descriptionCounts = countRepeatedText(items, (item) => item.description);

    return items.map((item, index) => ({
      ...item,
      displayCaption: getDisplayCaption(
        item,
        index,
        titleCounts,
        descriptionCounts
      ),
    }));
  }, [items]);
  const lightboxSlides = useMemo<Slide[]>(
    () =>
      visibleItems.map((item, index) => ({
        alt: item.altText,
        description: item.displayCaption.description || undefined,
        height: item.height,
        src: item.fullUrl,
        title: `${albumTitle} - Photo ${index + 1}`,
        width: item.width,
      })),
    [albumTitle, visibleItems]
  );

  const loadMore = useCallback(async () => {
    if (!nextCursor || requestInFlight.current) {
      return;
    }

    requestInFlight.current = true;
    setPending(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        cursor: nextCursor,
        limit: "20",
      });
      const response = await fetch(
        `/api/gallery/albums/${albumSlug}/items?${params.toString()}`,
        {
          headers: {
            Accept: "application/json",
          },
        }
      );
      const payload = (await response.json().catch(() => null)) as
        | GalleryPageResponse
        | { message?: string }
        | null;

      if (!response.ok || !payload || !("items" in payload)) {
        throw new Error(
          payload && "message" in payload && payload.message
            ? payload.message
            : "Unable to load more gallery photos."
        );
      }

      setItems((current) => [...current, ...payload.items]);
      setNextCursor(payload.nextCursor);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load more gallery photos."
      );
    } finally {
      requestInFlight.current = false;
      setPending(false);
    }
  }, [albumSlug, nextCursor]);

  useEffect(() => {
    const node = sentinelRef.current;

    if (!node || !nextCursor || !("IntersectionObserver" in window)) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          startTransition(() => {
            void loadMore();
          });
        }
      },
      {
        rootMargin: "600px 0px",
      }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [loadMore, nextCursor]);

  return (
    <div className="grid gap-8">
      <div className="gallery-masonry">
        {visibleItems.map((item, index) => (
          <figure
            className="gallery-masonry__item group overflow-hidden rounded-[1.45rem] border border-[var(--line)] bg-[var(--card)] shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
            key={item.id}
          >
            <button
              aria-label={`Open ${item.displayCaption.title} from ${albumTitle}`}
              className="gallery-masonry__trigger relative block w-full overflow-hidden bg-[var(--muted)] text-left"
              onClick={() => setActiveIndex(index)}
              type="button"
            >
              <Image
                alt={item.altText}
                blurDataURL={item.blurDataURL || undefined}
                className="h-auto w-full object-cover transition duration-700 group-hover:scale-[1.025]"
                height={item.height}
                loading={index < 6 ? "eager" : "lazy"}
                placeholder={item.blurDataURL ? "blur" : "empty"}
                sizes="(min-width: 1024px) 31vw, (min-width: 640px) 47vw, 100vw"
                src={item.thumbnailUrl}
                unoptimized
                width={item.width}
              />
              <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/55 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-white opacity-0 backdrop-blur transition duration-300 group-hover:opacity-100">
                View photo
              </span>
            </button>
            <figcaption className="grid gap-2 px-4 py-4">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {item.displayCaption.title}
              </p>
              {item.displayCaption.description ? (
                <p className="line-clamp-2 text-xs leading-6 text-[var(--muted-foreground)]">
                  {item.displayCaption.description}
                </p>
              ) : null}
            </figcaption>
          </figure>
        ))}
      </div>

      <Lightbox
        captions={{
          descriptionMaxLines: 2,
          descriptionTextAlign: "center",
        }}
        carousel={{
          imageFit: "contain",
          padding: "16px",
          preload: 2,
        }}
        className="jnuits-gallery-lightbox"
        close={() => setActiveIndex(null)}
        controller={{ closeOnBackdropClick: true }}
        index={activeIndex ?? 0}
        open={activeIndex !== null}
        plugins={LIGHTBOX_PLUGINS}
        slides={lightboxSlides}
      />

      <div ref={sentinelRef} />

      {error ? (
        <p className="rounded-full border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200">
          {error}
        </p>
      ) : null}

      {nextCursor ? (
        <div className="flex justify-center">
          <button
            className="primary-button"
            disabled={pending}
            onClick={() =>
              startTransition(() => {
                void loadMore();
              })
            }
            type="button"
          >
            {pending ? "Loading photos..." : "Load more photos"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
