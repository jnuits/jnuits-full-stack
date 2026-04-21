#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  deriveSummary,
  ensureDirectory,
  normalizeCloudinaryPublicId,
} from "./lib/legacy-content.mjs";

const ROOT = process.cwd();
const DEFAULT_CATALOG_PATH = path.join(
  ROOT,
  "plan",
  "data",
  "jnuits-event-catalog.json"
);
const DEFAULT_INSIGHTS_PATH = path.join(
  ROOT,
  "plan",
  "JNUITS_EVENT_HISTORY_INSIGHTS.md"
);
const DEFAULT_OUTPUT_PATH = path.join(
  ROOT,
  "plan",
  "data",
  "jnuits-events-seed.json"
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
    catalog: DEFAULT_CATALOG_PATH,
    insights: DEFAULT_INSIGHTS_PATH,
    output: DEFAULT_OUTPUT_PATH,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--catalog" && argv[index + 1]) {
      options.catalog = path.resolve(ROOT, argv[index + 1]);
      index += 1;
      continue;
    }

    if (token.startsWith("--catalog=")) {
      options.catalog = path.resolve(ROOT, token.split("=")[1] || "");
      continue;
    }

    if (token === "--insights" && argv[index + 1]) {
      options.insights = path.resolve(ROOT, argv[index + 1]);
      index += 1;
      continue;
    }

    if (token.startsWith("--insights=")) {
      options.insights = path.resolve(ROOT, token.split("=")[1] || "");
      continue;
    }

    if (token === "--out" && argv[index + 1]) {
      options.output = path.resolve(ROOT, argv[index + 1]);
      index += 1;
      continue;
    }

    if (token.startsWith("--out=")) {
      options.output = path.resolve(ROOT, token.split("=")[1] || "");
    }
  }

  return options;
}

function readJson(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} file not found: ${filePath}`);
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readText(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} file not found: ${filePath}`);
  }

  return fs.readFileSync(filePath, "utf8");
}

function normalizeDate(value) {
  const text = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function parseInsightsSummary(markdown) {
  const lines = markdown.split(/\r?\n/);
  const summary = {
    byCategory: {},
    byDeliveryMode: {},
    byYear: {},
    eventCount: null,
  };

  let currentSection = "";

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    const eventCountMatch = line.match(/^- Event records prepared:\s*(\d+)/i);

    if (eventCountMatch) {
      summary.eventCount = Number(eventCountMatch[1]);
      continue;
    }

    if (/^By year:/i.test(line)) {
      currentSection = "byYear";
      continue;
    }

    if (/^By category:/i.test(line)) {
      currentSection = "byCategory";
      continue;
    }

    if (/^By delivery mode:/i.test(line)) {
      currentSection = "byDeliveryMode";
      continue;
    }

    if (currentSection && line.startsWith("- ")) {
      const pair = line.slice(2).split(":");

      if (pair.length >= 2) {
        const key = pair.shift().trim();
        const value = Number(pair.join(":").trim());

        if (Number.isFinite(value)) {
          summary[currentSection][key] = value;
        }
      }

      continue;
    }

    currentSection = "";
  }

  return summary;
}

function compareMaps(expected, actual) {
  const keys = Array.from(
    new Set([...Object.keys(expected || {}), ...Object.keys(actual || {})])
  ).sort();
  const mismatches = [];

  for (const key of keys) {
    if (Number(expected?.[key] ?? 0) !== Number(actual?.[key] ?? 0)) {
      mismatches.push({
        actual: Number(actual?.[key] ?? 0),
        expected: Number(expected?.[key] ?? 0),
        key,
      });
    }
  }

  return mismatches;
}

