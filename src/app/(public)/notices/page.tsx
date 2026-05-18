import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  FileText,
  FolderArchive,
  LinkIcon,
} from "lucide-react";
import { NoticePublicFilters } from "@/components/notices/notice-public-filters";
import {
  formatDisplayDate,
  getPublishedNotices,
  type NoticePreview,
} from "@/lib/content/public-content";

export const revalidate = 60;

export const metadata = {
  title: "Notices — JnU IT Society",
  description:
    "Official notices, announcements, and decisions from Jagannath University IT Society.",
};

const policyTiles = [
  {
    icon: FolderArchive,
    title: "Category clarity",
    body: "Each update is labelled by type so members can scan decisions, notices, and announcements quickly.",
  },
  {
    icon: CheckCircle2,
    title: "Verified source",
    body: "Public notices are published from the JnUITS content workspace and operator review flow.",
  },
  {
    icon: LinkIcon,
    title: "Stable public route",
    body: "Every notice keeps a permanent URL for sharing, referencing, and future verification.",
  },
];

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

function buildNoticeHref({
  category,
  page,
  query,
}: {
  category: string;
  page: number;
  query: string;
}) {
  const params = new URLSearchParams();

  if (query) {
    params.set("q", query);
  }

  if (category) {
    params.set("category", category);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const queryString = params.toString();
  return queryString ? `/notices?${queryString}` : "/notices";
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

function categoryTone(category: string) {
  const normalized = category.toLowerCase();

  if (normalized.includes("announcement")) {
    return "announcement";
  }

  if (normalized.includes("decision")) {
    return "decision";
  }

  return "notice";
}

function noticeDetailHref(notice: NoticePreview) {
  return notice.href || `/notices/${notice.slug}`;
}

function isCloudinaryAttachment(href: string | null | undefined) {
  if (!href) {
    return false;
  }

  try {
    const url = new URL(href);

    return url.protocol === "https:" && url.hostname === "res.cloudinary.com";
  } catch {
    return false;
  }
}

function noticeAttachmentHref(notice: NoticePreview) {
  if (!notice.ctaHref) {
    return null;
  }

  if (notice.slug && isCloudinaryAttachment(notice.ctaHref)) {
    return `/notices/${notice.slug}/attachment`;
  }

  return notice.ctaHref;
}

export default async function NoticesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = asString(params.q).trim();
  const category = asString(params.category).trim();
  const requestedPage = asPositiveInteger(params.page);
  const notices = await getPublishedNotices({
    category,
    page: requestedPage,
    query,
  });
  const pageNumbers = buildPageNumbers(notices.page, notices.totalPages);
  const firstVisibleItem = notices.totalItems
    ? (notices.page - 1) * 12 + 1
    : 0;
  const lastVisibleItem = Math.min(notices.page * 12, notices.totalItems);
  const statusChips = [
    {
      label: notices.totalItems === 1 ? "Published notice" : "Published notices",
      value: notices.totalItems,
    },
    { label: "Drafts", value: 0 },
    { label: "Archived", value: 0 },
  ];

  return (
    <main className="notices-page">
      <section className="notices-hero">
        <div className="shell notices-hero__inner">
          <span className="notices-eyebrow">Notices & decisions</span>
          <h1 className="notices-hero__title">
            Official notices and announcements from JnUITS
          </h1>
          <p className="notices-hero__summary">
            Program updates, important dates, membership notices, and society
            decisions are published here for members, students, and the public.
          </p>

          <div aria-label="Notice status summary" className="notices-stat-chips">
            {statusChips.map((item) => (
              <span
                className={`notices-stat-chip${
                  item.value === 0 ? " notices-stat-chip--zero" : ""
                }`}
                key={item.label}
              >
                <strong>{item.value}</strong> {item.label}
              </span>
            ))}
          </div>

          <div className="notices-policy-grid">
            {policyTiles.map((item) => {
              const Icon = item.icon;

              return (
                <article className="notices-policy-tile" key={item.title}>
                  <span className="notices-policy-tile__icon">
                    <Icon aria-hidden="true" size={20} />
                  </span>
                  <div>
                    <h2>{item.title}</h2>
                    <p>{item.body}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="shell notices-stream">
        <div className="notices-stream__header">
          <div>
            <p className="section-divider">Notice stream</p>
            <h2 className="notices-stream__title">Latest public updates</h2>
          </div>
          <p className="notices-stream__count">
            Showing{" "}
            {firstVisibleItem === lastVisibleItem
              ? firstVisibleItem
              : `${firstVisibleItem}-${lastVisibleItem}`}{" "}
            of {notices.totalItems} notice
            {notices.totalItems === 1 ? "" : "s"}
          </p>
        </div>

        <NoticePublicFilters
          categories={notices.categories}
          category={category}
          query={query}
        />

        {notices.items.length ? (
          <div className="notices-list">
            {notices.items.map((notice) => {
              const tone = categoryTone(notice.category);
              const attachmentHref = noticeAttachmentHref(notice);
              const attachmentIsPdf = Boolean(
                notice.ctaHref?.toLowerCase().includes(".pdf") ||
                  attachmentHref?.toLowerCase().includes(".pdf")
              );

              return (
                <article
                  className={`notices-card notices-card--${tone}`}
                  key={notice.slug || notice.title}
                >
                  <div className="notices-card__content">
                    <div className="notices-card__meta">
                      <span className="notices-date-chip">
                        <CalendarDays aria-hidden="true" size={15} />
                        {formatDisplayDate(notice.publishedAt)}
                      </span>
                      <span
                        className={`notices-category-badge notices-category-badge--${tone}`}
                      >
                        {notice.category}
                      </span>
                      <span className="notices-live">
                        <span aria-hidden="true" />
                        Live
                      </span>
                    </div>
                    <h3>
                      <Link href={noticeDetailHref(notice)}>{notice.title}</Link>
                    </h3>
                    <p>{notice.summary}</p>
                  </div>

                  <div className="notices-card__actions">
                    <Link className="primary-button" href={noticeDetailHref(notice)}>
                      Read notice
                      <ArrowRight aria-hidden="true" size={15} />
                    </Link>
                    {attachmentHref ? (
                      <Link
                        className="secondary-button"
                        href={attachmentHref}
                        rel={
                          attachmentHref.startsWith("/")
                            ? undefined
                            : "noopener noreferrer"
                        }
                        target={attachmentHref.startsWith("/") ? "_blank" : "_blank"}
                      >
                        {attachmentIsPdf ? "Open PDF" : "Related link"}
                        <ExternalLink aria-hidden="true" size={15} />
                      </Link>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="notices-empty">
            <FileText aria-hidden="true" size={30} />
            <h2>No notices match your filters</h2>
            <p>Try a different keyword or clear the current category filter.</p>
            <Link className="secondary-button" href="/notices">
              Clear filters
            </Link>
          </div>
        )}

        {notices.totalPages > 1 ? (
          <nav aria-label="Notice pages" className="notices-pagination">
            <Link
              aria-disabled={notices.page <= 1}
              className={`secondary-button ${
                notices.page <= 1 ? "pointer-events-none opacity-50" : ""
              }`}
              href={buildNoticeHref({
                category,
                page: Math.max(1, notices.page - 1),
                query,
              })}
            >
              Previous
            </Link>
            {pageNumbers.map((pageNumber) => (
              <Link
                aria-current={pageNumber === notices.page ? "page" : undefined}
                className={
                  pageNumber === notices.page ? "primary-button" : "secondary-button"
                }
                href={buildNoticeHref({
                  category,
                  page: pageNumber,
                  query,
                })}
                key={pageNumber}
              >
                {pageNumber}
              </Link>
            ))}
            <Link
              aria-disabled={notices.page >= notices.totalPages}
              className={`secondary-button ${
                notices.page >= notices.totalPages
                  ? "pointer-events-none opacity-50"
                  : ""
              }`}
              href={buildNoticeHref({
                category,
                page: Math.min(notices.totalPages, notices.page + 1),
                query,
              })}
            >
              Next
            </Link>
          </nav>
        ) : null}
      </section>
    </main>
  );
}
