import { cookies } from "next/headers";
import {
  generateCommitteeRosterReport,
  generateContentInventoryReport,
  generateMembershipOverviewReport,
  generateReconciliationSnapshot,
} from "@/app/admin/reports/actions";
import {
  ADMIN_FLASH_COOKIE_NAME,
  parseAdminFlash,
} from "@/lib/admin/flash";
import { buildOperationalSnapshot } from "@/lib/admin/reports";
import { createAdminClient } from "@/lib/supabase/admin";

type OperatorReportRow = {
  created_at: string;
  id: string;
  report_type: string;
  status: string;
  summary: string | null;
  title: string;
};

export default async function AdminReportsPage() {
  const admin = createAdminClient();
  const snapshot = await buildOperationalSnapshot(admin);
  const cookieStore = await cookies();
  const flash = parseAdminFlash(
    cookieStore.get(ADMIN_FLASH_COOKIE_NAME)?.value
  );

  const { data: recentReports } = await admin
    .from("operator_reports")
    .select("id, report_type, title, summary, created_at, status")
    .order("created_at", { ascending: false })
    .limit(8);

  const reportRows = (recentReports || []) as OperatorReportRow[];

  return (
    <div className="grid gap-8">
      <div>
        <div className="workspace-topbar">
          <span className="eyebrow">Operator reports</span>
          <span className="status-pill">Phase 07 reporting live</span>
        </div>
        <h1 className="section-title text-[2.5rem]">
          Reconciliation snapshots and operator reporting
        </h1>
        <p className="section-copy mt-3">
          These reports turn live queue counts and migration parity gaps into
          saved operational evidence. The goal is to replace ad hoc notes with
          repeatable, archived snapshots.
        </p>
      </div>

      {flash ? (
        <section className="flash-panel" data-tone={flash.tone}>
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-[var(--muted)]">
            Operator feedback
          </p>
          <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-[-0.03em]">
            {flash.title}
          </h2>
          <p className="section-copy mt-2">{flash.message}</p>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="metric-card">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--muted)]">
            Pending applications
          </p>
          <p className="metric-card__value mt-3">
            {snapshot.operations.pendingApplications}
          </p>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            Membership queue pressure that still needs review capacity.
          </p>
        </article>
        <article className="metric-card">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--muted)]">
            Pending profile moderation
          </p>
          <p className="metric-card__value mt-3">
            {snapshot.operations.pendingWorkplaceRequests +
              snapshot.operations.pendingProfileChangeRequests}
          </p>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            Combined workplace and profile-change requests waiting on operators.
          </p>
        </article>
        <article className="metric-card">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--muted)]">
            Published content entries
          </p>
          <p className="metric-card__value mt-3">
            {snapshot.content.publishedBlogs +
              snapshot.content.publishedEvents +
              snapshot.content.publishedNotices +
              snapshot.content.publishedGalleryEntries +
              snapshot.content.publishedDevelopers}
          </p>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            Public collections now tracked separately from shell-only fallbacks.
          </p>
        </article>
        <article className="metric-card">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--muted)]">
            Parity items remaining
          </p>
          <p className="metric-card__value mt-3">
            {snapshot.parity.blogsRemaining +
              snapshot.parity.eventsRemaining +
              snapshot.parity.noticesRemaining +
              snapshot.parity.galleryRemaining +
              snapshot.parity.developersRemaining}
          </p>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            Preview content still not represented in the new database-backed model.
          </p>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)]">
        <article className="section-band grid gap-4">
          <div>
            <span className="eyebrow">Generate snapshots</span>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.7rem)] leading-[0.96] tracking-[-0.04em]">
              Save current operational state into an auditable report log
            </h2>
          </div>
          <p className="section-copy">
            Each action stores the live database counts and parity gaps at the
            moment it runs. This is the first pass of deterministic reporting;
            richer CSV reconciliation still follows.
          </p>
          <div className="route-grid">
            <form action={generateMembershipOverviewReport} className="route-tile grid gap-3">
              <h3>Membership overview</h3>
              <p>Queues, invitations, and moderation counts for operators.</p>
              <button className="primary-button" type="submit">
                Save membership report
              </button>
            </form>
            <form action={generateCommitteeRosterReport} className="route-tile grid gap-3">
              <h3>Committee roster</h3>
              <p>Committee term, role, and assignment coverage in the new stack.</p>
              <button className="secondary-button" type="submit">
                Save committee snapshot
              </button>
            </form>
            <form action={generateContentInventoryReport} className="route-tile grid gap-3">
              <h3>Content inventory</h3>
              <p>Published public items, media assets, and migration completeness.</p>
              <button className="secondary-button" type="submit">
                Save content inventory
              </button>
            </form>
            <form action={generateReconciliationSnapshot} className="route-tile grid gap-3">
              <h3>Unified reconciliation</h3>
              <p>Cross-phase overview for cutover planning and operator review.</p>
              <button className="ghost-button" type="submit">
                Save full snapshot
              </button>
            </form>
            <article className="route-tile grid gap-3">
              <h3>CSV + reconciliation scripts</h3>
              <p>
                `npm run members:onboard -- --file artifacts/templates/member-onboarding-template.csv --dry-run`
              </p>
              <p>
                `npm run members:reconcile -- --dry-run --persist-report`
              </p>
            </article>
          </div>
        </article>

        <article className="section-band">
          <span className="eyebrow">Live readout</span>
          <div className="mt-5 grid gap-3">
            <div className="route-tile">
              <h3>Operations</h3>
              <p>
                Applications {snapshot.operations.pendingApplications}, invitations{" "}
                {snapshot.operations.activeInvitations}, workplace requests{" "}
                {snapshot.operations.pendingWorkplaceRequests}, profile changes{" "}
                {snapshot.operations.pendingProfileChangeRequests}.
              </p>
            </div>
            <div className="route-tile">
              <h3>Committee</h3>
              <p>
                Active terms {snapshot.operations.activeCommitteeTerms}, active
                assignments {snapshot.operations.activeCommitteeAssignments}.
              </p>
            </div>
            <div className="route-tile">
              <h3>Content and media</h3>
              <p>
                Blogs {snapshot.content.publishedBlogs}, events{" "}
                {snapshot.content.publishedEvents}, notices{" "}
                {snapshot.content.publishedNotices}, gallery{" "}
                {snapshot.content.publishedGalleryEntries}, developers{" "}
                {snapshot.content.publishedDevelopers}, media assets{" "}
                {snapshot.content.mediaAssets}.
              </p>
            </div>
          </div>
        </article>
      </section>

      <section className="section-band">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="eyebrow">Recent snapshots</span>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.7rem)] leading-[0.96] tracking-[-0.04em]">
              Stored operator reports
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-7 text-[var(--muted)]">
            These rows are the beginning of the archived reporting path that will
            later include dry-run/apply CSV reconciliation.
          </p>
        </div>
        <div className="mt-6 grid gap-4">
          {reportRows.length === 0 ? (
            <div className="empty-state">
              No reports have been saved yet. Generate the first snapshot from the
              controls above.
            </div>
          ) : (
            reportRows.map((report) => (
              <article key={report.id} className="route-tile">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3>{report.title}</h3>
                  <span className="status-pill">{report.report_type}</span>
                </div>
                <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                  {report.summary || "Operator report"}
                </p>
                <p className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                  {new Date(report.created_at).toLocaleString("en-BD")}
                </p>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
