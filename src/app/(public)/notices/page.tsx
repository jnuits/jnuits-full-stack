import Link from "next/link";
import { formatDisplayDate, publicNotices } from "@/lib/content/public-content";

export default function NoticesPage() {
  return (
    <div className="shell py-12">
      <section className="glass-card overflow-hidden px-6 py-6 sm:px-8 sm:py-8">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <span className="eyebrow">Notices and decisions</span>
            <h1 className="section-title mt-4">
              Notices remain a public accountability surface, even before the full
              publishing workflow lands.
            </h1>
            <p className="section-copy mt-5">
              The legacy notice model carried titles, dates, categories, files, and
              external links. This route now restores the public reading pattern
              while attachment delivery waits for the Phase 04 media rules.
            </p>
          </div>

          <article className="section-band">
            <p className="section-divider">Current notice policy</p>
            <ul className="clean-list mt-6">
              <li>Public readability comes first; attachment handling follows once media paths are normalized.</li>
              <li>Publishing will later be tied to RBAC and audit events instead of broad CMS access.</li>
              <li>Legacy file-backed notices are being mapped into safer delivery rules before import.</li>
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
                <span className="text-sm font-semibold text-[var(--muted)]">
                  {formatDisplayDate(notice.publishedAt)}
                </span>
              </div>
              <div>
                <h2 className="font-[family-name:var(--font-heading)] text-[1.5rem] leading-[1.05] tracking-[-0.04em]">
                  {notice.title}
                </h2>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
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
                  <span className="text-sm leading-7 text-[var(--muted)]">
                    Attachment and external-link import are still queued in this phase.
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
