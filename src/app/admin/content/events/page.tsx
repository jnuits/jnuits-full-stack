import { requireAdminPagePermission as requireAdminPermission } from "@/lib/admin/activity/page-access";
import Link from "next/link";
import { cookies } from "next/headers";
import {
  CalendarClock,
  CalendarDays,
  FilePenLine,
  Plus,
} from "lucide-react";
import { AdminEventFilters } from "@/components/admin/admin-event-filters";
import { AdminEventListItem } from "@/components/admin/admin-event-list-item";
import { EmptyState } from "@/components/ui/empty-state";
import {
  ADMIN_FLASH_COOKIE_NAME,
  parseAdminFlash,
} from "@/lib/admin/flash";
import { getAdminEventsDashboard } from "@/lib/content/events";

export const metadata = { title: "Events — Admin | JnUITS" };

function asString(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function asPositiveInteger(value: string | string[] | undefined) {
  if (typeof value !== "string") {
    return 1;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function buildEventsAdminHref({
  category,
  page,
  query,
  status,
  timeframe,
}: {
  category: string;
  page: number;
  query: string;
  status: string;
  timeframe: string;
}) {
  const params = new URLSearchParams();

  if (query) {
    params.set("q", query);
  }

  if (status) {
    params.set("status", status);
  }

  if (timeframe && timeframe !== "all") {
    params.set("timeframe", timeframe);
  }

  if (category) {
    params.set("category", category);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const queryString = params.toString();

  return queryString
    ? `/admin/content/events?${queryString}`
    : "/admin/content/events";
}

function buildPageNumbers(currentPage: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  return Array.from(
    new Set([1, currentPage - 1, currentPage, currentPage + 1, totalPages])
  )
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((left, right) => left - right);
}

export default async function EventsAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPermission("cms.events.manage", { fallbackPath: "/admin/dashboard" });
  const params = await searchParams;
  const query = asString(params.q).trim();
  const status = asString(params.status).trim();
  const timeframe = asString(params.timeframe).trim() || "all";
  const category = asString(params.category).trim();
  const requestedPage = asPositiveInteger(params.page);
  const cookieStore = await cookies();
  const flash = parseAdminFlash(cookieStore.get(ADMIN_FLASH_COOKIE_NAME)?.value);
  const dashboard = await getAdminEventsDashboard({
    category,
    page: requestedPage,
    query,
    status,
    timeframe:
      timeframe === "upcoming" || timeframe === "past" ? timeframe : "all",
  });
  const pageNumbers = buildPageNumbers(dashboard.page, dashboard.totalPages);
  const firstVisibleItem = dashboard.totalItems
    ? (dashboard.page - 1) * 12 + 1
    : 0;
  const lastVisibleItem = Math.min(
    dashboard.page * 12,
    dashboard.totalItems
  );

  return (
    <div className="grid gap-7">
      <header className="admin-page-header">
        <div>
          <p className="admin-page-header__breadcrumb">Admin / Content</p>
          <h1 className="admin-page-header__title">Events</h1>
          <p className="admin-page-header__desc">
            Operator workspace for scheduling, publishing, registration control,
            and reusable media-backed event covers.
          </p>
        </div>
        <Link className="admin-btn admin-btn--primary" href="/admin/content/events/new">
          <Plus aria-hidden="true" size={15} />
          New event
        </Link>
      </header>

      {flash ? (
        <section className="flash-panel" data-tone={flash.tone}>
          <p className="admin-section-label">Operator feedback</p>
          <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold">
            {flash.title}
          </h2>
          <p className="mt-1 text-sm leading-7">{flash.message}</p>
        </section>
      ) : null}

      <section className="admin-metric-grid">
        <article className="admin-metric-card" data-tone="info">
          <div className="admin-metric-card__icon">
            <CalendarDays size={16} />
          </div>
          <p className="admin-metric-card__label">Total events</p>
          <p className="admin-metric-card__value">{dashboard.metrics.total}</p>
          <p className="admin-metric-card__sub">All statuses</p>
        </article>
        <article className="admin-metric-card" data-tone="success">
          <div className="admin-metric-card__icon">
            <CalendarClock size={16} />
          </div>
          <p className="admin-metric-card__label">Upcoming</p>
          <p className="admin-metric-card__value">{dashboard.metrics.upcoming}</p>
          <p className="admin-metric-card__sub">Future and current events</p>
        </article>
        <article className="admin-metric-card">
          <div className="admin-metric-card__icon">
            <FilePenLine size={16} />
          </div>
          <p className="admin-metric-card__label">Past</p>
          <p className="admin-metric-card__value">{dashboard.metrics.past}</p>
          <p className="admin-metric-card__sub">Completed events</p>
        </article>
        <article className="admin-metric-card" data-tone="draft">
          <p className="admin-metric-card__label">Drafts</p>
          <p className="admin-metric-card__value">{dashboard.metrics.drafts}</p>
          <p className="admin-metric-card__sub">Not visible publicly</p>
        </article>
      </section>

      <AdminEventFilters
        categories={dashboard.categories}
        category={category}
        query={query}
        status={status}
        timeframe={timeframe}
      />

      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="admin-section-label">Event queue</p>
          <span className="text-sm text-[var(--muted-foreground)]">
            Showing {firstVisibleItem}-{lastVisibleItem} of {dashboard.totalItems} event
            {dashboard.totalItems === 1 ? "" : "s"}
          </span>
        </div>

        {dashboard.items.length ? (
          <div className="grid gap-2.5">
            {dashboard.items.map((event) => (
              <AdminEventListItem event={event} key={event.id} />
            ))}
          </div>
        ) : (
          <EmptyState
            description="Create the first event or widen the current filters."
            title="No events matched these filters"
          />
        )}
      </section>

      {dashboard.totalPages > 1 ? (
        <nav aria-label="Event workspace pagination" className="flex flex-wrap justify-center gap-2">
          <Link
            aria-disabled={dashboard.page <= 1}
            className={`secondary-button ${dashboard.page <= 1 ? "pointer-events-none opacity-50" : ""}`}
            href={buildEventsAdminHref({
              category,
              page: Math.max(1, dashboard.page - 1),
              query,
              status,
              timeframe,
            })}
          >
            Previous
          </Link>
          {pageNumbers.map((pageNumber) => (
            <Link
              aria-current={pageNumber === dashboard.page ? "page" : undefined}
              className={pageNumber === dashboard.page ? "primary-button" : "secondary-button"}
              href={buildEventsAdminHref({
                category,
                page: pageNumber,
                query,
                status,
                timeframe,
              })}
              key={pageNumber}
            >
              {pageNumber}
            </Link>
          ))}
          <Link
            aria-disabled={dashboard.page >= dashboard.totalPages}
            className={`secondary-button ${dashboard.page >= dashboard.totalPages ? "pointer-events-none opacity-50" : ""}`}
            href={buildEventsAdminHref({
              category,
              page: Math.min(dashboard.totalPages, dashboard.page + 1),
              query,
              status,
              timeframe,
            })}
          >
            Next
          </Link>
        </nav>
      ) : null}
    </div>
  );
}

