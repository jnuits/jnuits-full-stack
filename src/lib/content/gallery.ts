import { cache } from "react";
import { transformCloudinaryUrl } from "@/lib/cloudinary/urls";
import {
  getSeedGalleryAlbumBySlug,
  getSeedGalleryAlbumItemsPage,
  getSeedGalleryAlbums,
  getSeedGallerySitemapEntries,
} from "@/lib/content/gallery-seed";
import type { Tables } from "@/lib/db/types";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_GALLERY_LIMIT = 20;
const MAX_GALLERY_LIMIT = 40;
const GALLERY_ITEM_SELECT =
  "id, album_id, title, description, alt_text, source_caption, width, height, blur_data_url, sort_order, is_cover, media_assets(id, public_id, secure_url, thumbnail_url, alt_text, title, media_kind, width, height)";

export type GalleryImage = {
  altText: string;
  blurDataURL: string | null;
  description: string;
  fullUrl: string;
  height: number;
  id: string;
  rawUrl: string;
  sortOrder: number;
  sourceCaption: string;
  thumbnailUrl: string;
  title: string;
  width: number;
};

export type GalleryAlbumSummary = {
  category: string;
  cover: GalleryImage | null;
  description: string;
  endsOn: string | null;
  eventName: string;
  featured: boolean;
  id: string;
  itemCount: number;
  month: number | null;
  slug: string;
  startsOn: string | null;
  title: string;
  updatedAt: string;
  year: number;
};

export type GalleryAlbumDetail = GalleryAlbumSummary & {
  cloudinaryFolder: string | null;
  items: GalleryImage[];
  nextCursor: string | null;
};

export type GalleryFilterOptions = {
  categories: string[];
  years: number[];
};

export type GalleryAlbumFilters = {
  category?: string;
  query?: string;
  year?: string;
};

type GalleryAlbumRow = Pick<
  Tables<"gallery_albums">,
  | "category"
  | "cloudinary_folder"
  | "cover_item_id"
  | "description"
  | "ends_on"
  | "event_name"
  | "featured"
  | "id"
  | "month"
  | "slug"
  | "starts_on"
  | "title"
  | "updated_at"
  | "year"
>;

type GalleryItemRow = Pick<
  Tables<"gallery_album_items">,
  | "album_id"
  | "alt_text"
  | "blur_data_url"
  | "description"
  | "height"
  | "id"
  | "is_cover"
  | "sort_order"
  | "source_caption"
  | "title"
  | "width"
> & {
  media_assets?: MediaAssetRow | MediaAssetRow[] | null;
};

type MediaAssetRow = Pick<
  Tables<"media_assets">,
  | "alt_text"
  | "height"
  | "id"
  | "media_kind"
  | "public_id"
  | "secure_url"
  | "thumbnail_url"
  | "title"
  | "width"
>;

function firstRecord<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value || null;
}

