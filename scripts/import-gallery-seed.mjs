#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  buildSupabaseAdminClient,
  resolveReportPath,
  writeJsonReport,
} from "./lib/legacy-content.mjs";

const DEFAULT_SEED_PATH = path.join(process.cwd(), "plan", "data", "jnuits-gallery-seed.json");

function parseArgs(argv) {
  const options = {
    apply: false,
    file: DEFAULT_SEED_PATH,
    report: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--apply") {
      options.apply = true;
      continue;
    }

    if (token === "--dry-run") {
      options.apply = false;
      continue;
    }

    if (token === "--file" && argv[index + 1]) {
      options.file = path.resolve(process.cwd(), argv[index + 1]);
      index += 1;
      continue;
    }

    if (token.startsWith("--file=")) {
      options.file = path.resolve(process.cwd(), token.split("=")[1] || "");
      continue;
    }

    if (token === "--report" && argv[index + 1]) {
      options.report = argv[index + 1];
      index += 1;
      continue;
    }

    if (token.startsWith("--report=")) {
      options.report = token.split("=")[1] || "";
    }
  }

  return options;
}

function chunk(items, size = 100) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function sanitizeStringForPostgres(value) {
  const text = String(value);
  let output = "";

  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);

    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(index + 1);

      if (next >= 0xdc00 && next <= 0xdfff) {
        output += text[index] + text[index + 1];
        index += 1;
        continue;
      }

      output += "\uFFFD";
      continue;
    }

    if (code >= 0xdc00 && code <= 0xdfff) {
      output += "\uFFFD";
      continue;
    }

    output += text[index];
  }

  return output;
}

function sanitizeForPostgres(value) {
  if (typeof value === "string") {
    return sanitizeStringForPostgres(value);
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeForPostgres);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        sanitizeStringForPostgres(key),
        sanitizeForPostgres(entryValue),
      ])
    );
  }

  return value;
}

