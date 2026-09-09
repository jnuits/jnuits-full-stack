import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  AI_IT_FEST_2026_CAMPAIGN_ID,
  AI_IT_FEST_2026_EVENTS,
  AI_IT_FEST_2026_MEDIA,
} from "./data/ai-it-fest-2026-events.mjs";

const EVENT_READBACK_FIELDS = [
  "body_markdown",
  "capacity",
  "category",
  "cover_alt_text_override",
  "cover_media_asset_id",
  "cta_label",
  "cta_url",
  "delivery_mode",
  "ends_at",
  "location_label",
  "location_mode",
  "online_url",
  "published_at",
  "registration_closes_at",
  "registration_mode",
  "registration_open",
  "registration_url",
  "slug",
  "source",
  "source_metadata",
  "starts_at",
  "status",
  "summary",
  "timezone",
  "title",
  "venue_address",
  "venue_name",
];
const DATE_FIELDS = new Set([
  "ends_at",
  "published_at",
  "registration_closes_at",
  "starts_at",
]);

function campaignIdFrom(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value.campaignId
    : null;
}

function displayValue(value) {
  return JSON.stringify(value === undefined ? null : value);
}

function normalizeJson(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeJson);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, normalizeJson(value[key])])
    );
  }

  return value;
}

function comparableValue(field, value) {
  if (DATE_FIELDS.has(field)) {
    return value === null || value === undefined
      ? null
      : new Date(value).toISOString();
  }

  if (field === "source_metadata") {
    return JSON.stringify(normalizeJson(value || {}));
  }

  return value ?? null;
}

export function buildEventRows(
  assetIds,
  status = "draft",
  publishedAt = new Date().toISOString()
) {
  if (!(assetIds instanceof Map)) {
    throw new TypeError("assetIds must be a Map keyed by manifest media key.");
  }

  if (status !== "draft" && status !== "published") {
    throw new Error(`Unsupported event status "${status}".`);
  }

  return AI_IT_FEST_2026_EVENTS.map((event) => {
    const coverMediaAssetId = assetIds.get(event.mediaKey);

    if (!coverMediaAssetId) {
      throw new Error(`Missing media asset ID for "${event.mediaKey}".`);
    }

    return {
      body_markdown: event.bodyMarkdown,
      capacity: event.capacity,
      category: event.category,
      cover_alt_text_override: event.coverAltTextOverride,
      cover_media_asset_id: coverMediaAssetId,
      cta_label: event.ctaLabel,
      cta_url: event.ctaUrl,
      delivery_mode: event.deliveryMode,
      ends_at: event.endsAt,
      location_label: event.locationLabel,
      location_mode: event.locationMode,
      online_url: event.onlineUrl,
      published_at: status === "published" ? publishedAt : null,
      registration_closes_at: event.registrationClosesAt,
      registration_mode: event.registrationMode,
      registration_open: event.registrationOpen,
      registration_url: event.registrationUrl,
      slug: event.slug,
      source: event.source,
      source_metadata: event.sourceMetadata,
      starts_at: event.startsAt,
      status,
      summary: event.summary,
      timezone: event.timezone,
      title: event.title,
      venue_address: event.venueAddress,
      venue_name: event.venueName,
    };
  });
}

export function findContentConflicts(
  existingRows,
  manifest = AI_IT_FEST_2026_EVENTS
) {
  const manifestBySlug = new Map(manifest.map((event) => [event.slug, event]));
  const manifestByTitle = new Map(manifest.map((event) => [event.title, event]));
  const conflicts = [];

  for (const row of existingRows || []) {
    const slugMatch = manifestBySlug.get(row.slug);
    const titleMatch = manifestByTitle.get(row.title);

    if (!slugMatch && !titleMatch) {
      continue;
    }

    const taskOwned =
      campaignIdFrom(row.source_metadata) === AI_IT_FEST_2026_CAMPAIGN_ID;
    const exactIdentity =
      slugMatch && titleMatch && slugMatch.slug === titleMatch.slug;

    if (!taskOwned || !exactIdentity) {
      conflicts.push({
        id: row.id,
        reason: !taskOwned
          ? slugMatch
            ? "slug"
            : "title"
          : "identity",
        slug: row.slug,
        title: row.title,
      });
    }
  }

  return conflicts;
}

