import Link from "next/link";
import { cookies } from "next/headers";
import {
  generateCommitteeRosterReport,
  generateContentInventoryReport,
  generateMembershipOverviewReport,
  generateReconciliationSnapshot,
  triggerSentryVerificationReport,
} from "@/app/admin/reports/actions";
import {
  ADMIN_FLASH_COOKIE_NAME,
  parseAdminFlash,
} from "@/lib/admin/flash";
import { buildOperationalSnapshot } from "@/lib/admin/reports";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  Activity,
  Archive,
  BarChart3,
  FileCheck2,
  FileText,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

type OperatorReportRow = {
  created_at: string;
  id: string;
  report_type: string;
  status: string;
  summary: string | null;
  title: string;
};

function formatReportType(reportType: string) {
  const labels: Record<string, string> = {
    committee_roster: "Committee roster",
    content_inventory: "Content inventory",
    csv_onboarding: "Onboarding import",
    membership_overview: "Membership overview",
    membership_reconciliation: "Membership reconciliation",
    reconciliation_snapshot: "Operational snapshot",
    workplace_moderation: "Profile moderation",
  };

  return labels[reportType] || reportType.replaceAll("_", " ");
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-BD", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function ReportActionCard({
  action,
  description,
  emphasis = "secondary",
  icon,
  title,
}: {
  action: () => Promise<void>;
  description: string;
  emphasis?: "primary" | "secondary";
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <form action={action} className="route-tile grid min-w-0 gap-4 p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--brand-blue)]">
          {icon}
        </span>
        <div className="min-w-0">
          <h3>{title}</h3>
          <p className="mt-1">{description}</p>
        </div>
      </div>
      <button
        className={emphasis === "primary" ? "primary-button w-fit" : "secondary-button w-fit"}
        type="submit"
      >
        Save snapshot
      </button>
    </form>
  );
}

