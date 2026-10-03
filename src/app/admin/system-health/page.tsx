import { Activity, AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { authorizeAdminRead, adminReadVerificationNotice } from "@/lib/auth/admin-verification/read-boundary";
import {
  buildSystemHealthSnapshot,
  type HealthStatus,
  type SystemHealthCheck,
} from "@/lib/admin/system-health";

export const metadata = { title: "System Health - Admin | JnUITS" };

function statusLabel(status: HealthStatus) {
  if (status === "ok") return "OK";
  if (status === "warn") return "Review";
  return "Action needed";
}

function statusIcon(status: HealthStatus) {
  if (status === "ok") return <CheckCircle2 size={15} />;
  if (status === "warn") return <AlertTriangle size={15} />;
  return <ShieldAlert size={15} />;
}

function groupChecks(checks: SystemHealthCheck[]) {
  return checks.reduce<Record<SystemHealthCheck["group"], SystemHealthCheck[]>>(
    (groups, check) => {
      groups[check.group].push(check);
      return groups;
    },
    { Database: [], Delivery: [], Environment: [], Operations: [] }
  );
}

export default async function AdminSystemHealthPage() {
  const verified = await authorizeAdminRead("admin.system_health.read");
  if (!verified.ok) return adminReadVerificationNotice("admin.system_health.read", verified.code);
  const snapshot = await buildSystemHealthSnapshot();
  const groups = groupChecks(snapshot.checks);
  const parityReview = snapshot.checks.find(
    (check) => check.label === "Migration parity review"
  );

  return (
    <div className="grid gap-6">
      <div className="admin-page-header">
        <div>
          <p className="admin-page-header__breadcrumb">Admin / Security</p>
          <h1 className="admin-page-header__title">System Health</h1>
          <p className="admin-page-header__desc">
            Read-only runtime checks for the application&rsquo;s active services.
            Migration parity is intentionally shown as a separate review step.
          </p>
        </div>
        <span className="abadge abadge--info">
          <Activity size={10} /> {new Date(snapshot.generatedAt).toLocaleString("en-BD")}
        </span>
      </div>

      {parityReview ? (
        <section className="flash-panel" data-tone="warning" role="status">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Migration parity review required</p>
              <p className="section-copy mt-1">{parityReview.detail}</p>
            </div>
            <span className="status-pill">Operator review</span>
          </div>
        </section>
      ) : null}

      <section className="admin-metric-grid" aria-label="System health totals">
        <article className="admin-metric-card" data-tone="success">
          <p className="admin-metric-card__label">Healthy</p>
          <p className="admin-metric-card__value">{snapshot.counts.ok}</p>
          <p className="admin-metric-card__sub">Live runtime checks passing</p>
        </article>
        <article className="admin-metric-card" data-tone="warning">
          <p className="admin-metric-card__label">Review</p>
          <p className="admin-metric-card__value">{snapshot.counts.warn}</p>
          <p className="admin-metric-card__sub">Intentional operator follow-up or queue review</p>
        </article>
        <article className="admin-metric-card" data-tone="danger">
          <p className="admin-metric-card__label">Action needed</p>
          <p className="admin-metric-card__value">{snapshot.counts.fail}</p>
          <p className="admin-metric-card__sub">Required service or schema dependency unavailable</p>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {Object.entries(groups).map(([group, checks]) => (
          <article className="section-band" key={group}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="section-divider">{group}</p>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                {checks.length} checks
              </span>
            </div>
            <div className="mt-5 grid gap-3">
              {checks.map((check) => (
                <div className="route-tile" key={`${check.group}-${check.label}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3>{check.label}</h3>
                        <span className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                          {check.source === "runtime" ? "Live check" : "Review step"}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
                        {check.detail}
                      </p>
                    </div>
                    <span
                      className={`portal-badge portal-badge--${check.status === "ok" ? "verified" : check.status === "warn" ? "pending" : "returned"}`}
                    >
                      {statusIcon(check.status)} {statusLabel(check.status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
