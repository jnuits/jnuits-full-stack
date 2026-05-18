import Link from "next/link";
import { cookies } from "next/headers";
import {
  Archive,
  ExternalLink,
  FileCheck2,
  FilePenLine,
  FileText,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import {
  ADMIN_FLASH_COOKIE_NAME,
  parseAdminFlash,
} from "@/lib/admin/flash";
import {
  formatNoticeAdminDate,
  getAdminNoticesDashboard,
  type AdminNoticeListItem,
} from "@/lib/content/notices";
import { updateNoticeLifecycle } from "./actions";

export const metadata = { title: "Notices — Admin | JnUITS" };

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

function buildNoticesAdminHref({
  category,
  page,
  query,
  status,
}: {
  category: string;
  page: number;
  query: string;
  status: string;
}) {
  const params = new URLSearchParams();

  if (query) {
    params.set("q", query);
  }

  if (status) {
    params.set("status", status);
  }

  if (category) {
    params.set("category", category);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const queryString = params.toString();
  return queryString
    ? `/admin/content/notices?${queryString}`
    : "/admin/content/notices";
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

function lifecycleIntent(status: string) {
  return status === "published" ? "archive" : "publish";
}

function lifecycleLabel(status: string) {
  return status === "published" ? "Archive Notice" : "Publish Notice";
}

function AdminNoticeListRow({ notice }: { notice: AdminNoticeListItem }) {
  const status = notice.status || "draft";

  return (
    <article className={`admin-notice-row admin-notice-row--${status}`}>
      <div className="admin-notice-row__icon" aria-hidden="true">
        <FileText size={22} />
        <span />
      </div>

      <div className="admin-notice-row__body">
        <div className="admin-notice-row__meta">
          <div className="admin-notice-row__badges">
            <span className={`notice-status-badge notice-status-badge--${status}`}>
              {status}
            </span>
            <span className="notice-category-pill">{notice.category}</span>
          </div>
          <span className="admin-notice-row__date">
            {formatNoticeAdminDate(notice.publishedAt)}
          </span>
        </div>

        <h2 className="admin-notice-row__title" title={notice.title}>
          {notice.title}
        </h2>
        <p className="admin-notice-row__slug">/notices/{notice.slug}</p>
        <p className="admin-notice-row__summary">
          {notice.summary || "No summary has been written yet."}
        </p>
      </div>

      <div className="admin-notice-row__actions">
        <Link
          className="admin-btn admin-btn--ghost admin-notice-row__editor"
          href={`/admin/content/notices/${notice.id}`}
        >
          Open editor
        </Link>
        <details className="admin-actions-menu">
          <summary
            aria-label={`More actions for ${notice.title}`}
            className="admin-actions-menu__trigger"
            title="More actions"
          >
            <MoreHorizontal aria-hidden="true" size={17} />
          </summary>
          <div className="admin-actions-menu__panel">
            <Link
              className="admin-actions-menu__item"
              href={`/admin/content/notices/${notice.id}`}
            >
              <Pencil aria-hidden="true" size={15} />
              Edit Notice
            </Link>
            {notice.status === "published" ? (
              <Link
                className="admin-actions-menu__item"
                href={`/notices/${notice.slug}`}
                rel="noreferrer"
                target="_blank"
              >
                <ExternalLink aria-hidden="true" size={15} />
                View Public Notice
              </Link>
            ) : null}
            <form action={updateNoticeLifecycle}>
              <input name="noticeId" type="hidden" value={notice.id} />
              <input
                name="intent"
                type="hidden"
                value={lifecycleIntent(notice.status)}
              />
              <button className="admin-actions-menu__item" type="submit">
                <Archive aria-hidden="true" size={15} />
                {lifecycleLabel(notice.status)}
              </button>
            </form>
            <details className="admin-actions-menu__confirm">
              <summary className="admin-actions-menu__item admin-actions-menu__item--danger">
                <Trash2 aria-hidden="true" size={15} />
                Delete
              </summary>
              <form action={updateNoticeLifecycle}>
                <input name="noticeId" type="hidden" value={notice.id} />
                <input name="intent" type="hidden" value="delete" />
                <button
                  className="admin-actions-menu__item admin-actions-menu__item--danger"
                  type="submit"
                >
                  Confirm delete
                </button>
              </form>
            </details>
          </div>
        </details>
      </div>
    </article>
  );
}

export default async function NoticesAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = asString(params.q).trim();
  const status = asString(params.status).trim();
  const category = asString(params.category).trim();
  const requestedPage = asPositiveInteger(params.page);
  const cookieStore = await cookies();
  const flash = parseAdminFlash(cookieStore.get(ADMIN_FLASH_COOKIE_NAME)?.value);
  const dashboard = await getAdminNoticesDashboard({
    category,
    page: requestedPage,
    query,
    status,
  });
  const pageNumbers = buildPageNumbers(dashboard.page, dashboard.totalPages);
  const firstVisibleItem = dashboard.totalItems
    ? (dashboard.page - 1) * 12 + 1
    : 0;
  const lastVisibleItem = Math.min(dashboard.page * 12, dashboard.totalItems);

  return (
    <div className="grid gap-7">
      <header className="admin-page-header">
        <div>
          <p className="admin-page-header__breadcrumb">
            Admin / Content / Notices
          </p>
          <h1 className="admin-page-header__title">Notices</h1>
          <p className="admin-page-header__desc">
            Manage official announcements, publication status, stable public
            routes, and external attachment links.
          </p>
        </div>
        <Link className="admin-btn admin-btn--primary" href="/admin/content/notices/new">
          <Plus aria-hidden="true" size={15} />
          New notice
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

      <section
        className="admin-metric-grid notice-admin-metrics"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(11rem, 1fr))" }}
      >
        <article className="admin-metric-card" data-tone="info">
          <div className="admin-metric-card__icon">
            <FileText size={16} />
          </div>
          <p className="admin-metric-card__value">{dashboard.metrics.total}</p>
          <p className="admin-metric-card__label">Total</p>
        </article>
        <article className="admin-metric-card" data-tone="success">
          <div className="admin-metric-card__icon">
            <FileCheck2 size={16} />
          </div>
          <p className="admin-metric-card__value">{dashboard.metrics.published}</p>
          <p className="admin-metric-card__label">Published</p>
        </article>
        <article className="admin-metric-card" data-tone="warning">
          <div className="admin-metric-card__icon">
            <FilePenLine size={16} />
          </div>
          <p className="admin-metric-card__value">{dashboard.metrics.drafts}</p>
          <p className="admin-metric-card__label">Drafts</p>
        </article>
        <article className="admin-metric-card" data-tone="danger">
          <div className="admin-metric-card__icon">
            <Archive size={16} />
          </div>
          <p className="admin-metric-card__value">{dashboard.metrics.archived}</p>
          <p className="admin-metric-card__label">Archived</p>
        </article>
      </section>

      <form action="/admin/content/notices" className="notice-admin-filters">
        <label className="notice-admin-filter-field notice-admin-filter-field--search">
          <span>Search</span>
          <div className="notice-admin-filter-field__input">
            <Search aria-hidden="true" size={15} />
            <input
              defaultValue={query}
              name="q"
              placeholder="Search title, slug, category, or summary"
              type="search"
            />
          </div>
        </label>
        <label className="notice-admin-filter-field">
          <span>Status</span>
          <select defaultValue={status} name="status">
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label className="notice-admin-filter-field">
          <span>Category</span>
          <select defaultValue={category} name="category">
            <option value="">All categories</option>
            {dashboard.categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <div className="notice-admin-filter-actions">
          <button className="admin-btn admin-btn--primary" type="submit">
            Filter notices
          </button>
          {query || status || category ? (
            <Link className="admin-btn admin-btn--ghost" href="/admin/content/notices">
              Reset
            </Link>
          ) : null}
        </div>
      </form>

      <section className="notice-admin-queue grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="admin-section-label">Notice queue</p>
          <span className="text-sm text-[var(--muted-foreground)]">
            Showing {firstVisibleItem}-{lastVisibleItem} of {dashboard.totalItems} notice
            {dashboard.totalItems === 1 ? "" : "s"}
          </span>
        </div>

        {dashboard.items.length ? (
          <div className="grid gap-3">
            {dashboard.items.map((notice) => (
              <AdminNoticeListRow key={notice.id} notice={notice} />
            ))}
          </div>
        ) : (
          <EmptyState
            description="Create the first notice or widen the current filters."
            title="No notices matched these filters"
          />
        )}
      </section>

      {dashboard.totalPages > 1 ? (
        <nav
          aria-label="Notice workspace pagination"
          className="flex flex-wrap justify-center gap-2"
        >
          <Link
            aria-disabled={dashboard.page <= 1}
            className={`admin-btn admin-btn--ghost ${
              dashboard.page <= 1 ? "pointer-events-none opacity-50" : ""
            }`}
            href={buildNoticesAdminHref({
              category,
              page: Math.max(1, dashboard.page - 1),
              query,
              status,
            })}
          >
            Previous
          </Link>
          {pageNumbers.map((pageNumber) => (
            <Link
              aria-current={pageNumber === dashboard.page ? "page" : undefined}
              className={`admin-btn ${
                pageNumber === dashboard.page
                  ? "admin-btn--primary"
                  : "admin-btn--ghost"
              }`}
              href={buildNoticesAdminHref({
                category,
                page: pageNumber,
                query,
                status,
              })}
              key={pageNumber}
            >
              {pageNumber}
            </Link>
          ))}
          <Link
            aria-disabled={dashboard.page >= dashboard.totalPages}
            className={`admin-btn admin-btn--ghost ${
              dashboard.page >= dashboard.totalPages
                ? "pointer-events-none opacity-50"
                : ""
            }`}
            href={buildNoticesAdminHref({
              category,
              page: Math.min(dashboard.totalPages, dashboard.page + 1),
              query,
              status,
            })}
          >
            Next
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