export function findMediaConflicts(
  existingRows,
  manifest = AI_IT_FEST_2026_MEDIA
) {
  const publicIds = new Set(manifest.map((asset) => asset.publicId));

  return (existingRows || []).flatMap((row) => {
    if (!publicIds.has(row.public_id)) {
      return [];
    }

    return campaignIdFrom(row.metadata) === AI_IT_FEST_2026_CAMPAIGN_ID
      ? []
      : [
          {
            id: row.id,
            publicId: row.public_id,
            reason: "public_id",
          },
        ];
  });
}

export function findStoredEventMismatches(storedRows, expectedRows) {
  const storedBySlug = new Map((storedRows || []).map((row) => [row.slug, row]));
  const mismatches = [];

  for (const expected of expectedRows) {
    const stored = storedBySlug.get(expected.slug);

    if (!stored) {
      mismatches.push(`Stored event "${expected.slug}" is missing.`);
      continue;
    }

    for (const field of EVENT_READBACK_FIELDS) {
      const actualValue = comparableValue(field, stored[field]);
      const expectedValue = comparableValue(field, expected[field]);

      if (actualValue !== expectedValue) {
        mismatches.push(
          `Stored event "${expected.slug}" has ${field} ${displayValue(
            stored[field]
          )}; expected ${displayValue(expected[field])}.`
        );
      }
    }
  }

  return mismatches;
}

export function validateOfficialApiSnapshot(payload) {
  if (!payload?.success || !Array.isArray(payload.data)) {
    return ["Official Fest API did not return a successful event array."];
  }

  const apiRowsById = new Map(payload.data.map((row) => [row.id, row]));
  const errors = [];

  for (const event of AI_IT_FEST_2026_EVENTS.slice(1)) {
    const metadata = event.sourceMetadata;
    const apiRow = apiRowsById.get(metadata.officialApiId);

    if (!apiRow) {
      errors.push(
        `Official API event "${metadata.officialApiSlug}" (${metadata.officialApiId}) is missing.`
      );
      continue;
    }

    const expectedDeadline =
      event.slug === "brainchild-season-2-0"
        ? metadata.secondaryDeadlineSourceValue
        : metadata.deadlineSourceValue;

    if (apiRow.slug !== metadata.officialApiSlug) {
      errors.push(
        `Official API slug changed for "${event.slug}": expected "${metadata.officialApiSlug}", received "${apiRow.slug}".`
      );
    }

    if (apiRow.deadline !== expectedDeadline) {
      errors.push(
        `Official API deadline changed for "${metadata.officialApiSlug}": expected "${expectedDeadline}", received "${apiRow.deadline}".`
      );
    }

    if (apiRow.eventDate !== metadata.sourceEventDateValue) {
      errors.push(
        `Official API event date changed for "${metadata.officialApiSlug}": expected "${metadata.sourceEventDateValue}", received "${apiRow.eventDate}".`
      );
    }

    if (
      event.slug !== "brainchild-season-2-0" &&
      apiRow.coverImage !==
        AI_IT_FEST_2026_MEDIA.find((asset) => asset.key === event.mediaKey)
          ?.sourceUrl
    ) {
      errors.push(`Official API cover changed for "${metadata.officialApiSlug}".`);
    }
  }

  return errors;
}

export function validateBrainchildSourceHtml(html) {
  const exactDeadline = "2026-08-20T23:59:59+06:00";

  return String(html || "").includes(exactDeadline)
    ? []
    : [
        `Dedicated BrainChild source no longer contains "${exactDeadline}".`,
      ];
}

function assertQuery(result, operation) {
  if (result.error) {
    throw new Error(`${operation}: ${result.error.message || "Unknown error."}`);
  }

  return result.data || [];
}

function deduplicateById(rows) {
  return Array.from(new Map(rows.map((row) => [row.id, row])).values());
}

async function fetchExistingEvents(supabase) {
  const select =
    "id, slug, title, status, published_at, cover_media_asset_id, source_metadata";
  const slugs = AI_IT_FEST_2026_EVENTS.map((event) => event.slug);
  const titles = AI_IT_FEST_2026_EVENTS.map((event) => event.title);
  const [slugResult, titleResult] = await Promise.all([
    supabase.from("events").select(select).in("slug", slugs),
    supabase.from("events").select(select).in("title", titles),
  ]);

  return deduplicateById([
    ...assertQuery(slugResult, "Fest event slug preflight failed"),
    ...assertQuery(titleResult, "Fest event title preflight failed"),
  ]);
}

