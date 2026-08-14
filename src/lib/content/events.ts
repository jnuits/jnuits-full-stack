import "server-only";

import { cache } from "react";
import { transformCloudinaryUrl } from "@/lib/cloudinary/urls";
import {
  EVENT_CATEGORIES,
  EVENT_DELIVERY_MODES,
  EVENT_LOCATION_MODES,
  EVENT_MEDIA_PICKER_PAGE_SIZE,
  EVENT_REGISTRATION_MODES,
  EVENTS_PER_PAGE,
  EVENT_STATUSES,
  stripEventMetadataTrailer,
  formatTag,
  toEventCategoryLabel,
  toEventDeliveryModeLabel,
  type EventArchiveView,
  type EventRichTextFormat,
} from "@/lib/content/events-shared";
import { sanitizeEventHtml } from "@/lib/content/sanitize-event-html";
import type { Tables } from "@/lib/db/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";
import { createPublicClient } from "@/lib/supabase/public";

export {
  EVENT_CATEGORIES,
  EVENT_DELIVERY_MODES,
  EVENT_LOCATION_MODES,
  EVENT_MEDIA_PICKER_PAGE_SIZE,
  EVENT_REGISTRATION_MODES,
  EVENTS_PER_PAGE,
  EVENT_STATUSES,
  stripEventMetadataTrailer,
  formatTag,
  toEventCategoryLabel,
  toEventDeliveryModeLabel,
};
export type { EventArchiveView, EventRichTextFormat };

type EventRow = Pick<
  Tables<"events">,
  | "body_markdown"
  | "capacity"
  | "category"
  | "cover_alt_text_override"
  | "cover_media_asset_id"
  | "created_at"
  | "created_by_user_id"
  | "cta_label"
  | "cta_url"
  | "delivery_mode"
  | "ends_at"
  | "id"
  | "legacy_content_post_id"
  | "location_label"
  | "location_mode"
  | "online_url"
  | "published_at"
  | "registration_closes_at"
  | "registration_mode"
  | "registration_open"
  | "registration_url"
  | "slug"
  | "source"
  | "source_metadata"
  | "starts_at"
  | "status"
  | "summary"
  | "timezone"
  | "title"
  | "updated_at"
  | "venue_address"
  | "venue_name"
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


type SupabaseQueryError = {
  message?: string;
};

type EventArchiveFilterable<T> = T & {
  ilike: (column: string, pattern: string) => EventArchiveFilterable<T>;
  lt: (column: string, value: string) => EventArchiveFilterable<T>;
  or: (filters: string) => EventArchiveFilterable<T>;
};

type EventDashboardFilterable<T> = T & {
  eq: (column: string, value: string) => EventDashboardFilterable<T>;
  or: (filters: string) => EventDashboardFilterable<T>;
};

export type EventLifecycleState = "upcoming" | "today" | "completed";
export type EventRegistrationState =
  | "open"
  | "full"
  | "closed"
  | "external"
  | "none";

export type EventCoverImage = {
  alt: string;
  id: string;
  fullUrl: string;
  height: number;
  publicId: string;
  rawUrl: string;
  thumbnailUrl: string;
  width: number;
};

export type EventListItem = {
  category: string;
  cover: EventCoverImage | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  deliveryMode: string;
  endsAt: string | null;
  id: string;
  legacyContentPostId: string | null;
  lifecycle: EventLifecycleState;
  lifecycleLabel: string;
  locationLabel: string;
  publishedAt: string | null;
  registrationBadgeLabel: string | null;
  registrationState: EventRegistrationState;
  slug: string;
  startsAt: string;
  status: string;
  summary: string;
  timezone: string;
  title: string;
  updatedAt: string;
};

export type EventDetail = EventListItem & {
  bodyFormat: EventRichTextFormat;
  bodyMarkdown: string | null;
  capacity: number | null;
  coverAltTextOverride: string | null;
  locationMode: string;
  onlineUrl: string | null;
  registrationClosesAt: string | null;
  registrationMode: string;
  registrationOpen: boolean;
  registrationUrl: string | null;
  registeredCount: number;
  sourceMetadata: Tables<"events">["source_metadata"];
  spotsRemaining: number | null;
  venueAddress: string | null;
  venueName: string | null;
};

