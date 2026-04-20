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
    alt_text: asset.altText || null,
    bytes: asset.bytes ?? null,
    duration_seconds: null,
    format: asset.format || null,
    height: asset.height ?? null,
    is_public: asset.isPublic !== false,
    media_kind: asset.mediaKind || "image",
    metadata: asset.metadata || {},
    provider: "cloudinary",
    public_id: asset.publicId,
    resource_type: asset.resourceType || "image",
    secure_url: asset.secureUrl,
    thumbnail_url: asset.thumbnailUrl || null,
    title: asset.title || null,
    width: asset.width ?? null,
  };
}

function toAlbumRow(album) {
  return {
    category: album.category || "other-real-event",
    cloudinary_folder: album.cloudinaryFolder || null,
    deleted_at: null,
    deleted_by_user_id: null,
    description: album.description || null,
    ends_on: album.endDate || null,
    event_name: album.eventName || album.title,
    featured: Boolean(album.featured),
    month: album.month || null,
    restorable_until: null,
    slug: album.slug,
    source: album.source || "facebook-export",
    source_metadata: album.sourceMetadata || {},
    starts_on: album.startDate || null,
    status: album.status || "published",
    title: album.title,
    trash_metadata: {},
    trash_reason: null,
    year: album.year,
  };
}

function toAlbumItemRow(item, albumId, mediaAssetId) {
  return {
    album_id: albumId,
    alt_text: item.altText || null,
    blur_data_url: item.blurDataURL || null,
    deleted_at: null,
    deleted_by_user_id: null,
    description: item.description || null,
    height: item.height ?? null,
    is_cover: Boolean(item.isCover),
    media_asset_id: mediaAssetId,
    restorable_until: null,
    sort_order: item.sortOrder || 100,
    source_caption: item.sourceCaption || null,
    source_metadata: item.sourceMetadata || {},
    status: item.status || "published",
    title: item.title || null,
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

  for (const publicIdBatch of chunk(publicIds, 200)) {
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

    for (const item of album.items || []) {
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
        mediaAssetId
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