export default async function AdminReportsPage() {
  const admin = createAdminClient();
  const [snapshot, cookieStore, recentReportsResult, reportCountResult] =
    await Promise.all([
      buildOperationalSnapshot(admin),
      cookies(),
      admin
        .from("operator_reports")
        .select("id, report_type, title, summary, created_at, status")
        .order("created_at", { ascending: false })
        .limit(8),
      admin.from("operator_reports").select("id", { count: "exact", head: true }),
    ]);
  const flash = parseAdminFlash(
    cookieStore.get(ADMIN_FLASH_COOKIE_NAME)?.value
  );
  const reportRows = (recentReportsResult.data || []) as OperatorReportRow[];
  const openOperatorWork =
    snapshot.operations.pendingApplications +
    snapshot.operations.pendingWorkplaceRequests +
    snapshot.operations.pendingProfileChangeRequests;
  const reportTypeCount = new Set(reportRows.map((report) => report.report_type)).size;

  return (
    <div className="grid gap-6">
      <header className="admin-page-header">
        <div>
          <p className="admin-page-header__breadcrumb">Organization / Reports</p>
          <h1 className="admin-page-header__title">Operational Reports</h1>
          <p className="admin-page-header__desc">
            Capture an immutable operational snapshot when a team needs shared
            evidence, then review the recent report history in one place.
          </p>
        </div>
        <div className="admin-page-header__actions">
          <Link className="ghost-button" href="/admin/reconcile">
            Open reconciliation
          </Link>
        </div>
      </header>

      {flash ? (
        <section className="flash-panel" data-tone={flash.tone} role="status">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
            Report status
          </p>
          <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-[-0.03em]">
            {flash.title}
          </h2>
          <p className="section-copy mt-2">{flash.message}</p>
        </section>
      ) : null}

      <section className="admin-metric-grid" aria-label="Report overview">
        <article className="admin-metric-card" data-tone={openOperatorWork > 0 ? "warning" : "success"}>
          <FileCheck2 className="admin-metric-card__icon" size={17} />
          <p className="admin-metric-card__label">Open operator work</p>
          <p className="admin-metric-card__value">{openOperatorWork}</p>
          <p className="admin-metric-card__sub">Applications and profile reviews waiting for action</p>
        </article>
        <article className="admin-metric-card" data-tone="info">
          <UsersRound className="admin-metric-card__icon" size={17} />
          <p className="admin-metric-card__label">Active invitations</p>
          <p className="admin-metric-card__value">{snapshot.operations.activeInvitations}</p>
          <p className="admin-metric-card__sub">Member claims currently outstanding</p>
        </article>
        <article className="admin-metric-card" data-tone="info">
          <Archive className="admin-metric-card__icon" size={17} />
          <p className="admin-metric-card__label">Saved reports</p>
          <p className="admin-metric-card__value">{reportCountResult.count || 0}</p>
          <p className="admin-metric-card__sub">Historical records retained for operator review</p>
        </article>
        <article className="admin-metric-card" data-tone="info">
          <BarChart3 className="admin-metric-card__icon" size={17} />
          <p className="admin-metric-card__label">Recent report types</p>
          <p className="admin-metric-card__value">{reportTypeCount}</p>
          <p className="admin-metric-card__sub">Distinct report categories in the visible history</p>
        </article>
      </section>

      <section className="section-band grid gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="eyebrow">Create evidence</span>
            <h2 className="mt-3 font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-[-0.03em]">
              Save a current operational snapshot
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-7 text-[var(--muted-foreground)]">
            Generating a report reads the current state and writes one
            time-stamped record. It does not change memberships, content, or
            queue decisions.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <ReportActionCard
            action={generateMembershipOverviewReport}
            description="Applications, invitation activity, and profile moderation queues."
            emphasis="primary"
            icon={<UsersRound size={18} />}
            title="Membership operations"
          />
          <ReportActionCard
            action={generateCommitteeRosterReport}
            description="Active committee terms, roles, and assignment coverage."
            icon={<FileText size={18} />}
            title="Committee roster"
          />
          <ReportActionCard
            action={generateContentInventoryReport}
            description="Published content, public gallery items, developers, and media inventory."
            icon={<BarChart3 size={18} />}
            title="Content inventory"
          />
          <ReportActionCard
            action={generateReconciliationSnapshot}
            description="A concise cross-workspace record for an operational review meeting."
            icon={<Archive size={18} />}
            title="Operational snapshot"
          />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.72fr)]">
        <article className="section-band grid gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <span className="eyebrow">Report history</span>
              <h2 className="mt-3 font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-[-0.03em]">
                Recent operator records
              </h2>
            </div>
            <span className="status-pill">Newest first</span>
          </div>

          {reportRows.length === 0 ? (
            <div className="empty-state">
              No reports have been saved yet. Create a focused snapshot when a
              team needs a durable operational record.
            </div>
          ) : (
            <div className="grid gap-3">
              {reportRows.map((report) => (
                <article className="route-tile" key={report.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3>{report.title}</h3>
                      <p className="mt-1">
                        {report.summary || "Saved operational report."}
                      </p>
                    </div>
                    <span className="status-pill capitalize">
                      {report.status}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                    <span>{formatReportType(report.report_type)}</span>
                    <span aria-hidden="true">•</span>
                    <time dateTime={report.created_at}>{formatDate(report.created_at)}</time>
                  </div>
                </article>
              ))}
            </div>
          )}
        </article>

        <aside className="section-band grid content-start gap-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 shrink-0 text-[var(--brand-blue)]" size={18} />
            <div>
              <span className="eyebrow">Observability</span>
              <h2 className="mt-3 font-[family-name:var(--font-heading)] text-xl font-semibold tracking-[-0.03em]">
                Verify Sentry deliberately
              </h2>
              <p className="section-copy mt-2">
                Send a controlled, low-severity verification event only when
                checking the Sentry pipeline. The action also leaves an audit
                record here.
              </p>
            </div>
          </div>
          <form action={triggerSentryVerificationReport}>
            <button className="secondary-button w-fit" type="submit">
              <Activity size={16} /> Send verification event
            </button>
          </form>
          <p className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-4 text-sm leading-6 text-[var(--muted-foreground)]">
            Bulk data changes belong in Bulk Operations. Use Reconciliation for
            existing import evidence rather than repeating the same workflow
            here.
          </p>
        </aside>
      </section>
    </div>
  );
}