export type EventArchiveFilters = {
  category?: string;
  page?: number;
  query?: string;
  view?: EventArchiveView;
};

export type EventArchiveResult = {
  categories: string[];
  categoryCounts: Array<{
    category: string;
    count: number;
  }>;
  featuredEvent: EventListItem | null;
  items: EventListItem[];
  page: number;
  totalItems: number;
  totalPages: number;
  view: EventArchiveView;
};

export type AdminEventDashboardFilters = {
  category?: string;
  page?: number;
  query?: string;
  status?: string;
  timeframe?: "all" | "past" | "upcoming";
};

export type AdminEventListItem = EventListItem & {
  createdAt: string;
  registrationMode: string;
};

export type AdminEventDashboardResult = {
  categories: string[];
  items: AdminEventListItem[];
  metrics: {
    drafts: number;
    past: number;
    total: number;
    upcoming: number;
  };
  page: number;
  totalItems: number;
  totalPages: number;
};

export type EventEditorData = {
  event: EventDetail | null;
};

export type EventAdminMutationTarget = {
  id: string;
  legacyContentPostId: string | null;
};

export type EventRegistrationMutationTarget = EventAdminMutationTarget & {
  locationLabel: string;
  registrationFormVersionId: string | null;
  registrationClosed: boolean;
  registrationMode: string;
  registrationOpen: boolean;
  startsAt: string;
  title: string;
};

const EVENT_SELECT =
  "id, slug, title, summary, body_markdown, category, delivery_mode, status, starts_at, ends_at, timezone, location_mode, location_label, venue_name, venue_address, online_url, registration_mode, registration_url, registration_open, registration_closes_at, capacity, cta_label, cta_url, cover_media_asset_id, cover_alt_text_override, legacy_content_post_id, published_at, source, source_metadata, created_at, created_by_user_id, updated_at, media_assets(id, public_id, secure_url, thumbnail_url, alt_text, title, width, height, media_kind)";
const EVENT_LIST_SELECT =
  "id, slug, title, summary, category, delivery_mode, status, starts_at, ends_at, timezone, location_mode, location_label, venue_name, venue_address, online_url, registration_mode, registration_url, registration_open, registration_closes_at, capacity, cta_label, cta_url, cover_media_asset_id, cover_alt_text_override, legacy_content_post_id, published_at, source, source_metadata, created_at, created_by_user_id, updated_at, media_assets(id, public_id, secure_url, thumbnail_url, alt_text, title, width, height, media_kind)";
const EVENT_ADMIN_MUTATION_SELECT = "id, legacy_content_post_id";
const EVENT_REGISTRATION_MUTATION_SELECT =
  "id, legacy_content_post_id, title, starts_at, ends_at, location_label, location_mode, online_url, venue_address, venue_name, registration_mode, registration_open, registration_closes_at";

const EVENT_FALLBACK_IMAGE = "/images/workshop.jpg";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-BD", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function firstRecord<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] || null : value || null;
}

function normalizeIdentifier(value: string | null | undefined) {
  try {
    return decodeURIComponent(String(value || "").trim()).toLowerCase();
  } catch {
    return String(value || "").trim().toLowerCase();
  }
}

function normalizeText(value: string | null | undefined) {
  return String(value || "")
    .replace(/[%,*]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .slice(0, 100);
}

function assertSupabaseSuccess<T extends { error: SupabaseQueryError | null }>(
  result: T,
  operation: string
) {
  if (result.error) {
    throw new Error(`${operation}: ${result.error.message || "Unknown database error."}`);
  }

  return result;
}

function getExactCount(
  result: { count?: number | null; error: SupabaseQueryError | null },
  operation: string
) {
  const successful = assertSupabaseSuccess(result, operation);

  if (typeof successful.count !== "number") {
    throw new Error(`${operation}: an exact count was not returned.`);
  }

  return successful.count;
}

function formatDateKey(value: Date | string, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).format(new Date(value));
}

