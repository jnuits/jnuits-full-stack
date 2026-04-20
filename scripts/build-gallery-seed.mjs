#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const CATALOG_PATH = path.join(ROOT, "plan", "data", "jnuits-event-catalog.json");
const REPORT_ROOT = path.join(ROOT, "artifacts", "facebook-jnuits", "reports");
const OUTPUT_PATH = path.join(ROOT, "plan", "data", "jnuits-gallery-seed.json");
const PREFERRED_REPORTS = [
  "facebook-gallery-upload-20260419T163722Z.json",
  "aparahner-ariyal-tour-upload-20260419T173031Z.json",
  "missing-post-event-albums-upload-20260419T174142Z.json",
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ensureDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function compact(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function monthFromDate(value) {
  const match = String(value || "").match(/^\d{4}-(\d{2})-/);
  return match ? Number(match[1]) : null;
}

function publicIdFromUrl(value) {
  const text = String(value || "");
  const marker = "/upload/";
  const index = text.indexOf(marker);

  if (index === -1) {
    return "";
  }

  return text
    .slice(index + marker.length)
    .replace(/^v\d+\//, "")
    .replace(/\.[a-zA-Z0-9]+$/, "");
}

function transformCloudinaryUrl(secureUrl, transformation) {
  const marker = "/upload/";
  const index = String(secureUrl || "").indexOf(marker);

  if (index === -1) {
    return secureUrl || "";
  }

  return `${secureUrl.slice(0, index + marker.length)}${transformation}/${secureUrl.slice(
    index + marker.length
  )}`;
}

async function fetchBlurDataUrl(secureUrl) {
  const blurUrl = transformCloudinaryUrl(
    secureUrl,
    "f_auto,q_auto:low,e_blur:800,w_32"
  );
  const response = await fetch(blurUrl);

  if (!response.ok) {
    throw new Error(`Blur placeholder fetch failed: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "image/jpeg";
  const buffer = Buffer.from(await response.arrayBuffer());

  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );

  return results;
}

function loadUploadReports() {
  const preferred = PREFERRED_REPORTS.map((fileName) => path.join(REPORT_ROOT, fileName))
    .filter((filePath) => fs.existsSync(filePath));

  if (preferred.length > 0) {
    return preferred.map((filePath) => ({ filePath, report: readJson(filePath) }));
  }

  return fs
    .readdirSync(REPORT_ROOT)
    .filter((fileName) => /-upload-\d+T\d+Z\.json$/.test(fileName))
    .sort()
    .map((fileName) => path.join(REPORT_ROOT, fileName))
    .map((filePath) => ({ filePath, report: readJson(filePath) }));
}

function normalizeUploadResult(row, reportPath) {
  const upload = row.upload || {};
  const publicId = compact(upload.publicId || upload.public_id || row.publicId);
  const secureUrl = compact(upload.secureUrl || upload.secure_url || row.secureUrl);

  if (!publicId || !secureUrl) {
    return null;
  }

  return {
    activityDate: compact(row.activityDate),
    altText: compact(row.alt) || `${compact(row.eventTitle)} photo`,
    bytes: typeof upload.bytes === "number" ? upload.bytes : null,
    caption: compact(row.caption),
    eventSlug: compact(row.eventSlug),
    eventTitle: compact(row.eventTitle),
    folder: compact(row.folder),
    format: compact(upload.format),
    height: typeof upload.height === "number" ? upload.height : null,
    publicId,
    reportFile: path.basename(reportPath),
    resourceType: "image",
    secureUrl,
    sourceFile: compact(row.sourceFile),
    sourceType: compact(row.sourceType) || "facebook-export",
    timestamp: typeof row.timestamp === "number" ? row.timestamp : null,
    width: typeof upload.width === "number" ? upload.width : null,
  };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const shouldFetchBlur = !args.has("--skip-blur");
  const catalog = readJson(CATALOG_PATH);
  const reports = loadUploadReports();
  const originalSlugCounts = new Map();
  for (const event of catalog.events) {
    originalSlugCounts.set(event.slug, (originalSlugCounts.get(event.slug) || 0) + 1);
  }

  const usedSlugs = new Set();
  const albumSeedEvents = catalog.events.map((event) => {
    let slug = event.slug;

    if (originalSlugCounts.get(event.slug) > 1 || usedSlugs.has(slug)) {
      const suffix = [event.year, monthFromDate(event.startDate)]
        .filter(Boolean)
        .join("-");
      slug = `${event.slug}-${suffix}`;
    }

    let candidate = slug;
    let duplicateIndex = 2;
    while (usedSlugs.has(candidate)) {
      candidate = `${slug}-${duplicateIndex}`;
      duplicateIndex += 1;
    }

    usedSlugs.add(candidate);

    return {
      ...event,
      albumSlug: candidate,
    };
  });

  const eventBySlug = new Map(albumSeedEvents.map((event) => [event.albumSlug, event]));
  const albumSlugBySourceSlug = new Map();
  const albumSlugByFolder = new Map();

  for (const event of albumSeedEvents) {
    if (originalSlugCounts.get(event.slug) === 1) {
      albumSlugBySourceSlug.set(event.slug, event.albumSlug);
    }

    for (const folder of event.cloudinaryFolders || []) {
      const normalizedFolder = String(folder || "").replace(/\\/g, "/").replace(/\/{2,}/g, "/");
      albumSlugByFolder.set(normalizedFolder, event.albumSlug);
      albumSlugByFolder.set(normalizedFolder.split("/").pop(), event.albumSlug);
    }
  }
  const allMediaByPublicId = new Map();

  for (const { filePath, report } of reports) {
    for (const row of report.results || []) {
      const normalized = normalizeUploadResult(row, filePath);

      if (!normalized) {
        continue;
      }

      allMediaByPublicId.set(normalized.publicId, normalized);
    }
  }

  const allMedia = Array.from(allMediaByPublicId.values()).sort((left, right) =>
    left.publicId.localeCompare(right.publicId)
  );
  const mediaByEvent = new Map();

  for (const item of allMedia) {
    const folderSlug = item.folder.split("/").pop();
    const albumSlug =
      albumSlugByFolder.get(item.folder) ||
      albumSlugByFolder.get(folderSlug) ||
      albumSlugBySourceSlug.get(item.eventSlug);

    if (!albumSlug || !eventBySlug.has(albumSlug)) {
      continue;
    }

    if (!mediaByEvent.has(albumSlug)) {
      mediaByEvent.set(albumSlug, []);
    }

    mediaByEvent.get(albumSlug).push(item);
  }

  const blurByPublicId = new Map();
  const albumLinkedMedia = Array.from(mediaByEvent.values()).flat();

  if (shouldFetchBlur) {
    await mapWithConcurrency(albumLinkedMedia, 8, async (item) => {
      try {
        blurByPublicId.set(item.publicId, await fetchBlurDataUrl(item.secureUrl));
      } catch {
        blurByPublicId.set(
          item.publicId,
          "data:image/gif;base64,R0lGODlhAQABAAAAACw="
        );
      }
    });
  }

  const mediaAssets = allMedia.map((item) => ({
    altText: item.altText,
    bytes: item.bytes,
    format: item.format || null,
    height: item.height,
    isPublic: true,
    mediaKind: "image",
    metadata: {
      activityDate: item.activityDate || null,
      cloudinaryFolder: item.folder || null,
      eventSlug: item.eventSlug || null,
      eventTitle: item.eventTitle || null,
      source: "facebook-export-cloudinary-upload",
      sourceFile: item.sourceFile || null,
      sourceReport: item.reportFile,
      sourceType: item.sourceType,
    },
    publicId: item.publicId,
    resourceType: item.resourceType,
    secureUrl: item.secureUrl,
    thumbnailUrl: transformCloudinaryUrl(item.secureUrl, "f_auto,q_auto,c_fill,w_700,h_500,g_auto"),
    title: item.eventTitle || path.basename(item.publicId),
    width: item.width,
  }));

  const albums = albumSeedEvents.map((event) => {
    const eventMedia = (mediaByEvent.get(event.albumSlug) || []).sort((left, right) => {
      const leftTimestamp = left.timestamp ?? 0;
      const rightTimestamp = right.timestamp ?? 0;

      if (leftTimestamp !== rightTimestamp) {
        return leftTimestamp - rightTimestamp;
      }

      return left.publicId.localeCompare(right.publicId);
    });
    const coverPublicId =
      publicIdFromUrl(event.coverImageUrl) || eventMedia[0]?.publicId || null;

    return {
      category: event.category || "other-real-event",
      cloudinaryFolder: event.cloudinaryFolders?.[0] || null,
      description: event.description || "",
      endDate: event.endDate || event.startDate || null,
      eventName: event.title,
      featured: Boolean(event.featured),
      items: eventMedia.map((item, index) => {
        const photoTitle = `${event.title} - Photo ${index + 1}`;

        return {
        altText: photoTitle,
        blurDataURL:
          blurByPublicId.get(item.publicId) ||
          "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
        description: "",
        height: item.height,
        isCover: item.publicId === coverPublicId || (!coverPublicId && index === 0),
        mediaPublicId: item.publicId,
        sortOrder: (index + 1) * 10,
        sourceCaption: item.caption || "",
        sourceMetadata: {
          activityDate: item.activityDate || null,
          sourceFile: item.sourceFile || null,
          sourceReport: item.reportFile,
          sourceType: item.sourceType,
        },
        status: "published",
        title: photoTitle,
        width: item.width,
      };
      }),
      month: monthFromDate(event.startDate),
      slug: event.albumSlug,
      source: "facebook-export",
      sourceMetadata: {
        deliveryMode: event.deliveryMode || null,
        originalSlug: event.slug,
        sourceTypes: event.sourceTypes || [],
      },
      startDate: event.startDate || null,
      status: "published",
      title: event.title,
      year: event.year,
    };
  });

  const seed = {
    generatedAt: new Date().toISOString(),
    source: {
      catalog: path.relative(ROOT, CATALOG_PATH).replace(/\\/g, "/"),
      reports: reports.map(({ filePath }) =>
        path.relative(ROOT, filePath).replace(/\\/g, "/")
      ),
    },
    summary: {
      albumCount: albums.length,
      albumItemCount: albums.reduce((sum, album) => sum + album.items.length, 0),
      mediaAssetCount: mediaAssets.length,
    },
    mediaAssets,
    albums,
  };

  ensureDirectory(OUTPUT_PATH);
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(seed, null, 2)}\n`, "utf8");
  console.log(
    `Gallery seed written: ${path.relative(ROOT, OUTPUT_PATH)} (${seed.summary.albumCount} albums, ${seed.summary.albumItemCount} linked items, ${seed.summary.mediaAssetCount} media assets)`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
