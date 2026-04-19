import Link from "next/link";
import {
  formatDisplayDate,
  getPublishedNotices,
} from "@/lib/content/public-content";

export default async function NoticesPage() {
  const publicNotices = await getPublishedNotices();

  return (
    <div className="shell py-12">
      <section className="glass-card overflow-hidden px-6 py-6 sm:px-8 sm:py-8">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <span className="eyebrow">Notices and decisions</span>
            <h1 className="section-title mt-4">
              Official notices and announcements from JnUITS.
            </h1>
            <p className="section-copy mt-5">
              This notice stream covers program updates, important dates, and
              society communications for members and the public.
            </p>
          </div>

          <article className="section-band">
            <p className="section-divider">Notice policy</p>
            <ul className="clean-list mt-6">
              <li>Notices are published with clear title, date, and category labels.</li>
              <li>When an external document is available, the linked action opens it directly.</li>
              <li>Each notice entry remains accessible through a stable public route.</li>
            </ul>
          </article>
        </div>
      </section>

      <section className="mt-8 section-band">
        <p className="section-divider">Notice stream</p>
        <div className="mt-6 grid gap-4">
          {publicNotices.map((notice) => (
            <article
              key={notice.title}
              className="grid gap-4 rounded-[1.3rem] border border-[var(--line)] p-5 lg:grid-cols-[160px_minmax(0,1fr)_220px]"
              style={{
                background: "color-mix(in oklab, var(--card) 94%, transparent)",
              }}
            >
              <div className="grid content-start gap-2">
                <span className="detail-chip">{notice.category}</span>
                <span className="text-sm font-semibold text-[var(--muted-foreground)]">
                  {formatDisplayDate(notice.publishedAt)}
                </span>
              </div>
              <div>
                <h2 className="font-[family-name:var(--font-heading)] text-[1.5rem] leading-[1.05] tracking-[-0.04em]">
                  {notice.title}
                </h2>
                <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">
                  {notice.summary}
                </p>
              </div>
              <div className="grid content-start gap-3">
                <span className="detail-chip">{notice.delivery}</span>
                {notice.href ? (
                  <Link href={notice.href} className="secondary-button">
                    Open related route
                  </Link>
                ) : (
                  <span className="text-sm leading-7 text-[var(--muted-foreground)]">
                    Attachment or external link will be published when available.
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