function safeTimeZone(value: string | null | undefined) {
  return value?.trim() || "Asia/Dhaka";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getStoredBodyFormat(row: Pick<EventRow, "source_metadata">): EventRichTextFormat {
  const metadata = asRecord(row.source_metadata);
  const format = metadata.bodyFormat || metadata.body_format || metadata.format;

  return format === "html" ? "html" : "markdown";
}

function prepareEventBody(row: Pick<EventRow, "body_markdown" | "source_metadata">) {
  const format = getStoredBodyFormat(row);
  const body = row.body_markdown || null;

  return {
    bodyFormat: format,
    bodyMarkdown: format === "html" && body ? sanitizeEventHtml(body) : body,
  };
}

function getLifecycleState(row: Pick<EventRow, "ends_at" | "starts_at" | "timezone">) {
  const timeZone = safeTimeZone(row.timezone);
  const now = new Date();
  const nowKey = formatDateKey(now, timeZone);
  const startKey = formatDateKey(row.starts_at, timeZone);
  const endKey = formatDateKey(row.ends_at || row.starts_at, timeZone);

  if (nowKey >= startKey && nowKey <= endKey) {
    return "today" satisfies EventLifecycleState;
  }

  if (now.getTime() < new Date(row.starts_at).getTime()) {
    return "upcoming" satisfies EventLifecycleState;
  }

  return "completed" satisfies EventLifecycleState;
}

function getLifecycleLabel(state: EventLifecycleState) {
  if (state === "today") {
    return "Happening Today";
  }

  if (state === "upcoming") {
    return "Upcoming";
  }

  return "Completed";
}

export function deriveEventRegistrationState(
  row: Pick<
    EventRow,
    | "capacity"
    | "ends_at"
    | "registration_closes_at"
    | "registration_mode"
    | "registration_open"
    | "starts_at"
  >,
  registeredCount: number,
  now = new Date()
) {
  const closesAt = row.registration_closes_at
    ? new Date(row.registration_closes_at)
    : null;
  const endsAt = new Date(row.ends_at || row.starts_at);
  const timedOut =
    (closesAt !== null && closesAt.getTime() <= now.getTime()) ||
    endsAt.getTime() <= now.getTime();

  if (row.registration_mode === "external") {
    return timedOut ? "closed" : "external";
  }

  if (row.registration_mode !== "internal") {
    return "none";
  }

  if (!row.registration_open || timedOut) {
    return "closed";
  }

  if (typeof row.capacity === "number" && registeredCount >= row.capacity) {
    return "full";
  }

  return "open";
}

export function isEventRegistrationWindowClosed(
  row: Pick<
    EventRow,
    "ends_at" | "registration_closes_at" | "registration_open" | "starts_at"
  >,
  now = new Date()
) {
  const closesAt = row.registration_closes_at
    ? new Date(row.registration_closes_at)
    : null;
  const endsAt = new Date(row.ends_at || row.starts_at);

  return (
    !row.registration_open ||
    (closesAt !== null && closesAt.getTime() <= now.getTime()) ||
    endsAt.getTime() <= now.getTime()
  );
}
function getRegistrationLabel(state: EventRegistrationState) {
  if (state === "open") {
    return "Registration Open";
  }

  if (state === "full") {
    return "Registration Full";
  }

  if (state === "closed") {
    return "Registration Closed";
  }

  if (state === "external") {
    return "External Registration";
  }

  return null;
}

function getLocationLabel(row: Pick<EventRow, "location_label" | "location_mode" | "online_url" | "venue_address" | "venue_name">) {
  if (row.location_label?.trim()) {
    return row.location_label.trim();
  }

  if (row.venue_name?.trim()) {
    return row.venue_name.trim();
  }

  if (row.location_mode === "online" && row.online_url) {
    return "Online event";
  }

  if (row.location_mode === "hybrid") {
    return "Hybrid event";
  }

  if (row.venue_address?.trim()) {
    return row.venue_address.trim();
  }

  return "Location to be announced";
}

function mapCoverImage(row: EventRow): EventCoverImage | null {
  const media = firstRecord(row.media_assets);

  if (!media?.secure_url) {
    return null;
  }

  return {
    alt: row.cover_alt_text_override || media.alt_text || media.title || row.title,
    id: media.id,
    fullUrl: transformCloudinaryUrl(media.secure_url, "full"),
    height: media.height || 800,
    publicId: media.public_id,
    rawUrl: media.secure_url,
    thumbnailUrl:
      media.media_kind === "image"
        ? transformCloudinaryUrl(media.secure_url, "albumCard")
        : media.thumbnail_url || EVENT_FALLBACK_IMAGE,
    width: media.width || 1200,
  };
}

function getBangladeshDayStartIso() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Dhaka",
    year: "numeric",
  })
    .format(new Date())
    .split("-")
    .map(Number);
  const [year, month, day] = parts;

  return new Date(Date.UTC(year, month - 1, day, -6, 0, 0)).toISOString();
}

