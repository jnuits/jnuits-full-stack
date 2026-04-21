#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  buildSupabaseAdminClient,
  ensureDirectory,
  normalizeCloudinaryPublicId,
  toStamp,
  writeJsonReport,
} from "./lib/legacy-content.mjs";

const DEFAULT_SEED_PATH = path.join(
  process.cwd(),
  "plan",
  "data",
  "jnuits-events-seed.json"
);
const DEFAULT_REPORT_ROOT = path.join(
  process.cwd(),
  "artifacts",
  "events",
  "reports"
);

const CATEGORY_SET = new Set([
  "workshop-training",
  "competition",
  "member-outreach",
  "ceremony-community",
  "community-social",
  "institutional",
  "tour",
  "other-real-event",
]);

const DELIVERY_MODE_SET = new Set(["offline", "online-or-hybrid", "unknown"]);

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
      options.report = path.resolve(process.cwd(), argv[index + 1]);
      index += 1;
      continue;
    }

    if (token.startsWith("--report=")) {
      options.report = path.resolve(process.cwd(), token.split("=")[1] || "");
    }
  }

  return options;
}

function chunk(items, size = 100) {
  const output = [];

  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size));
  }

  return output;
}

function resolveEventsReportPath(explicitPath = "") {
  if (explicitPath) {
    return explicitPath;
  }

  ensureDirectory(DEFAULT_REPORT_ROOT);
  return path.join(
    DEFAULT_REPORT_ROOT,
    `events-seed-import-report-${toStamp()}.json`
  );
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
    throw new Error(
      `Events seed file not found: ${filePath}. Run node scripts/build-events-seed.mjs first.`
    );
  }

  const seed = JSON.parse(fs.readFileSync(filePath, "utf8"));

  if (!Array.isArray(seed.events)) {
    throw new Error("Events seed must include an events array.");
  }

  return seed;
}

function normalizeDate(value) {
  const text = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function validateSeedEvents(events) {
  const errors = [];
  const slugCounts = new Map();

  for (const event of events) {
    const identifier = event.slug || event.title || "unknown";

    if (event.slug?.trim()) {
      slugCounts.set(event.slug, (slugCounts.get(event.slug) || 0) + 1);
    } else {
      errors.push(`Seed event "${identifier}" is missing slug.`);
    }

    if (!event.title?.trim()) {
      errors.push(`Seed event "${identifier}" is missing title.`);
    }

    if (!CATEGORY_SET.has(event.category)) {
      errors.push(
        `Seed event "${identifier}" has unsupported category "${event.category}".`
      );
    }

    if (!DELIVERY_MODE_SET.has(event.deliveryMode)) {
      errors.push(
        `Seed event "${identifier}" has unsupported delivery mode "${event.deliveryMode}".`
      );
    }

    const startDate = normalizeDate(event.startDate);
    const endDate = normalizeDate(event.endDate || event.startDate);

    if (!startDate) {
      errors.push(`Seed event "${identifier}" has an invalid startDate.`);
    }

    if (event.endDate && !endDate) {
      errors.push(`Seed event "${identifier}" has an invalid endDate.`);
    }

    if (startDate && endDate && endDate < startDate) {
      errors.push(`Seed event "${identifier}" ends before it starts.`);
    }
  }

  for (const [slug, count] of slugCounts) {
    if (count > 1) {
      errors.push(`Seed contains duplicate slug "${slug}" (${count} records).`);
    }
  }

  return errors;
}

function trimNullable(value) {
  const text = String(value || "").trim();
  return text ? sanitizeStringForPostgres(text) : null;
}

function normalizeCloudinaryFolder(value) {
  return normalizeCloudinaryPublicId(value || "");
}

function isCloudinaryTransformationSegment(segment) {
  return /^[a-z]{1,3}_[^/]+(?:,[a-z]{1,3}_[^/]+)*$/i.test(segment);
}

function extractCloudinaryPublicId(input) {
  const raw = String(input || "").trim();

  if (!raw) {
    return null;
  }

  try {
    const parsed = new URL(raw);
    const pathSegments = parsed.pathname
      .split("/")
      .map((segment) => decodeURIComponent(segment))
      .filter(Boolean);
    const uploadIndex = pathSegments.findIndex((segment) => segment === "upload");

    if (uploadIndex === -1 || uploadIndex === pathSegments.length - 1) {
      return null;
    }

    let assetSegments = pathSegments.slice(uploadIndex + 1);

    while (
      assetSegments.length > 1 &&
      isCloudinaryTransformationSegment(assetSegments[0])
    ) {
      assetSegments = assetSegments.slice(1);
    }

    if (assetSegments[0] && /^v\d+$/i.test(assetSegments[0])) {
      assetSegments = assetSegments.slice(1);
    }

    if (!assetSegments.length) {
      return null;
    }

    const last = assetSegments.at(-1) || "";
    assetSegments[assetSegments.length - 1] = last.replace(/\.[^.]+$/, "");

    return normalizeCloudinaryPublicId(assetSegments.join("/")) || null;
  } catch {
    if (/^https?:\/\//i.test(raw)) {
      return null;
    }

    return normalizeCloudinaryPublicId(raw) || null;
  }
}

function extractUrl(value) {
  const match = String(value || "").match(/https?:\/\/[^\s)]+/i);
  return match ? sanitizeStringForPostgres(match[0]) : null;
}

