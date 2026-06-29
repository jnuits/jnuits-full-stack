import { Activity, AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
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
  const snapshot = await buildSystemHealthSnapshot();
  const groups = groupChecks(snapshot.checks);

  return (
    <div className="grid gap-8">
      <div className="admin-page-header">
        <div>
          <p className="admin-page-header__breadcrumb">Admin / Security</p>
          <h1 className="admin-page-header__title">System Health</h1>
          <p className="admin-page-header__desc">
            Read-only operational checks for Supabase, email delivery, Cloudinary,
            Sentry, environment configuration, and migration parity status.
          </p>
        </div>
        <span className="abadge abadge--info">
          <Activity size={10} /> {new Date(snapshot.generatedAt).toLocaleString("en-BD")}
        </span>
      </div>

      <section className="admin-metric-grid">
        <article className="admin-metric-card" data-tone="success">
          <p className="admin-metric-card__label">Healthy</p>
          <p className="admin-metric-card__value">{snapshot.counts.ok}</p>
          <p className="admin-metric-card__sub">Checks currently passing</p>
        </article>
        <article className="admin-metric-card" data-tone="warning">
          <p className="admin-metric-card__label">Review</p>
          <p className="admin-metric-card__value">{snapshot.counts.warn}</p>
          <p className="admin-metric-card__sub">Operational follow-up advised</p>
        </article>
        <article className="admin-metric-card" data-tone="danger">
          <p className="admin-metric-card__label">Action needed</p>
          <p className="admin-metric-card__value">{snapshot.counts.fail}</p>
          <p className="admin-metric-card__sub">Blocking or misconfigured checks</p>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {Object.entries(groups).map(([group, checks]) => (
          <article className="section-band" key={group}>
            <p className="section-divider">{group}</p>
            <div className="mt-5 grid gap-3">
              {checks.map((check) => (
                <div className="route-tile" key={`${check.group}-${check.label}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3>{check.label}</h3>
                      <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
                        {check.detail}
                      </p>
                    </div>
                    <span className={`portal-badge portal-badge--${check.status === "ok" ? "verified" : check.status === "warn" ? "pending" : "returned"}`}>
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