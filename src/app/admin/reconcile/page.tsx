import Link from "next/link";
import { BarChart2, FileText, RefreshCcw, ShieldCheck } from "lucide-react";
import { generateReconciliationSnapshot } from "@/app/admin/reports/actions";
import { buildOperationalSnapshot } from "@/lib/admin/reports";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Reconcile - Admin | JnUITS" };

type OperatorReportRow = {
  created_at: string;
  id: string;
  report_type: string;
  status: string;
  summary: string | null;
  title: string;
};

export default async function AdminReconcilePage() {
  const admin = createAdminClient();
  const [snapshot, reportsResult] = await Promise.all([
    buildOperationalSnapshot(admin),
    admin
      .from("operator_reports")
      .select("id, report_type, title, summary, created_at, status")
      .eq("report_type", "reconciliation_snapshot")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const reports = (reportsResult.data || []) as OperatorReportRow[];
  const remainingParity =
    snapshot.parity.blogsRemaining +
    snapshot.parity.eventsRemaining +
    snapshot.parity.noticesRemaining +
    snapshot.parity.galleryRemaining +
    snapshot.parity.developersRemaining;
  const pendingModeration =
    snapshot.operations.pendingApplications +
    snapshot.operations.pendingWorkplaceRequests +
    snapshot.operations.pendingProfileChangeRequests;

  return (
    <div className="grid gap-8">
      <div className="admin-page-header">
        <div>
          <p className="admin-page-header__breadcrumb">Admin / Operations</p>
          <h1 className="admin-page-header__title">Reconcile</h1>
          <p className="admin-page-header__desc">
            Compare migration readiness, public-content parity, and live
            operator queues before rehearsal or cutover decisions.
          </p>
        </div>
        <form action={generateReconciliationSnapshot}>
          <button className="primary-button" type="submit">
            Save snapshot
          </button>
        </form>
      </div>

      <section className="admin-metric-grid">
        <article className="admin-metric-card" data-tone="warning">
          <div className="admin-metric-card__icon">
            <RefreshCcw size={16} />
          </div>
          <p className="admin-metric-card__label">Parity items</p>
          <p className="admin-metric-card__value">{remainingParity}</p>
          <p className="admin-metric-card__sub">Fallback content not migrated</p>
        </article>
        <article className="admin-metric-card" data-tone="info">
          <div className="admin-metric-card__icon">
            <ShieldCheck size={16} />
          </div>
          <p className="admin-metric-card__label">Moderation queue</p>
          <p className="admin-metric-card__value">{pendingModeration}</p>
          <p className="admin-metric-card__sub">Applications and profile requests</p>
        </article>
        <article className="admin-metric-card" data-tone="success">
          <div className="admin-metric-card__icon">
            <BarChart2 size={16} />
          </div>
          <p className="admin-metric-card__label">Published content</p>
          <p className="admin-metric-card__value">
            {snapshot.content.publishedBlogs +
              snapshot.content.publishedEvents +
              snapshot.content.publishedNotices +
              snapshot.content.publishedGalleryEntries +
              snapshot.content.publishedDevelopers}
          </p>
          <p className="admin-metric-card__sub">Database-backed public entries</p>
        </article>
        <article className="admin-metric-card">
          <div className="admin-metric-card__icon">
            <FileText size={16} />
          </div>
          <p className="admin-metric-card__label">Saved snapshots</p>
          <p className="admin-metric-card__value">{reports.length}</p>
          <p className="admin-metric-card__sub">Recent reconciliation evidence</p>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.75fr)]">
        <article className="section-band">
          <p className="section-divider">Reconciliation checklist</p>
          <div className="mt-6 grid gap-3">
            <div className="route-tile">
              <h3>Public content parity</h3>
              <p>
                Blogs {snapshot.parity.blogsRemaining}, events{" "}
                {snapshot.parity.eventsRemaining}, notices{" "}
                {snapshot.parity.noticesRemaining}, gallery{" "}
                {snapshot.parity.galleryRemaining}, developers{" "}
                {snapshot.parity.developersRemaining} still need migration or
                sign-off.
              </p>
              <Link href="/admin/content" className="queue-link">
                Open content hub
              </Link>
            </div>
            <div className="route-tile">
              <h3>Membership and moderation queues</h3>
              <p>
                Pending applications {snapshot.operations.pendingApplications},
                workplace requests {snapshot.operations.pendingWorkplaceRequests},
                profile changes{" "}
                {snapshot.operations.pendingProfileChangeRequests}, active
                invitations {snapshot.operations.activeInvitations}.
              </p>
              <Link href="/admin/decisions" className="queue-link">
                Open decision queues
              </Link>
            </div>
            <div className="route-tile">
              <h3>Committee and audit coverage</h3>
              <p>
                Active committee terms {snapshot.operations.activeCommitteeTerms},
                active assignments{" "}
                {snapshot.operations.activeCommitteeAssignments}, audit events{" "}
                {snapshot.operations.auditEvents}.
              </p>
              <Link href="/admin/committee" className="queue-link">
                Open committee tooling
              </Link>
            </div>
          </div>
        </article>

        <article className="section-band">
          <p className="section-divider">Saved evidence</p>
          <div className="mt-6 grid gap-3">
            {reports.length === 0 ? (
              <div className="empty-state">
                No reconciliation snapshots saved yet. Save one before rehearsal
                or cutover review.
              </div>
            ) : (
              reports.map((report) => (
                <article key={report.id} className="route-tile">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3>{report.title}</h3>
                    <span className="status-pill">{report.status}</span>
                  </div>
                  <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
                    {report.summary || "Reconciliation snapshot"}
                  </p>
                  <p className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                    {new Date(report.created_at).toLocaleString("en-BD")}
                  </p>
                </article>
              ))
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
