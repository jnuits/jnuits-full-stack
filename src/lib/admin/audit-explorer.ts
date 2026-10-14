import "server-only";

import { requireAdminPermission } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";

export type AuditExplorerFilters = {
  action: string;
  actor: string;
  entityType: string;
  from: string;
  page: number;
  pageSize: number;
  q: string;
  to: string;
};

export type AuditExplorerEvent = {
  action: string;
  actor_user_id: string | null;
  created_at: string;
  entity_id: string | null;
  entity_type: string;
  id: string;
  metadata: unknown;
};

type AuditFilterQuery<T> = {
  eq(column: string, value: string): T;
  gte(column: string, value: string): T;
  ilike(column: string, pattern: string): T;
  lte(column: string, value: string): T;
  or(filters: string): T;
};
export type AuditExplorerOptions = {
  exportMode?: boolean;
};

export function parseAuditFilters(
  searchParams: Record<string, string | string[] | undefined>
): AuditExplorerFilters {
  const read = (key: string) => {
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] || "" : value || "";
  };
  const page = Math.max(1, Number.parseInt(read("page"), 10) || 1);
  const requestedPageSize = Number.parseInt(read("pageSize"), 10) || 25;

  return {
    action: read("action").trim(),
    actor: read("actor").trim(),
    entityType: read("entityType").trim(),
    from: read("from").trim(),
    page,
    pageSize: [25, 50, 100].includes(requestedPageSize) ? requestedPageSize : 25,
    q: read("q").trim(),
    to: read("to").trim(),
  };
}

function cleanLikeInput(value: string) {
  return value.replace(/[%,()]/g, " ").trim().slice(0, 120);
}

function asIsoDate(value: string, endOfDay = false) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  }
  return date.toISOString();
}

function applyAuditFilters<T extends AuditFilterQuery<T>>(query: T, filters: AuditExplorerFilters): T {
  let nextQuery = query;

  if (filters.action) {
    nextQuery = nextQuery.ilike("action", `%${cleanLikeInput(filters.action)}%`);
  }

  if (filters.entityType) {
    nextQuery = nextQuery.eq("entity_type", filters.entityType);
  }

  if (filters.actor) {
    nextQuery = nextQuery.eq("actor_user_id", filters.actor);
  }

  const fromIso = asIsoDate(filters.from);
  const toIso = asIsoDate(filters.to, true);

  if (fromIso) {
    nextQuery = nextQuery.gte("created_at", fromIso);
  }

  if (toIso) {
    nextQuery = nextQuery.lte("created_at", toIso);
  }

  if (filters.q) {
    const q = cleanLikeInput(filters.q);
    if (q) {
      nextQuery = nextQuery.or(
        `action.ilike.%${q}%,entity_type.ilike.%${q}%,entity_id.ilike.%${q}%`
      );
    }
  }

  return nextQuery;
}

export async function loadAuditExplorerData(
  filters: AuditExplorerFilters,
  options: AuditExplorerOptions = {}
) {
  await requireAdminPermission("admin.audit.read", { fallbackPath: "/admin/dashboard" });
  const admin = asFlexibleClient(createAdminClient());
  const pageSize = options.exportMode ? Math.min(filters.pageSize, 1000) : filters.pageSize;
  const from = options.exportMode ? 0 : (filters.page - 1) * filters.pageSize;
  const to = from + pageSize - 1;

  const baseQuery = admin
    .from("audit_events" as string)
    .select("id, action, actor_user_id, entity_type, entity_id, metadata, created_at", {
      count: "exact",
    });

  const eventsQuery = applyAuditFilters(baseQuery, filters)
    .order("created_at", { ascending: false })
    .range(from, to);

  const [eventsResult, facetsResult] = await Promise.all([
    eventsQuery,
    admin
      .from("audit_events" as string)
      .select(options.exportMode ? "action, entity_type" : "action, entity_type, actor_user_id")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  if (eventsResult.error) {
    throw eventsResult.error;
  }

  const facetRows = (facetsResult.data || []) as Array<{
    action?: string | null;
    actor_user_id?: string | null;
    entity_type?: string | null;
  }>;

  const actorOptions: Array<{userId: string; label: string}> = [];
  if (!options.exportMode) {
    const actorIds = Array.from(new Set([filters.actor, ...facetRows.map(row=>row.actor_user_id)].filter((id): id is string => Boolean(id)))).slice(0,100);
    const lookupIds = actorIds.filter(id=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
    const labels = lookupIds.length ? await admin.from("admin_profiles").select("user_id,display_name").in("user_id",lookupIds).limit(100) : {data:[]};
    const names = new Map<string,string>((labels.data || []).map((row: {user_id: string; display_name: string | null})=>[row.user_id,row.display_name || row.user_id]));
    for (const userId of actorIds) actorOptions.push({userId,label:names.get(userId) || (userId === filters.actor ? "Custom actor" : "Actor")});
    actorOptions.sort((a,b)=>a.label.localeCompare(b.label));
  }
  return {
    actorOptions,
    actions: Array.from(
      new Set(facetRows.map((row) => row.action).filter(Boolean) as string[])
    ).sort((left, right) => left.localeCompare(right)),
    entityTypes: Array.from(
      new Set(facetRows.map((row) => row.entity_type).filter(Boolean) as string[])
    ).sort((left, right) => left.localeCompare(right)),
    events: (eventsResult.data || []) as AuditExplorerEvent[],
    totalCount: eventsResult.count || 0,
  };
}

function csvCell(value: unknown) {
  const text =
    typeof value === "string"
      ? value
      : value == null
        ? ""
        : JSON.stringify(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function auditEventsToCsv(events: AuditExplorerEvent[]) {
  const headers = [
    "created_at",
    "action",
    "actor_user_id",
    "entity_type",
    "entity_id",
    "metadata",
  ];
  const rows = events.map((event) =>
    [
      event.created_at,
      event.action,
      event.actor_user_id,
      event.entity_type,
      event.entity_id,
      event.metadata,
    ]
      .map(csvCell)
      .join(",")
  );

  return [headers.join(","), ...rows].join("\n");
}