function normalizeQuery(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function encodeCursor(item: Pick<GalleryImage, "id" | "sortOrder">) {
  return `${item.sortOrder}:${item.id}`;
}

export function parseGalleryCursor(cursor: string | null | undefined) {
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

function normalizeLimit(limit: number | null | undefined) {
  if (!Number.isFinite(limit || 0)) {
    return DEFAULT_GALLERY_LIMIT;
  }

  return Math.min(Math.max(Number(limit), 1), MAX_GALLERY_LIMIT);
}

function mapItem(row: GalleryItemRow): GalleryImage | null {
  const media = firstRecord(row.media_assets);

  if (!media?.secure_url || media.media_kind !== "image") {
    return null;
  }

  const width = row.width || media.width || 1200;
  const height = row.height || media.height || 800;
  const title = row.title || media.title || "JnUITS gallery photo";
  const description = row.description || row.source_caption || "";

  return {
    altText: row.alt_text || media.alt_text || title,
    blurDataURL: row.blur_data_url,
    description,
    fullUrl: transformCloudinaryUrl(media.secure_url, "full"),
    height,
    id: row.id,
    rawUrl: media.secure_url,
    sortOrder: row.sort_order,
    sourceCaption: row.source_caption || "",
    thumbnailUrl: transformCloudinaryUrl(media.secure_url, "detailGrid"),
    title,
    width,
  };
}

function mapAlbum(
  row: GalleryAlbumRow,
  options: {
    cover: GalleryImage | null;
    itemCount: number;
  }
): GalleryAlbumSummary {
  return {
    category: row.category,
    cover: options.cover,
    description: row.description || "",
    endsOn: row.ends_on,
    eventName: row.event_name || row.title,
    featured: row.featured,
    id: row.id,
    itemCount: options.itemCount,
    month: row.month,
    slug: row.slug,
    startsOn: row.starts_on,
    title: row.title,
    updatedAt: row.updated_at,
    year: row.year,
  };
}

function buildSearchText(album: GalleryAlbumSummary, itemRows: GalleryItemRow[]) {
  const itemText = itemRows
    .map((item) => `${item.title || ""} ${item.description || ""} ${item.source_caption || ""}`)
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

export const getGalleryAlbums = cache(async (filters: GalleryAlbumFilters = {}) => {
  const supabase = await createClient();
  const { data: albumData, error } = await supabase
    .from("gallery_albums")
    .select(
      "id, slug, title, event_name, description, year, month, starts_on, ends_on, category, featured, cover_item_id, cloudinary_folder, updated_at"
    )
    .eq("status", "published")
    .is("deleted_at", null)
    .order("featured", { ascending: false })
    .order("year", { ascending: false })
    .order("month", { ascending: false, nullsFirst: false })
    .order("starts_on", { ascending: false, nullsFirst: false });

  if (error || !albumData?.length) {
    return getSeedGalleryAlbums(filters);
  }

  const albumRows = albumData as GalleryAlbumRow[];
  const albumIds = albumRows.map((album) => album.id);
  const { data: itemData } = await supabase
    .from("gallery_album_items")
    .select(GALLERY_ITEM_SELECT)
    .in("album_id", albumIds)
    .eq("status", "published")
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  const itemRows = (itemData || []) as GalleryItemRow[];
  const itemsByAlbumId = new Map<string, GalleryItemRow[]>();

  for (const item of itemRows) {
    if (!itemsByAlbumId.has(item.album_id)) {
      itemsByAlbumId.set(item.album_id, []);
    }

    itemsByAlbumId.get(item.album_id)?.push(item);
  }

  const albums = albumRows.map((album) => {
    const rows = itemsByAlbumId.get(album.id) || [];
    const coverRow =
      rows.find((item) => item.id === album.cover_item_id) ||
      rows.find((item) => item.is_cover) ||
      rows[0];

    return mapAlbum(album, {
      cover: coverRow ? mapItem(coverRow) : null,
      itemCount: rows.length,
    });
  });

  const query = normalizeQuery(filters.query);
  const year = normalizeQuery(filters.year);
  const category = normalizeQuery(filters.category);

  return albums.filter((album) => {
    if (year && String(album.year) !== year) {
      return false;
    }

    if (category && album.category !== category) {
      return false;
    }

    if (!query) {
      return true;
    }

    return buildSearchText(album, itemsByAlbumId.get(album.id) || []).includes(query);
  });
});

export const getGalleryFilterOptions = cache(async (): Promise<GalleryFilterOptions> => {
  const albums = await getGalleryAlbums();

  return {
    categories: Array.from(new Set(albums.map((album) => album.category))).sort(),
    years: Array.from(new Set(albums.map((album) => album.year))).sort(
      (left, right) => right - left
    ),
  };
});

export async function getGalleryAlbumItemsPage(options: {
  albumId?: string;
  cursor?: string | null;
  limit?: number | null;
  slug?: string;
}) {
  const supabase = await createClient();
  const limit = normalizeLimit(options.limit);
  let albumId = options.albumId || "";

  if (!albumId && options.slug) {
    const { data: album, error } = await supabase
      .from("gallery_albums")
      .select("id")
      .eq("slug", options.slug)
      .eq("status", "published")
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      return getSeedGalleryAlbumItemsPage({
        cursor: options.cursor,
        limit,
        slug: options.slug,
      });
    }

    albumId = album?.id || "";
  }

  if (!albumId) {
    if (options.slug) {
      return getSeedGalleryAlbumItemsPage({
        cursor: options.cursor,
        limit,
        slug: options.slug,
      });
    }

    return {
      items: [] as GalleryImage[],
      nextCursor: null as string | null,
    };
  }

  const parsedCursor = parseGalleryCursor(options.cursor);
  let query = supabase
    .from("gallery_album_items")
    .select(GALLERY_ITEM_SELECT)
    .eq("album_id", albumId)
    .eq("status", "published")
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true })
    .limit(limit + 1);

  if (parsedCursor) {
    query = query.or(
      `sort_order.gt.${parsedCursor.sortOrder},and(sort_order.eq.${parsedCursor.sortOrder},id.gt.${parsedCursor.id})`
    );
  }

  const { data, error } = await query;

  if (error || !data) {
    if (options.slug) {
      return getSeedGalleryAlbumItemsPage({
        cursor: options.cursor,
        limit,
        slug: options.slug,
      });
    }

    return {
      items: [],
      nextCursor: null,
    };
  }

  const mapped = (data as GalleryItemRow[]).map(mapItem).filter(Boolean) as GalleryImage[];
  const visibleItems = mapped.slice(0, limit);
  const extraItem = mapped[limit];

  return {
    items: visibleItems,
    nextCursor: extraItem ? encodeCursor(visibleItems[visibleItems.length - 1]) : null,
  };
}