function toDhakaStartTimestamp(date) {
  return `${date}T00:00:00+06:00`;
}

function toDhakaEndTimestamp(date) {
  return `${date}T23:59:59+06:00`;
}

function deriveLocationFields(seedEvent, legacyEvent) {
  const rawLocation = String(legacyEvent?.location || "").trim();
  const normalizedLocation = rawLocation ? sanitizeStringForPostgres(rawLocation) : null;
  const onlineUrl = extractUrl(rawLocation);
  const hasVenueText = Boolean(rawLocation && !onlineUrl);
  const hasOnlineText = Boolean(
    onlineUrl ||
      /(zoom|google meet|meet\.google|microsoft teams|online|virtual|webinar|facebook event)/i.test(
        rawLocation
      )
  );

  let locationMode = "tba";

  if (seedEvent.deliveryMode === "offline") {
    locationMode = normalizedLocation ? "venue" : "tba";
  } else if (seedEvent.deliveryMode === "online-or-hybrid") {
    if (hasVenueText && hasOnlineText) {
      locationMode = "hybrid";
    } else if (hasOnlineText) {
      locationMode = "online";
    } else if (normalizedLocation) {
      locationMode = "hybrid";
    }
  } else if (seedEvent.deliveryMode === "unknown" && normalizedLocation) {
    locationMode = onlineUrl ? "online" : "venue";
  }

  return {
    locationLabel: normalizedLocation,
    locationMode,
    onlineUrl: locationMode === "venue" ? null : onlineUrl,
    venueAddress: locationMode === "venue" ? normalizedLocation : null,
    venueName: locationMode === "venue" ? normalizedLocation : null,
  };
}

function deriveEventOperationalFields(seedEvent, legacyEvent, legacyRegistrationCount) {
  const startDate = normalizeDate(seedEvent.startDate);
  const endDate = normalizeDate(seedEvent.endDate || seedEvent.startDate);
  const startsAt =
    legacyEvent?.starts_at && String(legacyEvent.starts_at).trim()
      ? String(legacyEvent.starts_at)
      : toDhakaStartTimestamp(startDate);
  const endsAt =
    legacyEvent?.ends_at && String(legacyEvent.ends_at).trim()
      ? String(legacyEvent.ends_at)
      : toDhakaEndTimestamp(endDate || startDate);
  const location = deriveLocationFields(seedEvent, legacyEvent);
  const hasLegacyRegistration =
    Boolean(legacyEvent?.registration_open) ||
    Boolean(legacyEvent?.registration_closes_at) ||
    Boolean(legacyEvent?.event_capacity) ||
    legacyRegistrationCount > 0;

  return {
    capacity: Number.isInteger(legacyEvent?.event_capacity)
      ? legacyEvent.event_capacity
      : null,
    ctaLabel: legacyEvent?.cta_href ? "Learn more" : null,
    ctaUrl: trimNullable(legacyEvent?.cta_href),
    endsAt,
    locationLabel: location.locationLabel,
    locationMode: location.locationMode,
    onlineUrl: location.onlineUrl,
    publishedAt:
      legacyEvent?.published_at && String(legacyEvent.published_at).trim()
        ? String(legacyEvent.published_at)
        : startsAt,
    registrationClosesAt:
      legacyEvent?.registration_closes_at &&
      String(legacyEvent.registration_closes_at).trim()
        ? String(legacyEvent.registration_closes_at)
        : null,
    registrationMode: hasLegacyRegistration ? "internal" : "none",
    registrationOpen: hasLegacyRegistration
      ? Boolean(legacyEvent?.registration_open)
      : false,
    registrationUrl: null,
    startsAt,
    status:
      seedEvent.status ||
      (legacyEvent?.status &&
      ["draft", "published", "archived"].includes(legacyEvent.status)
        ? legacyEvent.status
        : "published"),
    timezone: seedEvent.timezone || "Asia/Dhaka",
    venueAddress: location.venueAddress,
    venueName: location.venueName,
  };
}

