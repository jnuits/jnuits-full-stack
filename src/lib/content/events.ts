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
  toEventCategoryLabel,
  type EventArchiveView,
} from "@/lib/content/events-shared";
import type { Tables } from "@/lib/db/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export {
  EVENT_CATEGORIES,
  EVENT_DELIVERY_MODES,
  EVENT_LOCATION_MODES,
  EVENT_MEDIA_PICKER_PAGE_SIZE,
  EVENT_REGISTRATION_MODES,
  EVENTS_PER_PAGE,
  EVENT_STATUSES,
  toEventCategoryLabel,
};
export type { EventArchiveView };

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

type RegistrationRow = Pick<
  Tables<"event_registrations">,
  "event_id" | "event_post_id" | "id"
>;

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

const EVENT_SELECT =
  "id, slug, title, summary, body_markdown, category, delivery_mode, status, starts_at, ends_at, timezone, location_mode, location_label, venue_name, venue_address, online_url, registration_mode, registration_url, registration_open, registration_closes_at, capacity, cta_label, cta_url, cover_media_asset_id, cover_alt_text_override, legacy_content_post_id, published_at, source, source_metadata, created_at, created_by_user_id, updated_at, media_assets(id, public_id, secure_url, thumbnail_url, alt_text, title, width, height, media_kind)";

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
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
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