async function fetchExistingMedia(supabase) {
  const result = await supabase
    .from("media_assets")
    .select("id, public_id, secure_url, thumbnail_url, metadata")
    .in(
      "public_id",
      AI_IT_FEST_2026_MEDIA.map((asset) => asset.publicId)
    );

  return assertQuery(result, "Fest media preflight failed");
}

async function verifyOfficialSources() {
  const officialApiUrl = "https://festapi.jnuits.org.bd/api/events";
  const brainchildUrl = "https://brainchild.jnuits.org.bd/";
  const destinations = [
    "https://itfest.jnuits.org.bd/",
    "https://itfest.jnuits.org.bd/events",
    "https://itfest.jnuits.org.bd/events/ai-it-olympiad",
    "https://itfest.jnuits.org.bd/events/techuncut",
    "https://itfest.jnuits.org.bd/events/techcare-zone",
    "https://itfest.jnuits.org.bd/events/ai-ad-venture",
    brainchildUrl,
    "https://brainchild.jnuits.org.bd/register",
    "https://brainchild.jnuits.org.bd/track",
    "https://drive.google.com/file/d/1txSeyWJIOFxNW3XFUmjYZMrkN6uEemFj/view?usp=sharing",
    officialApiUrl,
  ];
  const responses = await Promise.all(
    destinations.map(async (url) => {
      const response = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(20_000),
      });

      if (!response.ok) {
        throw new Error(`Official source ${url} returned HTTP ${response.status}.`);
      }

      return [url, response];
    })
  );
  const responseByUrl = new Map(responses);
  const apiPayload = await responseByUrl.get(officialApiUrl).json();
  const brainchildHtml = await responseByUrl.get(brainchildUrl).text();
  const errors = [
    ...validateOfficialApiSnapshot(apiPayload),
    ...validateBrainchildSourceHtml(brainchildHtml),
  ];

  if (errors.length > 0) {
    throw new Error(`Official source verification failed:\n- ${errors.join("\n- ")}`);
  }
}

function ownedEventBySlug(existingEvents) {
  return new Map(
    existingEvents
      .filter(
        (row) =>
          campaignIdFrom(row.source_metadata) === AI_IT_FEST_2026_CAMPAIGN_ID
      )
      .map((row) => [row.slug, row])
  );
}

function ownedMediaByPublicId(existingMedia) {
  return new Map(
    existingMedia
      .filter(
        (row) =>
          campaignIdFrom(row.metadata) === AI_IT_FEST_2026_CAMPAIGN_ID
      )
      .map((row) => [row.public_id, row])
  );
}

function formatConflicts(eventConflicts, mediaConflicts) {
  return [
    ...eventConflicts.map(
      (conflict) =>
        `event ${conflict.id} collides by ${conflict.reason} (${conflict.slug} / ${conflict.title})`
    ),
    ...mediaConflicts.map(
      (conflict) =>
        `media ${conflict.id} collides by ${conflict.reason} (${conflict.publicId})`
    ),
  ];
}

function buildPlan(existingEvents, existingMedia, publish) {
  const eventsBySlug = ownedEventBySlug(existingEvents);
  const mediaByPublicId = ownedMediaByPublicId(existingMedia);

  return {
    events: AI_IT_FEST_2026_EVENTS.map((event) => ({
      action: eventsBySlug.has(event.slug)
        ? publish
          ? "publish"
          : "update-draft"
        : "create-draft",
      existingId: eventsBySlug.get(event.slug)?.id || null,
      slug: event.slug,
    })),
    media: AI_IT_FEST_2026_MEDIA.map((asset) => ({
      action: mediaByPublicId.has(asset.publicId) ? "reuse" : "copy-and-create",
      existingId: mediaByPublicId.get(asset.publicId)?.id || null,
      publicId: asset.publicId,
    })),
  };
}

async function saveEventRow(supabase, row, existing) {
  const query = existing
    ? supabase.from("events").update(row).eq("id", existing.id)
    : supabase.from("events").insert(row);
  const result = await query
    .select("id, slug, title, status, published_at, created_at, updated_at")
    .single();

  if (result.error || !result.data) {
    throw new Error(
      `Unable to ${existing ? "update" : "create"} event "${row.slug}": ${
        result.error?.message || "No row returned."
      }`
    );
  }

  return result.data;
}