function applyPublicEventArchiveFilters<T>(
  request: EventArchiveFilterable<T>,
  options: {
    category: string;
    cutoffIso: string;
    query: string;
    view: EventArchiveView;
  }
) {
  let result =
    options.view === "past"
      ? request.or(
          `ends_at.lt.${options.cutoffIso},and(ends_at.is.null,starts_at.lt.${options.cutoffIso})`
        )
      : request.or(`ends_at.gte.${options.cutoffIso},starts_at.gte.${options.cutoffIso}`);

  if (options.category) {
    result = result.ilike("category", options.category);
  }

  if (options.query) {
    const pattern = `%${options.query}%`;
    result = result.or(
      `slug.ilike.${pattern},title.ilike.${pattern},summary.ilike.${pattern},category.ilike.${pattern},location_label.ilike.${pattern},venue_name.ilike.${pattern},venue_address.ilike.${pattern}`
    );
  }

  return result;
}
function applyAdminEventDashboardFilters<T>(
  request: EventDashboardFilterable<T>,
  options: {
    category: string;
    cutoffIso: string;
    query: string;
    status: string;
    timeframe: "all" | "past" | "upcoming";
  }
) {
  let result = request;

  if (options.timeframe === "past") {
    result = result.or(
      `ends_at.lt.${options.cutoffIso},and(ends_at.is.null,starts_at.lt.${options.cutoffIso})`
    );
  }

  if (options.timeframe === "upcoming") {
    result = result.or(
      `ends_at.gte.${options.cutoffIso},starts_at.gte.${options.cutoffIso}`
    );
  }

  if (options.status) {
    result = result.eq("status", options.status);
  }

  if (options.category) {
    result = result.eq("category", options.category);
  }

  if (options.query) {
    const pattern = `%${options.query}%`;
    result = result.or(
      `slug.ilike.${pattern},title.ilike.${pattern},summary.ilike.${pattern},body_markdown.ilike.${pattern},category.ilike.${pattern},location_label.ilike.${pattern},venue_name.ilike.${pattern},venue_address.ilike.${pattern}`
    );
  }

  return result;
}


async function getRegistrationCountMap(rows: EventRow[]) {
  const eventIds = Array.from(new Set(rows.map((row) => row.id)));

  if (eventIds.length === 0) {
    return new Map<string, number>();
  }

  const result = await createAdminClient().rpc(
    "get_event_registration_counts",
    { p_event_ids: eventIds }
  );
  const successful = assertSupabaseSuccess(
    result,
    "Event registration count lookup failed"
  );

  if (!Array.isArray(successful.data)) {
    throw new Error("Event registration count lookup failed: no aggregate rows returned.");
  }

  const counts = new Map<string, number>();

  for (const row of successful.data) {
    const registrationCount = Number(row.registration_count);

    if (
      !row.event_id ||
      !Number.isSafeInteger(registrationCount) ||
      registrationCount < 0
    ) {
      throw new Error("Event registration count lookup failed: invalid aggregate row.");
    }

    counts.set(row.event_id, registrationCount);
  }

  return counts;
}

function mapEventRow(
  row: EventRow,
  registrationCount: number
): EventListItem {
  const lifecycle = getLifecycleState(row);
  const registrationState = deriveEventRegistrationState(row, registrationCount);

  return {
    category: row.category,
    cover: mapCoverImage(row),
    ctaLabel: row.cta_label,
    ctaUrl: row.cta_url,
    deliveryMode: row.delivery_mode,
    endsAt: row.ends_at,
    id: row.id,
    legacyContentPostId: row.legacy_content_post_id,
    lifecycle,
    lifecycleLabel: getLifecycleLabel(lifecycle),
    locationLabel: getLocationLabel(row),
    publishedAt: row.published_at,
    registrationBadgeLabel: getRegistrationLabel(registrationState),
    registrationState,
    slug: row.slug,
    startsAt: row.starts_at,
    status: row.status,
    summary: row.summary,
    timezone: safeTimeZone(row.timezone),
    title: row.title,
    updatedAt: row.updated_at,
  };
}

