import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ExternalLink,
  FileText,
  Folder,
  LinkIcon,
  Paperclip,
} from "lucide-react";
import {
  formatDisplayDate,
  getPublishedNoticeByIdentifier,
  getPublishedNotices,
} from "@/lib/content/public-content";
import { NoticeMarkdown } from "@/components/notices/notice-markdown";
import { NoticePermalinkCopy } from "@/components/notices/notice-permalink-copy";
import { NoticeShareActions } from "@/components/notices/notice-share-actions";

export const revalidate = 60;

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

export default async function NoticeDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const notice = await getPublishedNoticeByIdentifier(slug);

  if (!notice) {
    notFound();
  }

  if (slug !== notice.slug) {
    redirect(`/notices/${notice.slug}`);
  }

  const archive = await getPublishedNotices({ page: 1 });
  const relatedNotices = archive.items
    .filter((item) => item.slug !== notice.slug)
    .slice(0, 3);
  const currentIndex = archive.items.findIndex((item) => item.slug === notice.slug);
  const previousNotice =
    currentIndex >= 0 ? archive.items[currentIndex + 1] || null : null;
  const nextNotice =
    currentIndex > 0 ? archive.items[currentIndex - 1] || null : null;
  const hasExtendedBody = Boolean(
    notice.body?.trim() && notice.body.trim() !== notice.summary.trim()
  );
  const bodySource = hasExtendedBody
    ? notice.body?.trim() || ""
    : notice.summary.trim();
  const tone = categoryTone(notice.category);
  const permalink = `/notices/${notice.slug}`;

  return (
    <main className="notices-page">
      <div className="shell notices-detail-shell">
        <Link className="notice-detail__back" href="/notices">
          <ArrowLeft aria-hidden="true" size={15} />
          Back to notices
        </Link>

        <article className="notice-detail glass-card">
          <div className="notice-detail__meta">
            <span className={`notices-category-badge notices-category-badge--${tone}`}>
              {notice.category}
            </span>
            <span className="notice-detail__date">
              <CalendarDays aria-hidden="true" size={16} />
              {formatDisplayDate(notice.publishedAt)}
            </span>
          </div>
          <h1>{notice.title}</h1>
          <p className="notice-detail__summary">{notice.summary}</p>
          <div className="notice-detail__chips" aria-label="Notice metadata">
            <span>
              <Folder aria-hidden="true" size={15} />
              {notice.category}
            </span>
            <span>
              <CalendarDays aria-hidden="true" size={15} />
              {formatDisplayDate(notice.publishedAt)}
            </span>
            <span>
              <LinkIcon aria-hidden="true" size={15} />
              Stable route
            </span>
          </div>
        </article>

        <div className="notice-detail-layout">
          <section className="notice-detail-body section-band">
            <p className="section-divider">Notice details</p>
            {notice.ctaHref ? (
              <Link
                className="notice-detail-body__attachment"
                href={notice.ctaHref}
                rel="noopener noreferrer"
                target="_blank"
              >
                <Paperclip aria-hidden="true" size={16} />
                {notice.ctaHref.toLowerCase().includes(".pdf")
                  ? "View PDF notice"
                  : "View attachment"}
                <ExternalLink aria-hidden="true" size={15} />
              </Link>
            ) : null}
            <div className="notice-detail-body__content">
              <NoticeMarkdown source={bodySource} />
            </div>
          </section>

          <aside className="notice-detail-sidebar" aria-label="Notice metadata">
            <section className="notice-sidebar-card">
              <h2>About this notice</h2>
              <dl>
                <div>
                  <dt>Category</dt>
                  <dd>{notice.category}</dd>
                </div>
                <div>
                  <dt>Published</dt>
                  <dd>{formatDisplayDate(notice.publishedAt)}</dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>JnUITS Official</dd>
                </div>
              </dl>
              <NoticePermalinkCopy permalink={permalink} />
            </section>

            <section className="notice-sidebar-card">
              <h2>Share this notice</h2>
              <NoticeShareActions title={notice.title} />
            </section>

            {relatedNotices.length ? (
              <section className="notice-sidebar-card">
                <h2>Related notices</h2>
                <div className="notice-sidebar-links">
                  {relatedNotices.map((item) => (
                    <Link href={item.href || `/notices/${item.slug}`} key={item.slug}>
                      <FileText aria-hidden="true" size={14} />
                      <span>{item.title}</span>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
          </aside>
        </div>

        <nav aria-label="Adjacent notices" className="notice-detail-nav">
          {previousNotice ? (
            <Link
              className="notice-detail-nav__button notice-detail-nav__button--previous"
              href={`/notices/${previousNotice.slug}`}
            >
              <ArrowLeft aria-hidden="true" size={15} />
              Previous notice
            </Link>
          ) : (
            <span className="notice-detail-nav__button notice-detail-nav__button--previous notice-detail-nav__button--disabled">
              <ArrowLeft aria-hidden="true" size={15} />
              Previous notice
            </span>
          )}
          {nextNotice ? (
            <Link
              className="notice-detail-nav__button notice-detail-nav__button--next"
              href={`/notices/${nextNotice.slug}`}
            >
              Next notice
              <ArrowRight aria-hidden="true" size={15} />
            </Link>
          ) : (
            <span className="notice-detail-nav__button notice-detail-nav__button--next notice-detail-nav__button--disabled">
              Next notice
              <ArrowRight aria-hidden="true" size={15} />
            </span>
          )}
        </nav>
      </div>
    </main>
  );
}