export async function runFest2026ContentOperator({
  apply = false,
  publish = false,
} = {}) {
  if (publish && !apply) {
    throw new Error("--publish requires --apply.");
  }

  const { buildSupabaseAdminClient, ensureCloudinaryImageAsset } = await import(
    "./lib/legacy-content.mjs"
  );
  const supabase = buildSupabaseAdminClient();
  const [existingEvents, existingMedia] = await Promise.all([
    fetchExistingEvents(supabase),
    fetchExistingMedia(supabase),
  ]);
  const eventConflicts = findContentConflicts(existingEvents);
  const mediaConflicts = findMediaConflicts(existingMedia);
  const conflicts = formatConflicts(eventConflicts, mediaConflicts);

  if (conflicts.length > 0) {
    throw new Error(`Fest content preflight refused to continue:\n- ${conflicts.join("\n- ")}`);
  }

  const plan = buildPlan(existingEvents, existingMedia, publish);

  if (!apply) {
    return {
      campaignId: AI_IT_FEST_2026_CAMPAIGN_ID,
      mode: "dry-run",
      plan,
      targetStatus: "draft",
    };
  }

  const existingEventsBySlug = ownedEventBySlug(existingEvents);
  const existingMediaByPublicId = ownedMediaByPublicId(existingMedia);

  if (
    publish &&
    (existingEventsBySlug.size !== AI_IT_FEST_2026_EVENTS.length ||
      existingMediaByPublicId.size !== AI_IT_FEST_2026_MEDIA.length)
  ) {
    throw new Error(
      "Publication requires all six task-owned draft events and media assets to exist first."
    );
  }

  await verifyOfficialSources();

  const assetIds = new Map();
  const savedMedia = [];

  for (const asset of AI_IT_FEST_2026_MEDIA) {
    const existing = existingMediaByPublicId.get(asset.publicId);
    const saved =
      existing ||
      (await ensureCloudinaryImageAsset({
        altText: asset.altText,
        metadata: asset.metadata,
        publicId: asset.publicId,
        source: { kind: "remote", value: asset.sourceUrl },
        supabase,
        title: asset.title,
      }));

    assetIds.set(asset.key, saved.id);
    savedMedia.push({ id: saved.id, publicId: saved.public_id });
  }

  const publicationTimestamp = new Date().toISOString();
  const requestedStatus = publish ? "published" : "draft";
  const requestedRows = buildEventRows(
    assetIds,
    requestedStatus,
    publicationTimestamp
  );
  const expectedRows = [];
  const savedEvents = [];

  for (const requestedRow of requestedRows) {
    const existing = existingEventsBySlug.get(requestedRow.slug);
    const preservePublished = !publish && existing?.status === "published";
    const row = preservePublished
      ? {
          ...requestedRow,
          published_at: existing.published_at,
          status: "published",
        }
      : requestedRow;

    expectedRows.push(row);
    savedEvents.push(await saveEventRow(supabase, row, existing));
  }

  const readbackResult = await supabase
    .from("events")
    .select(`id, ${EVENT_READBACK_FIELDS.join(", ")}`)
    .in(
      "slug",
      AI_IT_FEST_2026_EVENTS.map((event) => event.slug)
    );
  const storedRows = assertQuery(readbackResult, "Fest event read-back failed");
  const mismatches = findStoredEventMismatches(storedRows, expectedRows);

  if (mismatches.length > 0) {
    throw new Error(`Fest event read-back verification failed:\n- ${mismatches.join("\n- ")}`);
  }

  return {
    campaignId: AI_IT_FEST_2026_CAMPAIGN_ID,
    events: savedEvents,
    media: savedMedia,
    mode: publish ? "publish" : "apply-drafts",
    plan,
    targetStatus: requestedStatus,
    verifiedStoredRows: storedRows.map((row) => ({
      id: row.id,
      publishedAt: row.published_at,
      slug: row.slug,
      status: row.status,
    })),
  };
}

function parseArgs(argv) {
  const options = { apply: false, publish: false };

  for (const token of argv) {
    if (token === "--apply") {
      options.apply = true;
      continue;
    }

    if (token === "--dry-run") {
      options.apply = false;
      options.publish = false;
      continue;
    }

    if (token === "--publish") {
      options.publish = true;
      continue;
    }

    throw new Error(`Unknown argument "${token}".`);
  }

  return options;
}

async function main() {
  const report = await runFest2026ContentOperator(
    parseArgs(process.argv.slice(2))
  );
  console.log(JSON.stringify(report, null, 2));
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