function normalizeLegacyTitle(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function dateFromTimestamp(value) {
  return String(value || "").slice(0, 10);
}

function matchLegacyEvent(seedEvent, legacyEventsBySlug, legacyEvents) {
  const slugMatch = legacyEventsBySlug.get(seedEvent.slug);

  if (slugMatch) {
    return {
      ambiguous: false,
      matchMethod: "slug",
      row: slugMatch,
    };
  }

  const normalizedTitle = normalizeLegacyTitle(seedEvent.title);
  const startDate = normalizeDate(seedEvent.startDate);
  const fallbackMatches = legacyEvents.filter((row) => {
    const rowDate = dateFromTimestamp(row.starts_at || row.published_at || "");
    return normalizeLegacyTitle(row.title) === normalizedTitle && rowDate === startDate;
  });

  if (!fallbackMatches.length) {
    return {
      ambiguous: false,
      matchMethod: "none",
      row: null,
    };
  }

  return {
    ambiguous: fallbackMatches.length > 1,
    matchMethod: "title-date",
    row: fallbackMatches[0],
  };
}

function buildEventRow(seedEvent, legacyEvent, legacyRegistrationCount, coverLookup) {
  const derived = deriveEventOperationalFields(
    seedEvent,
    legacyEvent,
    legacyRegistrationCount
  );

  return sanitizeForPostgres({
    body_markdown: seedEvent.bodyMarkdown || null,
    capacity: derived.capacity,
    category: seedEvent.category,
    cover_alt_text_override: coverLookup.coverAssetId
      ? `${seedEvent.title} cover image`
      : null,
    cover_media_asset_id: coverLookup.coverAssetId,
    cta_label: derived.ctaLabel,
    cta_url: derived.ctaUrl,
    delivery_mode: seedEvent.deliveryMode,
    ends_at: derived.endsAt,
    legacy_content_post_id: legacyEvent?.id || null,
    location_label: derived.locationLabel,
    location_mode: derived.locationMode,
    online_url: derived.onlineUrl,
    published_at: derived.publishedAt,
    registration_closes_at: derived.registrationClosesAt,
    registration_mode: derived.registrationMode,
    registration_open: derived.registrationOpen,
    registration_url: derived.registrationUrl,
    slug: seedEvent.slug,
    source: "event-catalog-seed",
    source_metadata: {
      coverResolution: coverLookup,
      legacy: legacyEvent
        ? {
            eventPostId: legacyEvent.id,
            matchedBy: legacyEvent._matchMethod || "unknown",
          }
        : null,
      seedEvent: seedEvent.sourceMetadata || null,
      seedGeneratedAt: seedEvent.seedGeneratedAt || null,
    },
    starts_at: derived.startsAt,
    status: derived.status,
    summary: seedEvent.summary,
    timezone: derived.timezone,
    title: sanitizeStringForPostgres(seedEvent.title),
    venue_address: derived.venueAddress,
    venue_name: derived.venueName,
  });
}

async function assertEventsSchemaReady(supabase) {
  const requiredQueries = [
    { select: "id", table: "events" },
    { select: "id, event_id", table: "event_registrations" },
    { select: "id, public_id", table: "media_assets" },
  ];
  const failures = [];

  for (const query of requiredQueries) {
    const { error } = await supabase
      .from(query.table)
      .select(query.select)
      .limit(1);

    if (error) {
      failures.push(`${query.table}: ${error.message}`);
    }
  }

  if (failures.length) {
    throw new Error(
      [
        "Events schema is not ready. Apply the required Supabase migrations before importing.",
        ...failures,
      ].join("\n")
    );
  }
}

async function fetchLegacyEvents(supabase) {
  const { data, error } = await supabase
    .from("content_posts")
    .select(
      [
        "id",
        "title",
        "slug",
        "summary",
        "body",
        "category",
        "status",
        "starts_at",
        "ends_at",
        "location",
        "media_asset_id",
        "cta_href",
        "registration_open",
        "registration_closes_at",
        "event_capacity",
        "published_at",
      ].join(", ")
    )
    .eq("content_type", "event");

  if (error) {
    throw new Error(`Legacy content_posts event lookup failed: ${error.message}`);
  }

  return data || [];
}

async function fetchExistingEvents(supabase, slugs) {
  const rows = [];

  for (const slugBatch of chunk(slugs, 100)) {
    const { data, error } = await supabase
      .from("events")
      .select("id, slug, legacy_content_post_id")
      .in("slug", slugBatch);

    if (error) {
      throw new Error(`Existing events lookup failed: ${error.message}`);
    }

    rows.push(...(data || []));
  }

  return rows;
}

async function fetchRegistrationRows(supabase, legacyEventIds) {
  const rows = [];

  for (const idBatch of chunk(legacyEventIds, 100)) {
    const { data, error } = await supabase
      .from("event_registrations")
      .select("id, event_post_id, event_id, registrant_email, cancelled_at, created_at")
      .in("event_post_id", idBatch);

    if (error) {
      throw new Error(`Event registrations lookup failed: ${error.message}`);
    }

    rows.push(...(data || []));
  }

  return rows;
}

async function fetchMediaAssetsByPublicIds(supabase, publicIds) {
  const rows = [];

  for (const idBatch of chunk(publicIds, 25)) {
    const { data, error } = await supabase
      .from("media_assets")
      .select("id, public_id, secure_url")
      .in("public_id", idBatch);

    if (error) {
      throw new Error(`Media asset lookup by public_id failed: ${error.message}`);
    }

    rows.push(...(data || []));
  }

  return rows;
}

async function fetchMediaAssetsByFolderPrefixes(supabase, prefixes) {
  const uniquePrefixes = Array.from(
    new Set(prefixes.map(normalizeCloudinaryFolder).filter(Boolean))
  );
  const rows = [];

  for (const prefix of uniquePrefixes) {
    const { data, error } = await supabase
      .from("media_assets")
      .select("id, public_id, secure_url")
      .ilike("public_id", `${prefix}/%`)
      .order("public_id", { ascending: true })
      .limit(5);

    if (error) {
      throw new Error(`Media asset lookup by folder prefix failed: ${error.message}`);
    }

    rows.push(...(data || []));
  }

  return rows;
}

function groupMediaAssetsByFolderPrefix(rows, prefixes) {
  const map = new Map();
  const normalizedPrefixes = Array.from(
    new Set(prefixes.map(normalizeCloudinaryFolder).filter(Boolean))
  );

  for (const prefix of normalizedPrefixes) {
    map.set(
      prefix,
      rows
        .filter((row) => row.public_id === prefix || row.public_id.startsWith(`${prefix}/`))
        .sort((left, right) => left.public_id.localeCompare(right.public_id))
    );
  }

  return map;
}

function buildCoverLookupMaps(events) {
  const directPublicIds = new Set();
  const folderPrefixes = new Set();

  for (const event of events) {
    const extracted = event.coverPublicId || extractCloudinaryPublicId(event.coverImageUrl);

    if (extracted) {
      directPublicIds.add(extracted);
    }

    const normalizedRaw = /^https?:\/\//i.test(String(event.coverImageUrl || "").trim())
      ? null
      : normalizeCloudinaryPublicId(event.coverImageUrl || "");

    if (normalizedRaw) {
      directPublicIds.add(normalizedRaw);
    }

    for (const folder of event.cloudinaryFolders || []) {
      const normalizedFolder = normalizeCloudinaryFolder(folder);

      if (normalizedFolder) {
        folderPrefixes.add(normalizedFolder);
      }
    }
  }

  return {
    folderPrefixes: Array.from(folderPrefixes),
    publicIds: Array.from(directPublicIds),
  };
}

function resolveCoverAsset(seedEvent, legacyEvent, mediaByPublicId, mediaByFolderPrefix) {
  const extractedPublicId =
    seedEvent.coverPublicId || extractCloudinaryPublicId(seedEvent.coverImageUrl);
  const normalizedRawInput =
    extractedPublicId ||
    (/^https?:\/\//i.test(String(seedEvent.coverImageUrl || "").trim())
      ? null
      : normalizeCloudinaryPublicId(seedEvent.coverImageUrl || ""));

  if (extractedPublicId && mediaByPublicId.has(extractedPublicId)) {
    const asset = mediaByPublicId.get(extractedPublicId);
    return {
      coverAssetId: asset.id,
      matchedPublicId: extractedPublicId,
      method: "exact-public-id",
      source: seedEvent.coverImageUrl,
    };
  }

  if (normalizedRawInput && mediaByPublicId.has(normalizedRawInput)) {
    const asset = mediaByPublicId.get(normalizedRawInput);
    return {
      coverAssetId: asset.id,
      matchedPublicId: normalizedRawInput,
      method: "normalized-raw-input",
      source: seedEvent.coverImageUrl,
    };
  }

  for (const folder of seedEvent.cloudinaryFolders || []) {
    const normalizedFolder = normalizeCloudinaryFolder(folder);
    const folderMatches = mediaByFolderPrefix.get(normalizedFolder) || [];

    if (folderMatches.length) {
      const asset = folderMatches[0];
      return {
        coverAssetId: asset.id,
        matchedPublicId: asset.public_id,
        method: "folder-prefix-fallback",
        source: normalizedFolder,
      };
    }
  }

  if (legacyEvent?.media_asset_id) {
    return {
      coverAssetId: legacyEvent.media_asset_id,
      matchedPublicId: null,
      method: "legacy-content-post-media-asset",
      source: legacyEvent.id,
    };
  }

  return {
    coverAssetId: null,
    matchedPublicId: extractedPublicId || normalizedRawInput || null,
    method: "unresolved",
    source: seedEvent.coverImageUrl || null,
  };
}

function buildRegistrationDuplicateConflicts(registrationRows, legacyEventIdBySlug) {
  const grouped = new Map();

  for (const row of registrationRows) {
    if (row.cancelled_at || !row.event_post_id) {
      continue;
    }

    const emailKey = String(row.registrant_email || "").trim().toLowerCase();
    const groupKey = `${row.event_post_id}::${emailKey}`;

    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, []);
    }

    grouped.get(groupKey).push(row);
  }

  const duplicates = [];

  for (const [key, rows] of grouped) {
    if (rows.length <= 1) {
      continue;
    }

    const [eventPostId, email] = key.split("::");
    const slug =
      Array.from(legacyEventIdBySlug.entries()).find(([, value]) => value === eventPostId)?.[0] ||
      null;

    duplicates.push({
      activeRegistrationIds: rows.map((row) => row.id),
      email,
      eventPostId,
      slug,
    });
  }

  return duplicates;
}