function getRegistrationState(
  row: Pick<
    EventRow,
    | "capacity"
    | "ends_at"
    | "registration_closes_at"
    | "registration_mode"
    | "registration_open"
    | "starts_at"
  >,
  registeredCount: number
) {
  if (row.registration_mode === "external") {
    return "external" satisfies EventRegistrationState;
  }

  if (row.registration_mode !== "internal") {
    return "none" satisfies EventRegistrationState;
  }

  const now = new Date();
  const closesAt = row.registration_closes_at
    ? new Date(row.registration_closes_at)
    : null;
  const endsAt = new Date(row.ends_at || row.starts_at);

  if (
    !row.registration_open ||
    (closesAt && closesAt.getTime() < now.getTime()) ||
    endsAt.getTime() < now.getTime()
  ) {
    return "closed" satisfies EventRegistrationState;
  }

  if (typeof row.capacity === "number" && registeredCount >= row.capacity) {
    return "full" satisfies EventRegistrationState;
  }

  return "open" satisfies EventRegistrationState;
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

function buildSearchText(row: EventRow) {
  return [
    row.slug,
    row.title,
    row.summary,
    row.body_markdown,
    row.category,
    row.location_label,
    row.venue_name,
    row.venue_address,
    new Intl.DateTimeFormat("en-CA", {
      timeZone: safeTimeZone(row.timezone),
      year: "numeric",
    }).format(new Date(row.starts_at)),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function sortByStartsAtAscending(left: EventRow, right: EventRow) {
  return (
    new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime()
  );
}

function sortByStartsAtDescending(left: EventRow, right: EventRow) {
  return (
    new Date(right.starts_at).getTime() - new Date(left.starts_at).getTime()
  );
}

function buildPagedSlice<T>(items: T[], page: number, perPage = EVENTS_PER_PAGE) {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const normalizedPage = Math.min(Math.max(page, 1), totalPages);
  const start = (normalizedPage - 1) * perPage;

  return {
    items: items.slice(start, start + perPage),
    page: normalizedPage,
    totalItems,
    totalPages,
  };
}

async function getRegistrationCountMap(rows: EventRow[]) {
  const eventIds = Array.from(new Set(rows.map((row) => row.id)));
  const legacyEventIds = Array.from(
    new Set(
      rows
        .map((row) => row.legacy_content_post_id)
        .filter((value): value is string => Boolean(value))
    )
  );

  const admin = createAdminClient();
  const [byEventId, byLegacyId] = await Promise.all([
    eventIds.length > 0
      ? admin
          .from("event_registrations")
          .select("id, event_id, event_post_id")
          .in("event_id", eventIds)
          .is("cancelled_at", null)
      : Promise.resolve({ data: [] as RegistrationRow[], error: null }),
    legacyEventIds.length > 0
      ? admin
          .from("event_registrations")
          .select("id, event_id, event_post_id")
          .in("event_post_id", legacyEventIds)
          .is("cancelled_at", null)
      : Promise.resolve({ data: [] as RegistrationRow[], error: null }),
  ]);
  const legacyToEventId = new Map<string, string>();
  const counts = new Map<string, number>();
  const seenRegistrationIds = new Set<string>();

  for (const row of rows) {
    if (row.legacy_content_post_id) {
      legacyToEventId.set(row.legacy_content_post_id, row.id);
    }
  }

  for (const registration of [
    ...((byEventId.data || []) as RegistrationRow[]),
    ...((byLegacyId.data || []) as RegistrationRow[]),
  ]) {
    if (seenRegistrationIds.has(registration.id)) {
      continue;
    }

    seenRegistrationIds.add(registration.id);
    const eventId =
      registration.event_id ||
      (registration.event_post_id
        ? legacyToEventId.get(registration.event_post_id)
        : null);

    if (!eventId) {
      continue;
    }

    counts.set(eventId, (counts.get(eventId) || 0) + 1);
  }

  return counts;
}

function mapEventRow(
  row: EventRow,
  registrationCount: number
): EventListItem {
  const lifecycle = getLifecycleState(row);
  const registrationState = getRegistrationState(row, registrationCount);

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

  return {
    ...base,
    bodyMarkdown: row.body_markdown,
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

const getAllPublishedEventRows = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select(EVENT_SELECT)
    .eq("status", "published")
    .order("starts_at", { ascending: true });

  return (data || []) as EventRow[];
});

const getAllAdminEventRows = cache(async () => {
  const admin = createAdminClient();
  const { data } = await admin
    .from("events")
    .select(EVENT_SELECT)
    .order("starts_at", { ascending: false });

  return (data || []) as EventRow[];
});

export const getPublicEventFilterOptions = cache(async () => {
  const rows = await getAllPublishedEventRows();

  return Array.from(new Set(rows.map((row) => row.category))).sort();
});

export async function getPublicEventsPage(
  filters: EventArchiveFilters = {}
): Promise<EventArchiveResult> {
  const view = filters.view === "past" ? "past" : "upcoming";
  const page = Number.isInteger(filters.page) && (filters.page || 0) > 0
    ? Number(filters.page)
    : 1;
  const query = normalizeText(filters.query);
  const category = normalizeIdentifier(filters.category);
  const rows = await getAllPublishedEventRows();
  const featuredRow =
    rows
      .filter((row) => getLifecycleState(row) !== "completed")
      .sort(sortByStartsAtAscending)[0] ||
    [...rows].sort(sortByStartsAtDescending)[0] ||
    null;
  const filteredRows = rows
    .filter((row) => {
      const lifecycle = getLifecycleState(row);

      if (view === "upcoming" && lifecycle === "completed") {
        return false;
      }

      if (view === "past" && lifecycle !== "completed") {
        return false;
      }

      if (category && row.category !== category) {
        return false;
      }

      if (query && !buildSearchText(row).includes(query)) {
        return false;
      }

      return true;
    })
    .sort(view === "past" ? sortByStartsAtDescending : sortByStartsAtAscending);
  const paged = buildPagedSlice(filteredRows, page);
  const registrationRows = paged.items.slice();

  if (
    featuredRow &&
    !registrationRows.some((row) => row.id === featuredRow.id)
  ) {
    registrationRows.push(featuredRow);
  }

  const counts = await getRegistrationCountMap(registrationRows);

  return {
    categories: Array.from(new Set(rows.map((row) => row.category))).sort(),
    featuredEvent: featuredRow ? mapEventRow(featuredRow, counts.get(featuredRow.id) || 0) : null,
    items: paged.items.map((row) => mapEventRow(row, counts.get(row.id) || 0)),
    page: paged.page,
    totalItems: paged.totalItems,
    totalPages: paged.totalPages,
    view,
  };
}

export const getFeaturedPublicEvent = cache(async () => {
  const rows = await getAllPublishedEventRows();
  const featured =
    rows
      .filter((row) => getLifecycleState(row) !== "completed")
      .sort(sortByStartsAtAscending)[0] ||
    [...rows].sort(sortByStartsAtDescending)[0] ||
    null;

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

  const supabase = await createClient();
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
  const supabase = await createClient();
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
  const timeframe = filters.timeframe || "all";
  const rows = await getAllAdminEventRows();
  const counts = await getRegistrationCountMap(rows);
  const metrics = {
    drafts: rows.filter((row) => row.status === "draft").length,
    past: rows.filter((row) => getLifecycleState(row) === "completed").length,
    total: rows.length,
    upcoming: rows.filter((row) => getLifecycleState(row) !== "completed").length,
  };
  const filteredRows = rows.filter((row) => {
    const lifecycle = getLifecycleState(row);

    if (timeframe === "upcoming" && lifecycle === "completed") {
      return false;
    }

    if (timeframe === "past" && lifecycle !== "completed") {
      return false;
    }

    if (status && row.status !== status) {
      return false;
    }

    if (category && row.category !== category) {
      return false;
    }

    if (query && !buildSearchText(row).includes(query)) {
      return false;
    }

    return true;
  });
  const paged = buildPagedSlice(filteredRows, page);

  return {
    categories: Array.from(new Set(rows.map((row) => row.category))).sort(),
    items: paged.items.map((row) => ({
      ...mapEventRow(row, counts.get(row.id) || 0),
      createdAt: row.created_at,
      registrationMode: row.registration_mode,
    })),
    metrics,
    page: paged.page,
    totalItems: paged.totalItems,
    totalPages: paged.totalPages,
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

export async function resolveEventForAdminMutation(identifier: string) {
  const normalizedIdentifier = normalizeIdentifier(identifier);

  if (!normalizedIdentifier) {
    return null;
  }

  const admin = createAdminClient();
  let query = admin.from("events").select(EVENT_SELECT).limit(1);
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

  const row = data as EventRow;
  const counts = await getRegistrationCountMap([row]);

  return mapEventDetail(row, counts.get(row.id) || 0);
}

export async function resolvePublishedEventForMutation(identifier: string) {
  const normalizedIdentifier = normalizeIdentifier(identifier);

  if (!normalizedIdentifier) {
    return null;
  }

  const admin = createAdminClient();
  let query = admin
    .from("events")
    .select(EVENT_SELECT)
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

  const row = data as EventRow;
  const counts = await getRegistrationCountMap([row]);

  return mapEventDetail(row, counts.get(row.id) || 0);
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