function validateCatalogEvents(events) {
  const errors = [];
  const slugCounts = new Map();

  for (const event of events) {
    const identifier = event.slug || event.title || "unknown";

    if (event.slug?.trim()) {
      slugCounts.set(event.slug, (slugCounts.get(event.slug) || 0) + 1);
    } else {
      errors.push(`Catalog event "${identifier}" is missing slug.`);
    }

    if (!event.title?.trim()) {
      errors.push(`Catalog event "${identifier}" is missing title.`);
    }

    if (!CATEGORY_SET.has(event.category)) {
      errors.push(
        `Catalog event "${identifier}" has unsupported category "${event.category}".`
      );
    }

    if (!DELIVERY_MODE_SET.has(event.deliveryMode)) {
      errors.push(
        `Catalog event "${identifier}" has unsupported delivery mode "${event.deliveryMode}".`
      );
    }

    const startDate = normalizeDate(event.startDate);
    const endDate = normalizeDate(event.endDate || event.startDate);

    if (!startDate) {
      errors.push(`Catalog event "${identifier}" has an invalid startDate.`);
    }

    if (event.endDate && !endDate) {
      errors.push(`Catalog event "${identifier}" has an invalid endDate.`);
    }

    if (startDate && endDate && endDate < startDate) {
      errors.push(`Catalog event "${identifier}" ends before it starts.`);
    }
  }

  for (const [slug, count] of slugCounts) {
    if (count > 1) {
      errors.push(`Catalog contains duplicate slug "${slug}" (${count} records).`);
    }
  }

  return errors;
}

function buildComputedSummary(events) {
  const byCategory = {};
  const byDeliveryMode = {};
  const byYear = {};

  for (const event of events) {
    byCategory[event.category] = (byCategory[event.category] || 0) + 1;
    byDeliveryMode[event.deliveryMode] =
      (byDeliveryMode[event.deliveryMode] || 0) + 1;
    byYear[String(event.year)] = (byYear[String(event.year)] || 0) + 1;
  }

  return {
    byCategory,
    byDeliveryMode,
    byYear,
    eventCount: events.length,
  };
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
      /^[a-z]{1,3}_[^/]+(?:,[a-z]{1,3}_[^/]+)*$/i.test(assetSegments[0])
    ) {
      assetSegments = assetSegments.slice(1);
    }

    if (assetSegments[0] && /^v\d+$/i.test(assetSegments[0])) {
      assetSegments = assetSegments.slice(1);
    }

    if (!assetSegments.length) {
      return null;
    }

    assetSegments[assetSegments.length - 1] = assetSegments
      .at(-1)
      .replace(/\.[^.]+$/, "");

    return normalizeCloudinaryPublicId(assetSegments.join("/")) || null;
  } catch {
    if (/^https?:\/\//i.test(raw)) {
      return null;
    }

    return normalizeCloudinaryPublicId(raw) || null;
  }
}

