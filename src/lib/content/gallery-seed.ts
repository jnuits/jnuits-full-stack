import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";

import { transformCloudinaryUrl } from "@/lib/cloudinary/urls";
import type {
  GalleryAlbumDetail,
  GalleryAlbumFilters,
  GalleryAlbumSummary,
  GalleryFilterOptions,
  GalleryImage,
} from "@/lib/content/gallery";

const SEED_PATH = path.join(
  process.cwd(),
  "plan",
  "data",
  "jnuits-gallery-seed.json"
);
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 40;

type SeedMediaAsset = {
  altText?: string | null;
  height?: number | null;
  mediaKind?: string | null;
  publicId: string;
  secureUrl: string;
  thumbnailUrl?: string | null;
  title?: string | null;
  width?: number | null;
};

type SeedAlbumItem = {
  altText?: string | null;
  blurDataURL?: string | null;
  description?: string | null;
  height?: number | null;
  isCover?: boolean;
  mediaPublicId: string;
  sortOrder?: number | null;
  sourceCaption?: string | null;
  status?: string | null;
  title?: string | null;
  width?: number | null;
};

type SeedAlbum = {
  category: string;
  cloudinaryFolder?: string | null;
  description?: string | null;
  endDate?: string | null;
  eventName?: string | null;
  featured?: boolean;
  items?: SeedAlbumItem[];
  month?: number | null;
  slug: string;
  startDate?: string | null;
  status?: string | null;
  title: string;
  year: number;
};

type GallerySeed = {
  albums: SeedAlbum[];
  generatedAt?: string;
  mediaAssets: SeedMediaAsset[];
  summary?: {
    albumCount?: number;
    albumItemCount?: number;
    mediaAssetCount?: number;
  };
};

