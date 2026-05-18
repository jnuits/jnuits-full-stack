import "server-only";

import { cache } from "react";
import type { Tables } from "@/lib/db/types";
import { createAdminClient } from "@/lib/supabase/admin";

export const NOTICE_STATUSES = ["draft", "published", "archived"] as const;
export const NOTICES_PER_PAGE = 12;

type NoticeRow = Pick<
  Tables<"content_posts">,
  | "body"
  | "category"
  | "created_at"
  | "cta_href"
  | "id"
  | "published_at"
  | "slug"
  | "status"
  | "summary"
  | "title"
  | "updated_at"
>;

export type AdminNoticeListItem = {
  body: string | null;
  category: string;
  createdAt: string;
  ctaHref: string | null;
  id: string;
  publishedAt: string | null;
  slug: string;
  status: string;
  summary: string;
  title: string;
  updatedAt: string;
};

export type AdminNoticeDashboardFilters = {
  category?: string;
  page?: number;
  query?: string;
  status?: string;
};

export type AdminNoticeDashboardResult = {
  categories: string[];
  items: AdminNoticeListItem[];
  metrics: {
    archived: number;
    drafts: number;
    published: number;
    total: number;
  };
  page: number;
  totalItems: number;
  totalPages: number;
};

export type NoticeEditorData = {
  notice: AdminNoticeListItem | null;
};

const NOTICE_SELECT =
  "id, slug, title, category, summary, body, status, published_at, cta_href, created_at, updated_at";

const noticeDateFormatter = new Intl.DateTimeFormat("en-BD", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

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

function buildSearchText(row: NoticeRow) {
  return [
    row.slug,
    row.title,
    row.category,
    row.summary,
    row.body,
    row.cta_href,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function buildPagedSlice<T>(items: T[], page: number) {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / NOTICES_PER_PAGE));
  const normalizedPage = Math.min(Math.max(page, 1), totalPages);
  const start = (normalizedPage - 1) * NOTICES_PER_PAGE;

  return {
    items: items.slice(start, start + NOTICES_PER_PAGE),
    page: normalizedPage,
    totalItems,
    totalPages,
  };
}

function mapNoticeRow(row: NoticeRow): AdminNoticeListItem {
  return {
    body: row.body,
    category: row.category || "Notice",
    createdAt: row.created_at,
    ctaHref: row.cta_href,
    id: row.id,
    publishedAt: row.published_at,
    slug: row.slug,
    status: row.status,
    summary: row.summary || "",
    title: row.title,
    updatedAt: row.updated_at,
  };
}

export function formatNoticeAdminDate(value: string | null) {
  if (!value) {
    return "Not published";
  }

  return noticeDateFormatter.format(new Date(value));
}

const getAllAdminNoticeRows = cache(async () => {
  const admin = createAdminClient();
  const { data } = await admin
    .from("content_posts")
    .select(NOTICE_SELECT)
    .eq("content_type", "notice")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  return (data || []) as NoticeRow[];
});

export async function getAdminNoticesDashboard(
  filters: AdminNoticeDashboardFilters = {}
): Promise<AdminNoticeDashboardResult> {
  const page = Number.isInteger(filters.page) && (filters.page || 0) > 0
    ? Number(filters.page)
    : 1;
  const query = normalizeText(filters.query);
  const category = normalizeIdentifier(filters.category);
  const status = normalizeIdentifier(filters.status);
  const rows = await getAllAdminNoticeRows();
  const metrics = {
    archived: rows.filter((row) => row.status === "archived").length,
    drafts: rows.filter((row) => row.status === "draft").length,
    published: rows.filter((row) => row.status === "published").length,
    total: rows.length,
  };
  const filteredRows = rows.filter((row) => {
    if (status && row.status !== status) {
      return false;
    }

    if (category && normalizeIdentifier(row.category || "Notice") !== category) {
      return false;
    }

    if (query && !buildSearchText(row).includes(query)) {
      return false;
    }

    return true;
  });
  const paged = buildPagedSlice(filteredRows, page);

  return {
    categories: Array.from(new Set(rows.map((row) => row.category || "Notice"))).sort(),
    items: paged.items.map(mapNoticeRow),
    metrics,
    page: paged.page,
    totalItems: paged.totalItems,
    totalPages: paged.totalPages,
  };
}

export async function getNoticeEditorData(
  noticeId?: string | null
): Promise<NoticeEditorData> {
  if (!noticeId) {
    return { notice: null };
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("content_posts")
    .select(NOTICE_SELECT)
    .eq("id", noticeId)
    .eq("content_type", "notice")
    .maybeSingle();

  return {
    notice: data ? mapNoticeRow(data as NoticeRow) : null,
  };
}

export async function resolveNoticeForAdminMutation(identifier: string) {
  const normalizedIdentifier = normalizeIdentifier(identifier);

  if (!normalizedIdentifier) {
    return null;
  }

  const admin = createAdminClient();
  const uuidMatch =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      normalizedIdentifier
    );
  const query = admin
    .from("content_posts")
    .select(NOTICE_SELECT)
    .eq("content_type", "notice")
    .limit(1);
  const { data } = uuidMatch
    ? await query.eq("id", normalizedIdentifier).maybeSingle()
    : await query.eq("slug", normalizedIdentifier).maybeSingle();

  return data ? mapNoticeRow(data as NoticeRow) : null;
}
