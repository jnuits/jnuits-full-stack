import { requireAdminPagePermission as requireAdminPermission } from "@/lib/admin/activity/page-access";
import { AdminActivityView } from "@/components/admin/admin-activity-view";
import Link from "next/link";
import { AutoSubmitForm } from "@/components/admin/auto-submit-form";
import { Download, RotateCcw, Search, ShieldCheck } from "lucide-react";
import {
  loadAuditExplorerData,
  parseAuditFilters,
  type AuditExplorerEvent,
} from "@/lib/admin/audit-explorer";

export const metadata = { title: "Audit Explorer - Admin | JnUITS" };

type SearchParams = Record<string, string | string[] | undefined>;

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-BD", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function shortId(value: string | null) {
  if (!value) return "No ID";
  return value.length > 18 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;
}

function metadataPreview(value: unknown) {
  if (!value || typeof value !== "object") {
    return "No metadata";
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function entityHref(event: AuditExplorerEvent) {
  if (!event.entity_type || !event.entity_id) return null;

  if (event.entity_type.includes("member")) return "/admin/membership";
  if (event.entity_type.includes("invitation")) return "/admin/invitations";
  if (event.entity_type.includes("profile_update")) return "/admin/profile-changes";
  if (event.entity_type.includes("event")) return "/admin/content/events";
  if (event.entity_type.includes("gallery")) return "/admin/content/gallery";
  if (event.entity_type.includes("project")) return "/admin/content/projects";
  if (event.entity_type.includes("certificate")) return "/admin/certificates";
  if (event.entity_type.includes("operator_report")) return "/admin/reports";

  return null;
}

function buildHref(params: URLSearchParams, overrides: Record<string, string | number | null>) {
  const next = new URLSearchParams(params);
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null || value === "") {
      next.delete(key);
    } else {
      next.set(key, String(value));
    }
  }
  const query = next.toString();
  return query ? `/admin/audit?${query}` : "/admin/audit";
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdminPermission("admin.audit.read", { fallbackPath: "/admin/dashboard" });
  const resolved = await searchParams;
  if (resolved.view === "activity") {
    return <div className="grid gap-6"><div className="admin-page-header"><div><p className="admin-page-header__breadcrumb">Admin / Security</p><h1 className="admin-page-header__title">Admin activity</h1></div></div><nav aria-label="Audit views" className="flex flex-wrap gap-3"><Link className="ghost-button" href="/admin/audit">Legacy audit</Link><Link className="secondary-button" aria-current="page" href="/admin/audit?view=activity">Admin activity</Link></nav><AdminActivityView params={resolved}/></div>;
  }
  const filters = parseAuditFilters(resolved);
  const { actions, actorOptions, entityTypes, events, totalCount } = await loadAuditExplorerData(filters);
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(resolved)) {
    if (typeof value === "string" && value) params.set(key, value);
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / filters.pageSize));
  const exportHref = `/admin/audit/export?${new URLSearchParams({
    ...Object.fromEntries(params),
    pageSize: "1000",
  }).toString()}`;

  return (
    <div className="grid gap-8">
      <nav aria-label="Audit views" className="flex flex-wrap gap-3"><Link className="secondary-button" aria-current="page" href="/admin/audit">Legacy audit</Link><Link className="ghost-button" href="/admin/audit?view=activity">Admin activity</Link></nav>
      <div className="admin-page-header">
        <div>
          <p className="admin-page-header__breadcrumb">Admin / Security</p>
          <h1 className="admin-page-header__title">Audit Explorer</h1>
          <p className="admin-page-header__desc">
            Search sensitive admin events by action, actor, entity, and time range.
            Export filtered evidence without exposing raw database errors.
          </p>
        </div>
        <span className="abadge abadge--active">
          <ShieldCheck size={10} /> {totalCount} events
        </span>
      </div>

      <section className="section-band">
        <AutoSubmitForm action="/admin/audit" className="admin-filter-form">
          <div className="admin-filter-grid">
            <label className="input-label">
              Search
              <div className="relative">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
                <input className="pl-9" defaultValue={filters.q} name="q" placeholder="Action, entity type, or ID" />
              </div>
            </label>
            <label className="input-label">
              Action contains
              <input defaultValue={filters.action} name="action" placeholder="membership.invitation" list="audit-actions" />
              <datalist id="audit-actions">
                {actions.map((action) => <option key={action} value={action} />)}
              </datalist>
            </label>
            <label className="input-label">
              Entity type
              <select defaultValue={filters.entityType} name="entityType">
                <option value="">All entities</option>
                {entityTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            <label className="input-label">
              Actor user ID
              <input defaultValue={filters.actor} name="actor" placeholder="Choose an actor or enter a UUID" list="audit-actors" />
              <datalist id="audit-actors">
                {actorOptions.map(actor=><option key={actor.userId} value={actor.userId} label={actor.label} />)}
              </datalist>
            </label>
            <label className="input-label">
              From
              <input defaultValue={filters.from} name="from" type="date" />
            </label>
            <label className="input-label">
              To
              <input defaultValue={filters.to} name="to" type="date" />
            </label>
            <label className="input-label">
              Page size
              <select defaultValue={filters.pageSize} name="pageSize">
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </label>
            <div className="admin-action-row">
              <Link className="admin-btn admin-btn--ghost" href="/admin/audit">
                <RotateCcw size={14} /> Reset
              </Link>
            </div>
          </div>
        </AutoSubmitForm>
      </section>

      <section className="section-band">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="section-divider">Filtered events</p>
            <h2 className="mt-3 font-[family-name:var(--font-heading)] text-2xl font-semibold">
              {events.length} shown from {totalCount} matching audit events
            </h2>
          </div>
          <Link className="admin-btn admin-btn--secondary" href={exportHref} prefetch={false}>
            <Download size={14} /> Export CSV
          </Link>
        </div>

        <div className="mt-6 grid gap-3">
          {events.length === 0 ? (
            <div className="empty-state">No audit events match the current filters.</div>
          ) : (
            events.map((event) => {
              const href = entityHref(event);
              return (
                <article className="route-tile min-w-0" key={event.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3>{event.action}</h3>
                      <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
                        {event.entity_type} · {shortId(event.entity_id)} · actor {shortId(event.actor_user_id)}
                      </p>
                    </div>
                    <span className="status-pill">{formatDate(event.created_at)}</span>
                  </div>
                  <details className="admin-expandable-details mt-3">
                    <summary className="cursor-pointer text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                      Metadata payload ({event.metadata && typeof event.metadata === "object" ? Object.keys(event.metadata).length : 0} fields)
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-[var(--line)] bg-[var(--background)] p-3 text-xs leading-6 [overflow-wrap:anywhere] text-[var(--muted-foreground)]">
                      {metadataPreview(event.metadata)}
                    </pre>
                  </details>
                  {href ? (
                    <Link className="queue-link mt-3 inline-flex" href={href}>
                      Open related admin area
                    </Link>
                  ) : null}
                </article>
              );
            })
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--muted-foreground)]">
            Page {filters.page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Link
              aria-disabled={filters.page <= 1}
              className="admin-btn admin-btn--ghost"
              href={buildHref(params, { page: Math.max(1, filters.page - 1) })}
            >
              Previous
            </Link>
            <Link
              aria-disabled={filters.page >= totalPages}
              className="admin-btn admin-btn--ghost"
              href={buildHref(params, { page: Math.min(totalPages, filters.page + 1) })}
            >
              Next
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