function readSeed(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Gallery seed file not found: ${filePath}`);
  }

  const seed = JSON.parse(fs.readFileSync(filePath, "utf8"));

  if (!Array.isArray(seed.mediaAssets) || !Array.isArray(seed.albums)) {
    throw new Error("Gallery seed must include mediaAssets and albums arrays.");
  }

  return seed;
}

function toMediaAssetRow(asset) {
  return {
    alt_text: asset.altText ? sanitizeStringForPostgres(asset.altText) : null,
    bytes: asset.bytes ?? null,
    duration_seconds: null,
    format: asset.format ? sanitizeStringForPostgres(asset.format) : null,
    height: asset.height ?? null,
    is_public: asset.isPublic !== false,
    media_kind: sanitizeStringForPostgres(asset.mediaKind || "image"),
    metadata: sanitizeForPostgres(asset.metadata || {}),
    provider: "cloudinary",
    public_id: sanitizeStringForPostgres(asset.publicId),
    resource_type: sanitizeStringForPostgres(asset.resourceType || "image"),
    secure_url: sanitizeStringForPostgres(asset.secureUrl),
    thumbnail_url: asset.thumbnailUrl
      ? sanitizeStringForPostgres(asset.thumbnailUrl)
      : null,
    title: asset.title ? sanitizeStringForPostgres(asset.title) : null,
    width: asset.width ?? null,
  };
}

function toAlbumRow(album) {
  return {
    category: sanitizeStringForPostgres(album.category || "other-real-event"),
    cloudinary_folder: album.cloudinaryFolder
      ? sanitizeStringForPostgres(album.cloudinaryFolder)
      : null,
    deleted_at: null,
    deleted_by_user_id: null,
    description: album.description
      ? sanitizeStringForPostgres(album.description)
      : null,
    ends_on: album.endDate || null,
    event_name: sanitizeStringForPostgres(album.eventName || album.title),
    featured: Boolean(album.featured),
    month: album.month || null,
    restorable_until: null,
    slug: sanitizeStringForPostgres(album.slug),
    source: sanitizeStringForPostgres(album.source || "facebook-export"),
    source_metadata: sanitizeForPostgres(album.sourceMetadata || {}),
    starts_on: album.startDate || null,
    status: sanitizeStringForPostgres(album.status || "published"),
    title: sanitizeStringForPostgres(album.title),
    trash_metadata: {},
    trash_reason: null,
    year: album.year,
  };
}

function buildPhotoLabel(albumTitle, index) {
  return sanitizeStringForPostgres(
    `${String(albumTitle || "Gallery album").trim() || "Gallery album"} - Photo ${index + 1}`
  );
}

function toAlbumItemRow(item, albumId, mediaAssetId, albumTitle, itemIndex) {
  const photoLabel = buildPhotoLabel(albumTitle, itemIndex);

  return {
    album_id: albumId,
    alt_text: photoLabel,
    blur_data_url: item.blurDataURL
      ? sanitizeStringForPostgres(item.blurDataURL)
      : null,
    deleted_at: null,
    deleted_by_user_id: null,
    description: null,
    height: item.height ?? null,
    is_cover: Boolean(item.isCover),
    media_asset_id: mediaAssetId,
    restorable_until: null,
    sort_order: item.sortOrder || 100,
    source_caption: item.sourceCaption
      ? sanitizeStringForPostgres(item.sourceCaption)
      : null,
    source_metadata: sanitizeForPostgres(item.sourceMetadata || {}),
    status: sanitizeStringForPostgres(item.status || "published"),
    title: photoLabel,
    trash_metadata: {},
    trash_reason: null,
    width: item.width ?? null,
  };
}

async function assertGallerySchemaReady(supabase) {
  const requiredTables = ["media_assets", "gallery_albums", "gallery_album_items"];
  const missingTables = [];

  for (const table of requiredTables) {
    const { error } = await supabase.from(table).select("id").limit(1);

    if (error) {
      missingTables.push(`${table}: ${error.message}`);
    }
  }

  if (missingTables.length) {
    throw new Error(
      [
        "Gallery schema is not ready. Apply supabase/migrations/20260420000000_gallery_album_rebuild.sql before importing.",
        ...missingTables,
      ].join("\n")
    );
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const seed = readSeed(options.file);
  const reportPath = resolveReportPath(
    "gallery",
    "gallery-seed-import-report",
    options.report
  );
  const report = {
    mode: options.apply ? "apply" : "dry-run",
    generatedAt: new Date().toISOString(),
    source: {
      filePath: options.file,
      seedGeneratedAt: seed.generatedAt || null,
    },
    expected: {
      albums: seed.albums.length,
      albumItems: seed.albums.reduce((sum, album) => sum + album.items.length, 0),
      mediaAssets: seed.mediaAssets.length,
    },
    execution: {
      albumsUpserted: 0,
      albumItemsUpserted: 0,
      mediaAssetsUpserted: 0,
      coverPointersUpdated: 0,
    },
  };

  if (!options.apply) {
    writeJsonReport(reportPath, report);
    console.log(
      `Gallery seed dry-run: ${report.expected.albums} albums, ${report.expected.albumItems} linked items, ${report.expected.mediaAssets} media assets. Report: ${reportPath}`
    );
    return;
  }

  const supabase = buildSupabaseAdminClient();
  await assertGallerySchemaReady(supabase);

  for (const batch of chunk(seed.mediaAssets.map(toMediaAssetRow), 100)) {
    const { error } = await supabase
      .from("media_assets")
      .upsert(batch, { onConflict: "public_id" });

    if (error) {
      throw new Error(`Media asset upsert failed: ${error.message}`);
    }

    report.execution.mediaAssetsUpserted += batch.length;
  }

  for (const batch of chunk(seed.albums.map(toAlbumRow), 50)) {
    const { error } = await supabase
      .from("gallery_albums")
      .upsert(batch, { onConflict: "slug" });

    if (error) {
      throw new Error(`Gallery album upsert failed: ${error.message}`);
    }

    report.execution.albumsUpserted += batch.length;
  }

  const albumSlugs = seed.albums.map((album) => album.slug);
  const publicIds = seed.mediaAssets.map((asset) => asset.publicId);
  const albumIdBySlug = new Map();
  const mediaIdByPublicId = new Map();

  for (const slugBatch of chunk(albumSlugs, 200)) {
    const { data, error } = await supabase
      .from("gallery_albums")
      .select("id, slug")
      .in("slug", slugBatch);

    if (error) {
      throw new Error(`Gallery album lookup failed: ${error.message}`);
    }

    for (const row of data || []) {
      albumIdBySlug.set(row.slug, row.id);
    }
  }

  // Cloudinary public IDs include nested folder paths, so large `.in()` batches
  // can exceed PostgREST URL limits and return a generic 400 Bad Request.
  for (const publicIdBatch of chunk(publicIds, 25)) {
    const { data, error } = await supabase
      .from("media_assets")
      .select("id, public_id")
      .in("public_id", publicIdBatch);

    if (error) {
      throw new Error(`Media asset lookup failed: ${error.message}`);
    }

    for (const row of data || []) {
      mediaIdByPublicId.set(row.public_id, row.id);
    }
  }

  const albumIds = Array.from(albumIdBySlug.values());

  for (const albumIdBatch of chunk(albumIds, 200)) {
    const { error } = await supabase
      .from("gallery_album_items")
      .update({ is_cover: false })
      .in("album_id", albumIdBatch);

    if (error) {
      throw new Error(`Cover reset failed: ${error.message}`);
    }
  }

  const coverAlbumIds = new Set();
  const coverPointerByAlbumId = new Map();

  for (const album of seed.albums) {
    const albumId = albumIdBySlug.get(album.slug);

    if (!albumId) {
      throw new Error(`Album was not imported: ${album.slug}`);
    }

    const rows = [];

    for (const [itemIndex, item] of (album.items || []).entries()) {
      const mediaAssetId = mediaIdByPublicId.get(item.mediaPublicId);

      if (!mediaAssetId) {
        throw new Error(`Media asset was not imported: ${item.mediaPublicId}`);
      }

      const row = toAlbumItemRow(
        {
          ...item,
          isCover: item.isCover && !coverAlbumIds.has(albumId),
        },
        albumId,
        mediaAssetId,
        album.title,
        itemIndex
      );

      if (row.is_cover) {
        coverAlbumIds.add(albumId);
      }

      rows.push(row);
    }

    for (const batch of chunk(rows, 100)) {
      const { data, error } = await supabase
        .from("gallery_album_items")
        .upsert(batch, { onConflict: "album_id,media_asset_id" })
        .select("id, album_id, is_cover");

      if (error) {
        throw new Error(`Gallery album item upsert failed: ${error.message}`);
      }

      report.execution.albumItemsUpserted += batch.length;

      for (const row of data || []) {
        if (row.is_cover) {
          coverPointerByAlbumId.set(row.album_id, row.id);
        }
      }
    }
  }

  for (const [albumId, coverItemId] of coverPointerByAlbumId) {
    const { error } = await supabase
      .from("gallery_albums")
      .update({ cover_item_id: coverItemId })
      .eq("id", albumId);

    if (error) {
      throw new Error(`Cover pointer update failed: ${error.message}`);
    }

    report.execution.coverPointersUpdated += 1;
  }

  writeJsonReport(reportPath, report);
  console.log(
    `Gallery seed applied: ${report.execution.albumsUpserted} albums, ${report.execution.albumItemsUpserted} linked items, ${report.execution.mediaAssetsUpserted} media assets. Report: ${reportPath}`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