function titleCaseLabel(value) {
  return String(value || "")
    .split("-")
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function buildBodyMarkdown(event) {
  const sections = [];
  const description = String(event.description || "").trim();

  if (description) {
    sections.push(description);
  }

  const metadataLines = [];
  metadataLines.push(`- Event type: ${titleCaseLabel(event.category)}`);
  metadataLines.push(`- Delivery mode: ${titleCaseLabel(event.deliveryMode)}`);

  if (event.startDate && event.endDate && event.startDate !== event.endDate) {
    metadataLines.push(`- Date: ${event.startDate} to ${event.endDate}`);
  } else if (event.startDate) {
    metadataLines.push(`- Date: ${event.startDate}`);
  }

  if (metadataLines.length) {
    sections.push(metadataLines.join("\n"));
  }

  return sections.join("\n\n");
}

function buildSeedEvent(event, catalogGeneratedAt) {
  return {
    bodyMarkdown: buildBodyMarkdown(event),
    category: event.category,
    cloudinaryFolders: Array.isArray(event.cloudinaryFolders)
      ? event.cloudinaryFolders.map((folder) =>
          normalizeCloudinaryPublicId(folder || "")
        ).filter(Boolean)
      : [],
    coverImageUrl: String(event.coverImageUrl || "").trim() || null,
    coverPublicId: extractCloudinaryPublicId(event.coverImageUrl),
    deliveryMode: event.deliveryMode,
    endDate: normalizeDate(event.endDate || event.startDate) || null,
    slug: String(event.slug || "").trim(),
    sourceMetadata: {
      catalogEvent: event,
      catalogGeneratedAt: catalogGeneratedAt || null,
      insightsValidated: true,
    },
    sourceTypes: Array.isArray(event.sourceTypes) ? event.sourceTypes : [],
    startDate: normalizeDate(event.startDate) || null,
    status: "published",
    summary: deriveSummary(event.description || event.title || "", 220),
    timezone: "Asia/Dhaka",
    title: String(event.title || "").trim(),
    year: Number(event.year),
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const catalog = readJson(options.catalog, "Event catalog");
  const insightsMarkdown = readText(options.insights, "Event insights");
  const events = Array.isArray(catalog.events) ? catalog.events : null;

  if (!events) {
    throw new Error("Event catalog must include an events array.");
  }

  const errors = [];
  errors.push(...validateCatalogEvents(events));

  const computedSummary = buildComputedSummary(events);
  const catalogSummary = catalog.summary || {};
  const insightsSummary = parseInsightsSummary(insightsMarkdown);

  if (
    Number(catalogSummary.eventCount ?? computedSummary.eventCount) !==
    computedSummary.eventCount
  ) {
    errors.push(
      `Catalog summary eventCount (${catalogSummary.eventCount}) does not match computed event count (${computedSummary.eventCount}).`
    );
  }

  if (
    insightsSummary.eventCount !== null &&
    insightsSummary.eventCount !== computedSummary.eventCount
  ) {
    errors.push(
      `Insights summary event count (${insightsSummary.eventCount}) does not match computed event count (${computedSummary.eventCount}).`
    );
  }

  for (const [label, expected, actual] of [
    ["byYear", computedSummary.byYear, catalogSummary.byYear || {}],
    ["byCategory", computedSummary.byCategory, catalogSummary.byCategory || {}],
    [
      "byDeliveryMode",
      computedSummary.byDeliveryMode,
      catalogSummary.byDeliveryMode || {},
    ],
  ]) {
    for (const mismatch of compareMaps(expected, actual)) {
      errors.push(
        `Catalog summary ${label} mismatch for "${mismatch.key}": expected=${mismatch.expected}, actual=${mismatch.actual}.`
      );
    }
  }

  for (const [label, expected, actual] of [
    ["byYear", computedSummary.byYear, insightsSummary.byYear || {}],
    ["byCategory", computedSummary.byCategory, insightsSummary.byCategory || {}],
    [
      "byDeliveryMode",
      computedSummary.byDeliveryMode,
      insightsSummary.byDeliveryMode || {},
    ],
  ]) {
    for (const mismatch of compareMaps(expected, actual)) {
      errors.push(
        `Insights ${label} mismatch for "${mismatch.key}": expected=${mismatch.expected}, actual=${mismatch.actual}.`
      );
    }
  }

  if (errors.length) {
    throw new Error(["Events seed build validation failed.", ...errors].join("\n"));
  }

  const seed = {
    generatedAt: new Date().toISOString(),
    source: {
      catalogGeneratedAt: catalog.generatedAt || null,
      catalogPath: path.relative(ROOT, options.catalog).replace(/\\/g, "/"),
      insightsPath: path.relative(ROOT, options.insights).replace(/\\/g, "/"),
    },
    summary: computedSummary,
    validation: {
      insightsSummary,
    },
    events: events.map((event) => buildSeedEvent(event, catalog.generatedAt)),
  };

  ensureDirectory(path.dirname(options.output));
  fs.writeFileSync(options.output, `${JSON.stringify(seed, null, 2)}\n`, "utf8");
  console.log(
    `Events seed written: ${path.relative(ROOT, options.output)} (${seed.summary.eventCount} events)`
  );
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
