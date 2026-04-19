import Link from "next/link";
import {
  ClipboardList,
  FileClock,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Decisions - Admin | JnUITS" };

type ApplicationDecision = {
  created_at: string;
  email: string;
  id: string;
  name: string;
  review_note: string | null;
  reviewed_at: string | null;
  status: string;
};

type ProfileDecision = {
  id: string;
  request_type: string;
  requested_at: string;
  review_note: string | null;
  reviewed_at: string | null;
  status: string;
  members?:
    | {
        email?: string | null;
        full_name?: string | null;
        jnuits_id?: string | null;
      }
    | {
        email?: string | null;
        full_name?: string | null;
        jnuits_id?: string | null;
      }[]
    | null;
};

type AuditEvent = {
  action: string;
  actor_user_id: string | null;
  created_at: string;
  entity_id: string | null;
  entity_type: string | null;
  id: string;
};

function resolveMember(decision: ProfileDecision) {
  if (Array.isArray(decision.members)) {
    return decision.members[0] || null;
  }

  return decision.members || null;
}

function statusTone(status: string) {
  if (status === "approved" || status === "completed") {
    return "verified";
  }
  if (status === "rejected" || status === "returned") {
    return "returned";
  }
  return "draft";
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Not reviewed yet";
  }

  return new Date(value).toLocaleString("en-BD", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function AdminDecisionsPage() {
  const admin = createAdminClient();
  const [
    pendingApplications,
    pendingWorkplace,
    pendingProfile,
    recentApplicationsResult,
    recentProfileResult,
    recentAuditResult,
  ] = await Promise.all([
    admin
      .from("membership_applications")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    admin
      .from("profile_update_requests")
      .select("*", { count: "exact", head: true })
      .eq("request_type", "workplace_update")
      .eq("status", "pending"),
    admin
      .from("profile_update_requests")
      .select("*", { count: "exact", head: true })
      .eq("request_type", "profile_change")
      .eq("status", "pending"),
    admin
      .from("membership_applications")
      .select("id, name, email, status, created_at, review_note, reviewed_at")
      .neq("status", "pending")
      .order("reviewed_at", { ascending: false })
      .limit(8),
    admin
      .from("profile_update_requests")
      .select(
        "id, request_type, status, requested_at, review_note, reviewed_at, members(full_name, jnuits_id, email)"
      )
      .neq("status", "pending")
      .order("reviewed_at", { ascending: false })
      .limit(8),
    admin
      .from("audit_events")
      .select("id, action, actor_user_id, entity_type, entity_id, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const applicationDecisions =
    (recentApplicationsResult.data || []) as ApplicationDecision[];
  const profileDecisions = (recentProfileResult.data || []) as ProfileDecision[];
  const auditEvents = (recentAuditResult.data || []) as AuditEvent[];

  return (
    <div className="grid gap-8">
      <div className="admin-page-header">
        <div>
          <p className="admin-page-header__breadcrumb">Admin / Operations</p>
          <h1 className="admin-page-header__title">Decisions Log</h1>
          <p className="admin-page-header__desc">
            A task-first landing page for operator decisions, moderation queues,
            and recent audit evidence.
          </p>
        </div>
        <span className="abadge abadge--active">
          <ShieldCheck size={10} />
          Protected workspace
        </span>
      </div>

      <section className="admin-metric-grid">
        <article className="admin-metric-card" data-tone="warning">
          <div className="admin-metric-card__icon">
            <UserCheck size={16} />
          </div>
          <p className="admin-metric-card__label">Applications</p>
          <p className="admin-metric-card__value">
            {pendingApplications.count || 0}
          </p>
          <p className="admin-metric-card__sub">Pending membership decisions</p>
          <Link href="/admin/applications" className="queue-link">
            Review applications
          </Link>
        </article>
        <article className="admin-metric-card" data-tone="warning">
          <div className="admin-metric-card__icon">
            <ClipboardList size={16} />
          </div>
          <p className="admin-metric-card__label">Workplace</p>
          <p className="admin-metric-card__value">{pendingWorkplace.count || 0}</p>
          <p className="admin-metric-card__sub">Pending directory visibility edits</p>
          <Link href="/admin/workplace" className="queue-link">
            Review workplace
          </Link>
        </article>
        <article className="admin-metric-card" data-tone="info">
          <div className="admin-metric-card__icon">
            <Users size={16} />
          </div>
          <p className="admin-metric-card__label">Profile changes</p>
          <p className="admin-metric-card__value">{pendingProfile.count || 0}</p>
          <p className="admin-metric-card__sub">Pending personal data edits</p>
          <Link href="/admin/profile-changes" className="queue-link">
            Review profiles
          </Link>
        </article>
        <article className="admin-metric-card">
          <div className="admin-metric-card__icon">
            <FileClock size={16} />
          </div>
          <p className="admin-metric-card__label">Audit events</p>
          <p className="admin-metric-card__value">{auditEvents.length}</p>
          <p className="admin-metric-card__sub">Recent sensitive mutations</p>
          <Link href="/admin/reports" className="queue-link">
            Open reports
          </Link>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <article className="section-band">
          <p className="section-divider">Membership decisions</p>
          <div className="mt-6 grid gap-3">
            {applicationDecisions.length === 0 ? (
              <div className="empty-state">No reviewed applications yet.</div>
            ) : (
              applicationDecisions.map((decision) => (
                <article key={decision.id} className="route-tile">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3>{decision.name}</h3>
                    <span
                      className={`portal-badge portal-badge--${statusTone(
                        decision.status
                      )}`}
                    >
                      {decision.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
                    {decision.email}
                  </p>
                  <p className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                    {formatDate(decision.reviewed_at)}
                  </p>
                </article>
              ))
            )}
          </div>
        </article>

        <article className="section-band">
          <p className="section-divider">Profile and workplace decisions</p>
          <div className="mt-6 grid gap-3">
            {profileDecisions.length === 0 ? (
              <div className="empty-state">No reviewed profile requests yet.</div>
            ) : (
              profileDecisions.map((decision) => {
                const member = resolveMember(decision);
                return (
                  <article key={decision.id} className="route-tile">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3>
                        {member?.full_name ||
                          member?.jnuits_id ||
                          "Member request"}
                      </h3>
                      <span
                        className={`portal-badge portal-badge--${statusTone(
                          decision.status
                        )}`}
                      >
                        {decision.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
                      {decision.request_type.replaceAll("_", " ")}
                    </p>
                    <p className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                      {formatDate(decision.reviewed_at)}
                    </p>
                  </article>
                );
              })
            )}
          </div>
        </article>

        <article className="section-band">
          <p className="section-divider">Recent audit trail</p>
          <div className="mt-6 grid gap-3">
            {auditEvents.length === 0 ? (
              <div className="empty-state">No audit events found.</div>
            ) : (
              auditEvents.map((event) => (
                <article key={event.id} className="route-tile">
                  <h3>{event.action}</h3>
                  <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
                    {event.entity_type || "entity"}{" "}
                    {event.entity_id ? `- ${event.entity_id}` : ""}
                  </p>
                  <p className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                    {formatDate(event.created_at)}
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
