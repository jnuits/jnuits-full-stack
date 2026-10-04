import "server-only";


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


export async function getAdminNoticesDashboard(
  filters: AdminNoticeDashboardFilters = {}
): Promise<AdminNoticeDashboardResult> {
  const page = Number.isSafeInteger(filters.page) && (filters.page || 0)>0 ? Number(filters.page) : 1;
  const category = normalizeIdentifier(filters.category);
  const status = normalizeIdentifier(filters.status);
  const search = normalizeText(filters.query);
  const admin = createAdminClient();
  const { data: summary, error: summaryError } = await admin.rpc("get_admin_notice_summary" as never);
  if (summaryError || !summary) throw new Error("Notice summaries could not be loaded.");
  const dashboardSummary = summary as unknown as Pick<AdminNoticeDashboardResult,"categories"|"metrics">;
  const buildQuery = (head = false) => {
    let request = admin.from("content_posts").select(NOTICE_SELECT, { count: "exact", head }).eq("content_type","notice");
    if (status) request = request.eq("status",status);
    if (category === "notice") request = request.or("category.is.null,category.ilike.Notice");
    else if (category) request = request.ilike("category",category.replace(/[%_\\]/g,"\\$&"));
    if (search) {
      const escaped = search.replace(/[\\%_]/g,"\\$&").replace(/"/g,'\\"');
      const pattern = '"%' + escaped + '%"';
      request = request.or(["slug","title","category","summary","body","cta_href"].map(column => column+".ilike."+pattern).join(","));
    }
    return request.order("published_at",{ ascending:false, nullsFirst:false })
      .order("created_at",{ ascending:false }).order("id",{ascending:false});

  };
  const countResult = await buildQuery(true);
  if (countResult.error) throw new Error("Notices could not be loaded.");
  const totalItems = countResult.count || 0;
  const totalPages = Math.max(1,Math.ceil(totalItems/NOTICES_PER_PAGE));
  const normalizedPage = Math.min(page,totalPages);
  const result = await buildQuery().range((normalizedPage-1)*NOTICES_PER_PAGE,normalizedPage*NOTICES_PER_PAGE-1);
  if (result.error) throw new Error("Notices could not be loaded.");
  return { ...dashboardSummary, items: (result.data || []).map(row => mapNoticeRow(row as NoticeRow)),
    page: normalizedPage, totalItems, totalPages };
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