function mapEventDetail(
  row: EventRow,
  registrationCount: number
): EventDetail {
  const base = mapEventRow(row, registrationCount);
  const spotsRemaining =
    typeof row.capacity === "number"
      ? Math.max(0, row.capacity - registrationCount)
      : null;
  const eventBody = prepareEventBody(row);

  return {
    ...base,
    bodyFormat: eventBody.bodyFormat,
    bodyMarkdown: eventBody.bodyMarkdown,
    capacity: row.capacity,
    coverAltTextOverride: row.cover_alt_text_override,
    locationMode: row.location_mode,
    onlineUrl: row.online_url,
    registeredCount: registrationCount,
    registrationClosesAt: row.registration_closes_at,
    registrationMode: row.registration_mode,
    registrationOpen: row.registration_open,
    registrationUrl: row.registration_url,
    sourceMetadata: row.source_metadata,
    spotsRemaining,
    venueAddress: row.venue_address,
    venueName: row.venue_name,
  };
}

const getFeaturedPublishedEventRow = cache(async () => {
  const supabase = createPublicClient();
  const cutoffIso = getBangladeshDayStartIso();
  const upcomingResult = await applyPublicEventArchiveFilters(
    supabase
      .from("events")
      .select(EVENT_LIST_SELECT)
      .eq("status", "published"),
    {
      category: "",
      cutoffIso,
      query: "",
      view: "upcoming",
    }
  )
    .order("starts_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();
  const upcoming = assertSupabaseSuccess(
    upcomingResult,
    "Featured event lookup failed"
  );

  if (upcoming.data) {
    return upcoming.data as EventRow;
  }

  const fallbackResult = await supabase
    .from("events")
    .select(EVENT_LIST_SELECT)
    .eq("status", "published")
    .order("starts_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  const fallback = assertSupabaseSuccess(
    fallbackResult,
    "Featured event lookup failed"
  );

  return (fallback.data || null) as EventRow | null;
});

export const getPublicEventFilterOptions = cache(async () => {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("events")
    .select("category")
    .eq("status", "published")
    .order("category", { ascending: true })
    .limit(500);
  const rows = (data || []) as Array<{ category: string }>;

  return Array.from(new Set(rows.map((row) => row.category))).sort();
});

async function getPublicEventsPageUnsafe(
  filters: EventArchiveFilters = {}
): Promise<EventArchiveResult> {
  const view = filters.view === "past" ? "past" : "upcoming";
  const page = Number.isInteger(filters.page) && (filters.page || 0) > 0
    ? Number(filters.page)
    : 1;
  const query = normalizeText(filters.query);
  const category = normalizeIdentifier(filters.category);
  const cutoffIso = getBangladeshDayStartIso();
  const supabase = createPublicClient();
  const [categoryRowsResult, categoryCountRowsResult, featuredRow] =
    await Promise.all([
      supabase
        .from("events")
        .select("category")
        .eq("status", "published")
        .order("category", { ascending: true })
        .limit(500),
      applyPublicEventArchiveFilters(
        supabase.from("events").select("category").eq("status", "published"),
        {
          category: "",
          cutoffIso,
          query: "",
          view,
        }
      ).limit(500),
      getFeaturedPublishedEventRow(),
    ]);
  const categoryRowsResponse = assertSupabaseSuccess(
    categoryRowsResult,
    "Public event filter lookup failed"
  );
  const categoryCountRowsResponse = assertSupabaseSuccess(
    categoryCountRowsResult,
    "Public event category count lookup failed"
  );

  const buildPageQuery = () => {
    const request = applyPublicEventArchiveFilters(
      supabase
        .from("events")
        .select(EVENT_LIST_SELECT, { count: "exact" })
        .eq("status", "published"),
      {
        category,
        cutoffIso,
        query,
        view,
      }
    );

    return request
      .order("starts_at", { ascending: view !== "past" })
      .order("id", { ascending: view !== "past" });
  };

  const fetchPage = async (targetPage: number) => {
    const start = (targetPage - 1) * EVENTS_PER_PAGE;
    return buildPageQuery().range(start, start + EVENTS_PER_PAGE - 1);
  };

  let pageResult = assertSupabaseSuccess(
    await fetchPage(page),
    "Public event page lookup failed"
  );
  let totalItems = getExactCount(pageResult, "Public event page lookup failed");
  let totalPages = Math.max(1, Math.ceil(totalItems / EVENTS_PER_PAGE));
  let normalizedPage = Math.min(Math.max(page, 1), totalPages);

  if (normalizedPage !== page && totalItems > 0) {
    pageResult = assertSupabaseSuccess(
      await fetchPage(normalizedPage),
      "Public event page lookup failed"
    );
    totalItems = getExactCount(pageResult, "Public event page lookup failed");
    totalPages = Math.max(1, Math.ceil(totalItems / EVENTS_PER_PAGE));
    normalizedPage = Math.min(Math.max(normalizedPage, 1), totalPages);
  }

  const pageRows = (pageResult.data || []) as EventRow[];
  const categoryRows = (categoryRowsResponse.data || []) as Array<{
    category: string;
  }>;
  const categoryCounts = ((categoryCountRowsResponse.data || []) as Array<{
    category: string;
  }>).reduce((counts, row) => {
    counts.set(row.category, (counts.get(row.category) || 0) + 1);
    return counts;
  }, new Map<string, number>());
  const registrationRows = pageRows.slice();

  if (
    featuredRow &&
    !registrationRows.some((row) => row.id === featuredRow.id)
  ) {
    registrationRows.push(featuredRow);
  }

  const counts = await getRegistrationCountMap(registrationRows);

  return {
    categories: Array.from(new Set(categoryRows.map((row) => row.category))).sort(),
    categoryCounts: Array.from(categoryCounts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((left, right) => left.category.localeCompare(right.category)),
    featuredEvent: featuredRow
      ? mapEventRow(featuredRow, counts.get(featuredRow.id) || 0)
      : null,
    items: pageRows.map((row) => mapEventRow(row, counts.get(row.id) || 0)),
    page: normalizedPage,
    totalItems,
    totalPages,
    view,
  };
}

export async function getPublicEventsPage(
  filters: EventArchiveFilters = {}
): Promise<EventArchiveResult> {
  try {
    return await getPublicEventsPageUnsafe(filters);
  } catch (error) {
    console.error(
      `Public event archive unavailable: ${
        error instanceof Error ? error.message : "Unknown error."
      }`
    );

    return {
      categories: [],
      categoryCounts: [],
      featuredEvent: null,
      items: [],
      page: 1,
      totalItems: 0,
      totalPages: 1,
      view: filters.view === "past" ? "past" : "upcoming",
    };
  }
}

export const getFeaturedPublicEvent = cache(async () => {
  const featured = await getFeaturedPublishedEventRow();

  if (!featured) {
    return null;
  }

  const counts = await getRegistrationCountMap([featured]);

  return mapEventRow(featured, counts.get(featured.id) || 0);
});

export const getPublishedEventBySlug = cache(async (slug: string) => {
  const normalizedSlug = normalizeIdentifier(slug);

  if (!normalizedSlug) {
    return null;
  }

  const supabase = createPublicClient();
  const { data } = await supabase
    .from("events")
    .select(EVENT_SELECT)
    .eq("slug", normalizedSlug)
    .eq("status", "published")
    .maybeSingle();

  if (!data) {
    return null;
  }

  const row = data as EventRow;
  const counts = await getRegistrationCountMap([row]);

  return mapEventDetail(row, counts.get(row.id) || 0);
});

export const getPublishedEventSitemapEntries = cache(async () => {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("events")
    .select("slug, updated_at")
    .eq("status", "published")
    .order("updated_at", { ascending: false });

  return (data || []).map((row) => ({
    slug: row.slug,
    updatedAt: row.updated_at,
  }));
});

export async function getAdminEventsDashboard(
  filters: AdminEventDashboardFilters = {}
): Promise<AdminEventDashboardResult> {
  const page = Number.isInteger(filters.page) && (filters.page || 0) > 0
    ? Number(filters.page)
    : 1;
  const query = normalizeText(filters.query);
  const category = normalizeIdentifier(filters.category);
  const status = normalizeIdentifier(filters.status);
  const timeframe =
    filters.timeframe === "past" || filters.timeframe === "upcoming"
      ? filters.timeframe
      : "all";
  const cutoffIso = getBangladeshDayStartIso();
  const admin = createAdminClient();
  const metricResultsPromise = Promise.all([
    admin.from("events").select("id", { count: "exact", head: true }),
    admin
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("status", "draft"),
    applyAdminEventDashboardFilters(
      admin.from("events").select("id", { count: "exact", head: true }),
      {
        category: "",
        cutoffIso,
        query: "",
        status: "",
        timeframe: "past",
      }
    ),
    applyAdminEventDashboardFilters(
      admin.from("events").select("id", { count: "exact", head: true }),
      {
        category: "",
        cutoffIso,
        query: "",
        status: "",
        timeframe: "upcoming",
      }
    ),
  ]);

  const buildPageQuery = () =>
    applyAdminEventDashboardFilters(
      admin
        .from("events")
        .select(EVENT_LIST_SELECT, { count: "exact" }),
      {
        category,
        cutoffIso,
        query,
        status,
        timeframe,
      }
    )
      .order("starts_at", { ascending: false })
      .order("id", { ascending: false });

  const fetchPage = async (targetPage: number) => {
    const start = (targetPage - 1) * EVENTS_PER_PAGE;
    return buildPageQuery().range(start, start + EVENTS_PER_PAGE - 1);
  };

  const [initialPageResult, metricResults] = await Promise.all([
    fetchPage(page),
    metricResultsPromise,
  ]);
  let pageResult = assertSupabaseSuccess(
    initialPageResult,
    "Admin event page lookup failed"
  );
  let totalItems = getExactCount(pageResult, "Admin event page lookup failed");
  let totalPages = Math.max(1, Math.ceil(totalItems / EVENTS_PER_PAGE));
  let normalizedPage = Math.min(Math.max(page, 1), totalPages);

  if (normalizedPage !== page && totalItems > 0) {
    pageResult = assertSupabaseSuccess(
      await fetchPage(normalizedPage),
      "Admin event page lookup failed"
    );
    totalItems = getExactCount(pageResult, "Admin event page lookup failed");
    totalPages = Math.max(1, Math.ceil(totalItems / EVENTS_PER_PAGE));
    normalizedPage = Math.min(Math.max(normalizedPage, 1), totalPages);
  }

  const [totalResult, draftsResult, pastResult, upcomingResult] = metricResults;
  const metrics = {
    drafts: getExactCount(draftsResult, "Admin event draft metric lookup failed"),
    past: getExactCount(pastResult, "Admin event past metric lookup failed"),
    total: getExactCount(totalResult, "Admin event total metric lookup failed"),
    upcoming: getExactCount(
      upcomingResult,
      "Admin event upcoming metric lookup failed"
    ),
  };
  const pageRows = (pageResult.data || []) as EventRow[];
  const counts = await getRegistrationCountMap(pageRows);

  return {
    categories: Array.from(EVENT_CATEGORIES),
    items: pageRows.map((row) => ({
      ...mapEventRow(row, counts.get(row.id) || 0),
      createdAt: row.created_at,
      registrationMode: row.registration_mode,
    })),
    metrics,
    page: normalizedPage,
    totalItems,
    totalPages,
  };
}

export async function getAdminEventById(eventId: string): Promise<EventDetail | null> {
  const normalizedId = normalizeIdentifier(eventId);

  if (!normalizedId) {
    return null;
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("events")
    .select(EVENT_SELECT)
    .eq("id", normalizedId)
    .maybeSingle();

  if (!data) {
    return null;
  }

  const row = data as EventRow;
  const counts = await getRegistrationCountMap([row]);

  return mapEventDetail(row, counts.get(row.id) || 0);
}

export async function getEventEditorData(eventId?: string | null): Promise<EventEditorData> {
  if (!eventId) {
    return { event: null };
  }

  return {
    event: await getAdminEventById(eventId),
  };
}

export async function resolveEventForAdminMutation(
  identifier: string
): Promise<EventAdminMutationTarget | null> {
  const normalizedIdentifier = normalizeIdentifier(identifier);

  if (!normalizedIdentifier) {
    return null;
  }

  const admin = createAdminClient();
  let query = admin
    .from("events")
    .select(EVENT_ADMIN_MUTATION_SELECT)
    .limit(1);
  const uuidMatch =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      normalizedIdentifier
    );

  if (uuidMatch) {
    query = query.or(
      `id.eq.${normalizedIdentifier},legacy_content_post_id.eq.${normalizedIdentifier}`
    );
  } else {
    query = query.eq("slug", normalizedIdentifier);
  }

  const { data } = await query.maybeSingle();

  if (!data) {
    return null;
  }

  const row = data as Pick<EventRow, "id" | "legacy_content_post_id">;

  return {
    id: row.id,
    legacyContentPostId: row.legacy_content_post_id,
  };
}

export async function resolvePublishedEventForMutation(
  identifier: string
): Promise<EventRegistrationMutationTarget | null> {
  const normalizedIdentifier = normalizeIdentifier(identifier);

  if (!normalizedIdentifier) {
    return null;
  }

  const admin = createAdminClient();
  let query = admin
    .from("events")
    .select(EVENT_REGISTRATION_MUTATION_SELECT)
    .eq("status", "published")
    .limit(1);

  const uuidMatch =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      normalizedIdentifier
    );

  if (uuidMatch) {
    query = query.or(
      `id.eq.${normalizedIdentifier},legacy_content_post_id.eq.${normalizedIdentifier}`
    );
  } else {
    query = query.eq("slug", normalizedIdentifier);
  }

  const { data } = await query.maybeSingle();

  if (!data) {
    return null;
  }

  const row = data as Pick<
    EventRow,
    | "ends_at"
    | "id"
    | "legacy_content_post_id"
    | "location_label"
    | "location_mode"
    | "online_url"
    | "registration_closes_at"
    | "registration_mode"
    | "registration_open"
    | "starts_at"
    | "title"
    | "venue_address"
    | "venue_name"
  >;
  let registrationFormVersionId: string | null = null;

  try {
    const formLinkResult = (await asFlexibleClient(admin)
      .from("events")
      .select("registration_form_version_id")
      .eq("id", row.id)
      .limit(1)
      .maybeSingle()) as {
      data: { registration_form_version_id?: unknown } | null;
      error: unknown;
    };
    const { data: formLink, error: formLinkError } = formLinkResult;

    if (!formLinkError && typeof formLink?.registration_form_version_id === "string") {
      registrationFormVersionId = formLink.registration_form_version_id;
    }
  } catch {
    // The versioned forms migration may not be installed yet; preserve legacy registration.
  }


  return {
    id: row.id,
    legacyContentPostId: row.legacy_content_post_id,
    locationLabel: getLocationLabel(row),
    registrationFormVersionId,
    registrationClosed: isEventRegistrationWindowClosed(row),
    registrationMode: row.registration_mode,
    registrationOpen: row.registration_open,
    startsAt: row.starts_at,
    title: row.title,
  };
}

export function formatEventDateRange(
  startsAt: string,
  endsAt: string | null,
  timeZone = "Asia/Dhaka"
) {
  const startDate = new Date(startsAt);
  const endDate = new Date(endsAt || startsAt);
  const dayFormatter = new Intl.DateTimeFormat("en-BD", {
    day: "numeric",
    month: "short",
    timeZone,
    year: "numeric",
  });
  const timeFormatter = new Intl.DateTimeFormat("en-BD", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
  const startKey = formatDateKey(startDate, timeZone);
  const endKey = formatDateKey(endDate, timeZone);

  if (startKey === endKey) {
    return `${dayFormatter.format(startDate)} • ${timeFormatter.format(
      startDate
    )} - ${timeFormatter.format(endDate)}`;
  }

  return `${DATE_FORMATTER.format(startDate)} - ${DATE_FORMATTER.format(endDate)}`;
}

export function formatEventAdminDate(
  startsAt: string,
  endsAt: string | null,
  timeZone = "Asia/Dhaka"
) {
  const start = new Date(startsAt);
  const end = endsAt ? new Date(endsAt) : null;
  const formatter = new Intl.DateTimeFormat("en-BD", {
    day: "numeric",
    month: "short",
    timeZone,
    year: "numeric",
  });
  const startLabel = formatter.format(start);

  if (!end || formatDateKey(start, timeZone) === formatDateKey(end, timeZone)) {
    return startLabel;
  }

  return `${startLabel} - ${formatter.format(end)}`;
}

export function getEventLocalDateInput(value: string | null | undefined, timeZone = "Asia/Dhaka") {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).format(date);
}

export function getEventLocalTimeInput(value: string | null | undefined, timeZone = "Asia/Dhaka") {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone,
  }).format(new Date(value));
}