export type SeedAdminAlbumRow = {
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

export type SeedAdminItemRow = {
  album_id: string;
  id: string;
  is_cover: boolean;
  media_assets?: {
    secure_url: string;
  } | null;
};

function normalizeQuery(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function normalizeLimit(limit: number | null | undefined) {
  if (!Number.isFinite(limit || 0)) {
    return DEFAULT_LIMIT;
  }

  return Math.min(Math.max(Number(limit), 1), MAX_LIMIT);
}

function itemId(albumSlug: string, item: SeedAlbumItem) {
  return `seed-${albumSlug}-${item.sortOrder || 0}-${item.mediaPublicId}`
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .slice(0, 220);
}

function encodeCursor(item: Pick<GalleryImage, "id" | "sortOrder">) {
  return `${item.sortOrder}:${item.id}`;
}

function parseCursor(cursor: string | null | undefined) {
  if (!cursor) {
    return null;
  }

  const [sortOrder, id] = cursor.split(":");
  const parsedSortOrder = Number(sortOrder);

  if (!Number.isInteger(parsedSortOrder) || !id) {
    return null;
  }

  return {
    id,
    sortOrder: parsedSortOrder,
  };
}

const readGallerySeed = cache(async (): Promise<GallerySeed> => {
  try {
    const raw = await readFile(SEED_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<GallerySeed>;

    return {
      albums: Array.isArray(parsed.albums) ? parsed.albums : [],
      generatedAt: parsed.generatedAt,
      mediaAssets: Array.isArray(parsed.mediaAssets) ? parsed.mediaAssets : [],
      summary: parsed.summary,
    };
  } catch {
    return {
      albums: [],
      mediaAssets: [],
    };
  }
});

function mediaMap(seed: GallerySeed) {
  return new Map(seed.mediaAssets.map((asset) => [asset.publicId, asset]));
}

function mapSeedImage(
  albumSlug: string,
  item: SeedAlbumItem,
  media: SeedMediaAsset | undefined
): GalleryImage | null {
  if (!media?.secureUrl || media.mediaKind === "video") {
    return null;
  }

  const width = item.width || media.width || 1200;
  const height = item.height || media.height || 800;
  const title = item.title || media.title || "JnUITS gallery photo";
  const description = item.description || item.sourceCaption || "";

  return {
    altText: item.altText || media.altText || title,
    blurDataURL: item.blurDataURL || null,
    description,
    fullUrl: transformCloudinaryUrl(media.secureUrl, "full"),
    height,
    id: itemId(albumSlug, item),
    rawUrl: media.secureUrl,
    sortOrder: item.sortOrder || 0,
    sourceCaption: item.sourceCaption || "",
    thumbnailUrl: transformCloudinaryUrl(media.secureUrl, "detailGrid"),
    title,
    width,
  };
}

function coverScore(item: SeedAlbumItem, media: SeedMediaAsset | undefined) {
  if (!media?.secureUrl || media.mediaKind === "video") {
    return -1;
  }

  const width = item.width || media.width || 0;
  const height = item.height || media.height || 0;
  const ratio = height ? width / height : 1;
  const resolutionScore = Math.min((width * height) / 100000, 40);
  const landscapeScore = ratio >= 1.05 && ratio <= 1.9 ? 40 : 0;
  const balancedPortraitScore = ratio >= 0.72 && ratio < 1.05 ? 12 : 0;
  const explicitCoverScore = item.isCover ? 1000 : 0;

  return explicitCoverScore + landscapeScore + balancedPortraitScore + resolutionScore;
}

function chooseSeedCoverItem(album: SeedAlbum, seed: GallerySeed) {
  const assets = mediaMap(seed);
  const items = (album.items || []).filter(
    (item) => (item.status || "published") === "published"
  );

  return items
    .slice()
    .sort((left, right) => {
      const score =
        coverScore(right, assets.get(right.mediaPublicId)) -
        coverScore(left, assets.get(left.mediaPublicId));

      if (score !== 0) {
        return score;
      }

      return (left.sortOrder || 0) - (right.sortOrder || 0);
    })[0];
}

function sortedSeedAlbums(seed: GallerySeed) {
  return seed.albums
    .filter((album) => (album.status || "published") === "published")
    .slice()
    .sort((left, right) => {
      if (Boolean(left.featured) !== Boolean(right.featured)) {
        return left.featured ? -1 : 1;
      }

      if (left.year !== right.year) {
        return right.year - left.year;
      }

      return (right.month || 0) - (left.month || 0);
    });
}

function seedItems(album: SeedAlbum, seed: GallerySeed) {
  const assets = mediaMap(seed);

  return (album.items || [])
    .filter((item) => (item.status || "published") === "published")
    .map((item) => mapSeedImage(album.slug, item, assets.get(item.mediaPublicId)))
    .filter(Boolean)
    .sort((left, right) => {
      if (left!.sortOrder !== right!.sortOrder) {
        return left!.sortOrder - right!.sortOrder;
      }

      return left!.id.localeCompare(right!.id);
    }) as GalleryImage[];
}

function mapSeedAlbum(album: SeedAlbum, seed: GallerySeed): GalleryAlbumSummary {
  const items = seedItems(album, seed);
  const coverItem = chooseSeedCoverItem(album, seed);
  const cover = coverItem
    ? mapSeedImage(album.slug, coverItem, mediaMap(seed).get(coverItem.mediaPublicId))
    : items[0] || null;

  return {
    category: album.category,
    cover,
    description: album.description || "",
    endsOn: album.endDate || null,
    eventName: album.eventName || album.title,
    featured: Boolean(album.featured),
    id: `seed-${album.slug}`,
    itemCount: items.length,
    month: album.month || null,
    slug: album.slug,
    startsOn: album.startDate || null,
    title: album.title,
    updatedAt: seed.generatedAt || album.startDate || `${album.year}-01-01`,
    year: album.year,
  };
}

function seedSearchText(album: SeedAlbum) {
  const itemText = (album.items || [])
    .map(
      (item) =>
        `${item.title || ""} ${item.description || ""} ${item.sourceCaption || ""}`
    )
    .join(" ");

  return [
    album.title,
    album.eventName,
    album.description,
    album.category,
    String(album.year),
    itemText,
  ]
    .join(" ")
    .toLowerCase();
}

export const getSeedGalleryAlbums = cache(
  async (filters: GalleryAlbumFilters = {}) => {
    const seed = await readGallerySeed();
    const query = normalizeQuery(filters.query);
    const year = normalizeQuery(filters.year);
    const category = normalizeQuery(filters.category);

    return sortedSeedAlbums(seed)
      .filter((album) => {
        if (year && String(album.year) !== year) {
          return false;
        }

        if (category && album.category !== category) {
          return false;
        }

        return !query || seedSearchText(album).includes(query);
      })
      .map((album) => mapSeedAlbum(album, seed));
  }
);

export const getSeedGalleryFilterOptions = cache(
  async (): Promise<GalleryFilterOptions> => {
    const seed = await readGallerySeed();
    const albums = sortedSeedAlbums(seed);

    return {
      categories: Array.from(new Set(albums.map((album) => album.category))).sort(),
      years: Array.from(new Set(albums.map((album) => album.year))).sort(
        (left, right) => right - left
      ),
    };
  }
);

export async function getSeedGalleryAlbumItemsPage(options: {
  cursor?: string | null;
  limit?: number | null;
  slug: string;
}) {
  const seed = await readGallerySeed();
  const album = sortedSeedAlbums(seed).find((item) => item.slug === options.slug);
  const limit = normalizeLimit(options.limit);

  if (!album) {
    return {
      items: [] as GalleryImage[],
      nextCursor: null as string | null,
    };
  }

  const cursor = parseCursor(options.cursor);
  const items = seedItems(album, seed).filter((item) => {
    if (!cursor) {
      return true;
    }

    return (
      item.sortOrder > cursor.sortOrder ||
      (item.sortOrder === cursor.sortOrder && item.id > cursor.id)
    );
  });
  const visibleItems = items.slice(0, limit);
  const extraItem = items[limit];

  return {
    items: visibleItems,
    nextCursor: extraItem
      ? encodeCursor(visibleItems[visibleItems.length - 1])
      : null,
  };
}

export const getSeedGalleryAlbumBySlug = cache(
  async (slug: string): Promise<GalleryAlbumDetail | null> => {
    const seed = await readGallerySeed();
    const album = sortedSeedAlbums(seed).find((item) => item.slug === slug);

    if (!album) {
      return null;
    }

    const summary = mapSeedAlbum(album, seed);
    const page = await getSeedGalleryAlbumItemsPage({
      limit: DEFAULT_LIMIT,
      slug,
    });

    return {
      ...summary,
      cloudinaryFolder: album.cloudinaryFolder || null,
      items: page.items,
      nextCursor: page.nextCursor,
    };
  }
);

export const getSeedGallerySitemapEntries = cache(async () => {
  const seed = await readGallerySeed();

  return sortedSeedAlbums(seed).map((album) => ({
    slug: album.slug,
    updatedAt: seed.generatedAt || album.startDate || `${album.year}-01-01`,
  }));
});

export const getSeedGalleryAdminData = cache(async () => {
  const seed = await readGallerySeed();
  const assets = mediaMap(seed);
  const albums: SeedAdminAlbumRow[] = sortedSeedAlbums(seed).map((album) => ({
    category: album.category,
    cloudinary_folder: album.cloudinaryFolder || null,
    deleted_at: null,
    description: album.description || null,
    ends_on: album.endDate || null,
    event_name: album.eventName || album.title,
    featured: Boolean(album.featured),
    id: `seed-${album.slug}`,
    month: album.month || null,
    slug: album.slug,
    starts_on: album.startDate || null,
    status: album.status || "published",
    title: album.title,
    updated_at: seed.generatedAt || album.startDate || `${album.year}-01-01`,
    year: album.year,
  }));
  const items: SeedAdminItemRow[] = [];

  for (const album of sortedSeedAlbums(seed)) {
    const coverItem = chooseSeedCoverItem(album, seed);

    for (const item of album.items || []) {
      const media = assets.get(item.mediaPublicId);

      if (!media?.secureUrl || (item.status || "published") !== "published") {
        continue;
      }

      items.push({
        album_id: `seed-${album.slug}`,
        id: itemId(album.slug, item),
        is_cover:
          Boolean(item.isCover) ||
          (Boolean(coverItem) &&
            coverItem?.mediaPublicId === item.mediaPublicId &&
            (coverItem.sortOrder || 0) === (item.sortOrder || 0)),
        media_assets: {
          secure_url: media.secureUrl,
        },
      });
    }
  }

  return {
    albums,
    items,
    summary: seed.summary || {
      albumCount: albums.length,
      albumItemCount: items.length,
      mediaAssetCount: seed.mediaAssets.length,
    },
  };
});
