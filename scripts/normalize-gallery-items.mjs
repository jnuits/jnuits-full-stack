#!/usr/bin/env node

import process from "node:process";
import {
  buildSupabaseAdminClient,
  resolveReportPath,
  writeJsonReport,
} from "./lib/legacy-content.mjs";

function parseArgs(argv) {
  const options = {
    apply: false,
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

function buildPhotoLabel(albumTitle, index) {
  return `${String(albumTitle || "Gallery album").trim() || "Gallery album"} - Photo ${index + 1}`;
}

function needsUpdate(item, nextTitle) {
  return (
    item.title !== nextTitle ||
    item.alt_text !== nextTitle ||
    Boolean(item.description)
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const supabase = buildSupabaseAdminClient();
  const reportPath = resolveReportPath(
    "gallery",
    "gallery-item-normalize-report",
    options.report
  );
  const report = {
    mode: options.apply ? "apply" : "dry-run",
    generatedAt: new Date().toISOString(),
    albumsScanned: 0,
    itemsScanned: 0,
    itemsChanged: 0,
    errors: [],
    samples: [],
  };

  const { data: albums, error: albumError } = await supabase
    .from("gallery_albums")
    .select("id, title, slug")
    .order("year", { ascending: false })
    .order("month", { ascending: false, nullsFirst: false })
    .order("title", { ascending: true });

  if (albumError) {
    throw new Error(`Gallery album lookup failed: ${albumError.message}`);
  }

  for (const album of albums || []) {
    report.albumsScanned += 1;

    const { data: items, error: itemError } = await supabase
      .from("gallery_album_items")
      .select("id, title, alt_text, description, sort_order")
      .eq("album_id", album.id)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });

    if (itemError) {
      report.errors.push({
        albumId: album.id,
        albumSlug: album.slug,
        message: itemError.message,
      });
      continue;
    }

    for (const [index, item] of (items || []).entries()) {
      report.itemsScanned += 1;

      const nextTitle = buildPhotoLabel(album.title, index);

      if (!needsUpdate(item, nextTitle)) {
        continue;
      }

      report.itemsChanged += 1;

      if (report.samples.length < 12) {
        report.samples.push({
          albumSlug: album.slug,
          itemId: item.id,
          nextTitle,
          previousDescriptionLength: item.description?.length || 0,
          previousTitleLength: item.title?.length || 0,
        });
      }

      if (!options.apply) {
        continue;
      }

      const { error: updateError } = await supabase
        .from("gallery_album_items")
        .update({
          alt_text: nextTitle,
          description: null,
          title: nextTitle,
        })
        .eq("id", item.id)
        .eq("album_id", album.id);

      if (updateError) {
        report.errors.push({
          albumId: album.id,
          albumSlug: album.slug,
          itemId: item.id,
          message: updateError.message,
        });
      }
    }
  }

  writeJsonReport(reportPath, report);
  console.log(
    `Gallery item normalization ${options.apply ? "applied" : "dry-run"}: ${report.itemsChanged} of ${report.itemsScanned} item(s) need normalized metadata. Report: ${reportPath}`
  );

  if (report.errors.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
