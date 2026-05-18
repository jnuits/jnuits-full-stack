import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Copy,
  ExternalLink,
  FileText,
  Folder,
  LinkIcon,
} from "lucide-react";
import {
  formatDisplayDate,
  getPublishedNoticeByIdentifier,
  getPublishedNotices,
} from "@/lib/content/public-content";
import { NoticeMarkdown } from "@/components/notices/notice-markdown";
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
  const bodySource =
    notice.body && notice.body.trim() !== notice.summary.trim()
      ? notice.body
      : notice.summary;
  const tone = categoryTone(notice.category);
  const permalink = `/notices/${notice.slug}`;

  return (
    <main className="notices-page">
      <div className="shell notices-detail-shell">
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
          <Link className="secondary-button notice-detail__back" href="/notices">
            <ArrowLeft aria-hidden="true" size={15} />
            Back to notices
          </Link>
        </article>

        <div className="notice-detail-layout">
          <section className="notice-detail-body section-band">
            <p className="section-divider">Notice details</p>
            <div className="notice-detail-body__content">
              <NoticeMarkdown source={bodySource} />
            </div>
            {notice.ctaHref ? (
              <Link
                className="primary-button notice-detail-body__attachment"
                href={notice.ctaHref}
                rel={
                  notice.ctaHref.startsWith("/") ? undefined : "noopener noreferrer"
                }
                target={notice.ctaHref.startsWith("/") ? undefined : "_blank"}
              >
                {notice.ctaHref.toLowerCase().includes(".pdf")
                  ? "View PDF notice"
                  : "View attachment"}
                <ExternalLink aria-hidden="true" size={15} />
              </Link>
            ) : null}
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
              <Link className="notice-permalink" href={permalink}>
                <Copy aria-hidden="true" size={14} />
                {permalink}
              </Link>
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
            <Link className="secondary-button" href={`/notices/${previousNotice.slug}`}>
              <ArrowLeft aria-hidden="true" size={15} />
              Previous notice
            </Link>
          ) : (
            <span className="secondary-button pointer-events-none opacity-50">
              <ArrowLeft aria-hidden="true" size={15} />
              Previous notice
            </span>
          )}
          {nextNotice ? (
            <Link className="secondary-button" href={`/notices/${nextNotice.slug}`}>
              Next notice
              <ArrowRight aria-hidden="true" size={15} />
            </Link>
          ) : (
            <span className="secondary-button pointer-events-none opacity-50">
              Next notice
              <ArrowRight aria-hidden="true" size={15} />
            </span>
          )}
        </nav>
      </div>
    </main>
  );
}