async function upsertEvents(supabase, rows) {
  for (const batch of chunk(rows, 50)) {
    const { error } = await supabase
      .from("events")
      .upsert(batch, { onConflict: "slug" });

    if (error) {
      throw new Error(`Event upsert failed: ${error.message}`);
    }
  }
}

async function fetchEventsBySlugs(supabase, slugs) {
  const rows = [];

  for (const slugBatch of chunk(slugs, 100)) {
    const { data, error } = await supabase
      .from("events")
      .select("id, slug, legacy_content_post_id, cover_media_asset_id")
      .in("slug", slugBatch);

    if (error) {
      throw new Error(`Imported events lookup failed: ${error.message}`);
    }

    rows.push(...(data || []));
  }

  return rows;
}

async function backfillRegistrationEventIds(supabase, eventRows, registrationRows) {
  const eventIdByLegacyEventPostId = new Map();

  for (const row of eventRows) {
    if (row.legacy_content_post_id) {
      eventIdByLegacyEventPostId.set(row.legacy_content_post_id, row.id);
    }
  }

  let updated = 0;

  for (const row of registrationRows) {
    const eventId = eventIdByLegacyEventPostId.get(row.event_post_id);

    if (!eventId || row.event_id === eventId) {
      continue;
    }

    const { error } = await supabase
      .from("event_registrations")
      .update({ event_id: eventId })
      .eq("id", row.id);

    if (error) {
      throw new Error(`Event registration backfill failed for ${row.id}: ${error.message}`);
    }

    updated += 1;
  }

  return updated;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const seed = readSeed(options.file);
  const reportPath = resolveEventsReportPath(options.report);
  const report = {
    coverage: {
      ambiguousLegacyMatches: [],
      duplicateRegistrationConflicts: [],
      exactCoverMatches: 0,
      folderFallbackCoverMatches: 0,
      legacyMatches: {
        none: 0,
        slug: 0,
        "title-date": 0,
      },
      legacyMediaFallbackMatches: 0,
      unresolvedCovers: [],
    },
    execution: {
      eventsInserted: 0,
      eventsUpdated: 0,
      registrationsBackfilled: 0,
    },
    expected: {
      eventCount: seed.summary?.eventCount ?? seed.events.length,
    },
    generatedAt: new Date().toISOString(),
    mode: options.apply ? "apply" : "dry-run",
    source: {
      filePath: options.file,
      seedGeneratedAt: seed.generatedAt || null,
    },
    validation: {
      errors: validateSeedEvents(seed.events),
    },
  };

  const supabase = buildSupabaseAdminClient();
  await assertEventsSchemaReady(supabase);

  const events = seed.events || [];
  const slugs = events.map((event) => event.slug);
  const existingEvents = await fetchExistingEvents(supabase, slugs);
  const existingEventBySlug = new Map(existingEvents.map((row) => [row.slug, row]));
  const legacyEvents = await fetchLegacyEvents(supabase);
  const legacyEventsBySlug = new Map(legacyEvents.map((row) => [row.slug, row]));
  const coverLookupInputs = buildCoverLookupMaps(events);
  const mediaAssets = await fetchMediaAssetsByPublicIds(
    supabase,
    coverLookupInputs.publicIds
  );
  const mediaByPublicId = new Map(mediaAssets.map((row) => [row.public_id, row]));
  const folderPrefixRows = await fetchMediaAssetsByFolderPrefixes(
    supabase,
    coverLookupInputs.folderPrefixes
  );
  const mediaByFolderPrefix = groupMediaAssetsByFolderPrefix(
    folderPrefixRows,
    coverLookupInputs.folderPrefixes
  );

  const matchedLegacyIds = [];
  const matchedLegacyIdBySlug = new Map();
  const eventRows = [];
  const coverResolutionBySlug = new Map();
  const legacyRegistrationCountByEventPostId = new Map();

  for (const event of events) {
    const legacyMatch = matchLegacyEvent(event, legacyEventsBySlug, legacyEvents);
    const legacyEvent = legacyMatch.row
      ? { ...legacyMatch.row, _matchMethod: legacyMatch.matchMethod }
      : null;

    report.coverage.legacyMatches[legacyMatch.matchMethod] += 1;

    if (legacyMatch.ambiguous) {
      report.coverage.ambiguousLegacyMatches.push({
        chosenLegacyContentPostId: legacyEvent.id,
        slug: event.slug,
        title: event.title,
      });
    }

    if (legacyEvent?.id) {
      matchedLegacyIds.push(legacyEvent.id);
      matchedLegacyIdBySlug.set(event.slug, legacyEvent.id);
    }

    coverResolutionBySlug.set(
      event.slug,
      resolveCoverAsset(event, legacyEvent, mediaByPublicId, mediaByFolderPrefix)
    );
  }

  const registrationRows = matchedLegacyIds.length
    ? await fetchRegistrationRows(supabase, Array.from(new Set(matchedLegacyIds)))
    : [];

  for (const row of registrationRows) {
    const current = legacyRegistrationCountByEventPostId.get(row.event_post_id) || 0;
    legacyRegistrationCountByEventPostId.set(row.event_post_id, current + 1);
  }

  report.coverage.duplicateRegistrationConflicts = buildRegistrationDuplicateConflicts(
    registrationRows,
    matchedLegacyIdBySlug
  );

  if (report.coverage.duplicateRegistrationConflicts.length) {
    report.validation.errors.push(
      `Found ${report.coverage.duplicateRegistrationConflicts.length} duplicate active registration group(s); event_id backfill would violate the partial unique index.`
    );
  }

  for (const event of events) {
    const legacyMatch = matchLegacyEvent(event, legacyEventsBySlug, legacyEvents);
    const legacyEvent = legacyMatch.row
      ? { ...legacyMatch.row, _matchMethod: legacyMatch.matchMethod }
      : null;
    const coverLookup = coverResolutionBySlug.get(event.slug);

    if (coverLookup.method === "exact-public-id" || coverLookup.method === "normalized-raw-input") {
      report.coverage.exactCoverMatches += 1;
    } else if (coverLookup.method === "folder-prefix-fallback") {
      report.coverage.folderFallbackCoverMatches += 1;
    } else if (coverLookup.method === "legacy-content-post-media-asset") {
      report.coverage.legacyMediaFallbackMatches += 1;
    } else {
      report.coverage.unresolvedCovers.push({
        coverImageUrl: event.coverImageUrl || null,
        slug: event.slug,
        title: event.title,
      });
    }

    const legacyRegistrationCount = legacyEvent?.id
      ? legacyRegistrationCountByEventPostId.get(legacyEvent.id) || 0
      : 0;

    eventRows.push(
      buildEventRow(event, legacyEvent, legacyRegistrationCount, coverLookup)
    );

    if (existingEventBySlug.has(event.slug)) {
      report.execution.eventsUpdated += 1;
    } else {
      report.execution.eventsInserted += 1;
    }
  }

  if (report.validation.errors.length) {
    writeJsonReport(reportPath, report);
    throw new Error(
      [
        "Event seed validation failed.",
        ...report.validation.errors,
        `Report: ${reportPath}`,
      ].join("\n")
    );
  }

  if (!options.apply) {
    const importedEvents = await fetchEventsBySlugs(supabase, slugs);
    const eventIdByLegacyEventPostId = new Map();

    for (const row of importedEvents) {
      if (row.legacy_content_post_id) {
        eventIdByLegacyEventPostId.set(row.legacy_content_post_id, row.id);
      }
    }

    report.execution.registrationsBackfilled = registrationRows.filter((row) => {
      const eventId = eventIdByLegacyEventPostId.get(row.event_post_id);
      return Boolean(eventId && row.event_id !== eventId);
    }).length;

    writeJsonReport(reportPath, report);
    console.log(
      `Events seed dry-run: ${report.expected.eventCount} events, ${report.execution.eventsInserted} inserts, ${report.execution.eventsUpdated} updates, ${report.coverage.unresolvedCovers.length} unresolved covers. Report: ${reportPath}`
    );
    return;
  }

  await upsertEvents(supabase, eventRows);
  const importedEvents = await fetchEventsBySlugs(supabase, slugs);
  report.execution.registrationsBackfilled = await backfillRegistrationEventIds(
    supabase,
    importedEvents,
    registrationRows
  );

  writeJsonReport(reportPath, report);
  console.log(
    `Events seed imported: ${report.expected.eventCount} events (${report.execution.eventsInserted} inserted, ${report.execution.eventsUpdated} updated). Backfilled ${report.execution.registrationsBackfilled} registrations. Report: ${reportPath}`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