export const getGalleryAlbumBySlug = cache(async (slug: string) => {
  const normalizedSlug = normalizeQuery(slug);

  if (!normalizedSlug) {
    return null;
  }

  const supabase = await createClient();
  const { data: albumData, error } = await supabase
    .from("gallery_albums")
    .select(
      "id, slug, title, event_name, description, year, month, starts_on, ends_on, category, featured, cover_item_id, cloudinary_folder, updated_at"
    )
    .eq("slug", normalizedSlug)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !albumData) {
    return getSeedGalleryAlbumBySlug(normalizedSlug);
  }

  const album = albumData as GalleryAlbumRow;
  const [page, countResult, coverResult] = await Promise.all([
    getGalleryAlbumItemsPage({
      albumId: album.id,
      limit: DEFAULT_GALLERY_LIMIT,
    }),
    supabase
      .from("gallery_album_items")
      .select("id", { count: "exact", head: true })
      .eq("album_id", album.id)
      .eq("status", "published")
      .is("deleted_at", null),
    album.cover_item_id
      ? supabase
          .from("gallery_album_items")
          .select(GALLERY_ITEM_SELECT)
          .eq("id", album.cover_item_id)
          .eq("album_id", album.id)
          .eq("status", "published")
          .is("deleted_at", null)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  const cover =
    (coverResult.data ? mapItem(coverResult.data as GalleryItemRow) : null) ||
    page.items.find((item) => item.id === album.cover_item_id) ||
    page.items[0] ||
    null;

  return {
    ...mapAlbum(album, {
      cover,
      itemCount: countResult.count ?? page.items.length,
    }),
    cloudinaryFolder: album.cloudinary_folder,
    items: page.items,
    nextCursor: page.nextCursor,
  } satisfies GalleryAlbumDetail;
});

export const getPublishedGallerySitemapEntries = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gallery_albums")
    .select("slug, updated_at")
    .eq("status", "published")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(500);

  if (error || !data?.length) {
    return getSeedGallerySitemapEntries();
  }

  return data.map((row) => ({
    slug: row.slug,
    updatedAt: row.updated_at,
  }));
});
