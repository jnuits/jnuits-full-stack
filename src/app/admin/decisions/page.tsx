import Link from "next/link";
import {
  ClipboardList,
  FileClock,
  Filter,
  RotateCcw,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Decisions - Admin | JnUITS" };

type SearchParams = Record<string, string | string[] | undefined>;

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

type DecisionRecord = {
  date: string | null;
  href: string;
  id: string;
  kind: "application" | "profile" | "workplace";
  meta: string;
  source: string;
  status: string;
  title: string;
};

function resolveMember(decision: ProfileDecision) {
  if (Array.isArray(decision.members)) {
    return decision.members[0] || null;
  }

  return decision.members || null;
}

function statusTone(status: string) {
  if (["approved", "completed", "published"].includes(status)) {
    return "verified";
  }
  if (["rejected", "returned", "archived"].includes(status)) {
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

function parseString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function parsePage(value: string | string[] | undefined) {
  return Math.max(1, Number.parseInt(parseString(value), 10) || 1);
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function buildApplicationRecord(decision: ApplicationDecision): DecisionRecord {
  return {
    date: decision.reviewed_at || decision.created_at,
    href: "/admin/applications",
    id: `application-${decision.id}`,
    kind: "application",
    meta: decision.email,
    source: "Membership applications",
    status: decision.status,
    title: decision.name,
  };
}

function buildProfileRecord(decision: ProfileDecision): DecisionRecord {
  const member = resolveMember(decision);
  const workplace = decision.request_type === "workplace_update";

  return {
    date: decision.reviewed_at || decision.requested_at,
    href: workplace ? "/admin/workplace" : "/admin/profile-changes",
    id: `profile-${decision.id}`,
    kind: workplace ? "workplace" : "profile",
    meta: [member?.jnuits_id, member?.email, decision.request_type.replaceAll("_", " ")]
      .filter(Boolean)
      .join(" · "),
    source: workplace ? "Workplace moderation" : "Profile changes",
    status: decision.status,
    title: member?.full_name || member?.jnuits_id || "Member request",
  };
}

function buildHref(params: URLSearchParams, overrides: Record<string, string | number | null>) {
  const next = new URLSearchParams(params);
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null || value === "") next.delete(key);
    else next.set(key, String(value));
  }
  const query = next.toString();
  return query ? `/admin/decisions?${query}` : "/admin/decisions";
}

export default async function AdminDecisionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolved = await searchParams;
  const kind = parseString(resolved.kind);
  const status = parseString(resolved.status);
  const q = parseString(resolved.q);
  const page = parsePage(resolved.page);
  const pageSize = 20;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(resolved)) {
    if (typeof value === "string" && value) params.set(key, value);
  }

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
      .limit(120),
    admin
      .from("profile_update_requests")
      .select(
        "id, request_type, status, requested_at, review_note, reviewed_at, members(full_name, jnuits_id, email)"
      )
      .neq("status", "pending")
      .order("reviewed_at", { ascending: false })
      .limit(120),
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
  const query = normalize(q);

  const allRecords = [
    ...applicationDecisions.map(buildApplicationRecord),
    ...profileDecisions.map(buildProfileRecord),
  ]
    .filter((record) => !kind || record.kind === kind)
    .filter((record) => !status || record.status === status)
    .filter((record) => {
      if (!query) return true;
      return [record.title, record.meta, record.status, record.source]
        .join(" ")
        .toLowerCase()
        .includes(query);
    })
    .sort((left, right) => {
      const leftTime = left.date ? new Date(left.date).getTime() : 0;
      const rightTime = right.date ? new Date(right.date).getTime() : 0;
      return rightTime - leftTime;
    });

  const totalPages = Math.max(1, Math.ceil(allRecords.length / pageSize));
  const records = allRecords.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="grid gap-8">
      <div className="admin-page-header">
        <div>
          <p className="admin-page-header__breadcrumb">Admin / Operations</p>
          <h1 className="admin-page-header__title">Decisions Log</h1>
          <p className="admin-page-header__desc">
            Searchable decision history for membership, workplace, profile, and recent audit evidence.
          </p>
        </div>
        <span className="abadge abadge--active">
          <ShieldCheck size={10} /> Protected workspace
        </span>
      </div>

      <section className="admin-metric-grid">
        <article className="admin-metric-card" data-tone="warning">
          <div className="admin-metric-card__icon"><UserCheck size={16} /></div>
          <p className="admin-metric-card__label">Applications</p>
          <p className="admin-metric-card__value">{pendingApplications.count || 0}</p>
          <p className="admin-metric-card__sub">Pending membership decisions</p>
          <Link href="/admin/applications" className="queue-link">Review applications</Link>
        </article>
        <article className="admin-metric-card" data-tone="warning">
          <div className="admin-metric-card__icon"><ClipboardList size={16} /></div>
          <p className="admin-metric-card__label">Workplace</p>
          <p className="admin-metric-card__value">{pendingWorkplace.count || 0}</p>
          <p className="admin-metric-card__sub">Pending directory visibility edits</p>
          <Link href="/admin/workplace" className="queue-link">Review workplace</Link>
        </article>
        <article className="admin-metric-card" data-tone="info">
          <div className="admin-metric-card__icon"><Users size={16} /></div>
          <p className="admin-metric-card__label">Profile changes</p>
          <p className="admin-metric-card__value">{pendingProfile.count || 0}</p>
          <p className="admin-metric-card__sub">Pending personal data edits</p>
          <Link href="/admin/profile-changes" className="queue-link">Review profiles</Link>
        </article>
        <article className="admin-metric-card">
          <div className="admin-metric-card__icon"><FileClock size={16} /></div>
          <p className="admin-metric-card__label">Recent audit</p>
          <p className="admin-metric-card__value">{auditEvents.length}</p>
          <p className="admin-metric-card__sub">Latest sensitive mutations</p>
          <Link href="/admin/audit" className="queue-link">Open audit explorer</Link>
        </article>
      </section>

      <section className="section-band">
        <form action="/admin/decisions" className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <label className="input-label xl:col-span-2">
              Search decisions
              <input defaultValue={q} name="q" placeholder="Name, ID, email, source, or status" />
            </label>
            <label className="input-label">
              Decision type
              <select defaultValue={kind} name="kind">
                <option value="">All</option>
                <option value="application">Applications</option>
                <option value="workplace">Workplace</option>
                <option value="profile">Profile</option>
              </select>
            </label>
            <label className="input-label">
              Status
              <select defaultValue={status} name="status">
                <option value="">All</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="returned">Returned</option>
                <option value="completed">Completed</option>
              </select>
            </label>
            <div className="flex items-end gap-2">
              <button className="admin-btn admin-btn--primary" type="submit"><Filter size={14} /> Apply</button>
              <Link className="admin-btn admin-btn--ghost" href="/admin/decisions"><RotateCcw size={14} /> Reset</Link>
            </div>
          </div>
        </form>
      </section>

      <section className="section-band">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="section-divider">Decision records</p>
            <h2 className="mt-3 font-[family-name:var(--font-heading)] text-2xl font-semibold">
              {records.length} shown from {allRecords.length} matching records
            </h2>
          </div>
          <Link href="/admin/audit" className="admin-btn admin-btn--secondary">Open audit evidence</Link>
        </div>

        <div className="mt-6 grid gap-3">
          {records.length === 0 ? (
            <div className="empty-state">No decisions match the current filters.</div>
          ) : (
            records.map((record) => (
              <article className="route-tile" key={record.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3>{record.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
                      {record.source} · {record.meta || "No additional metadata"}
                    </p>
                  </div>
                  <span className={`portal-badge portal-badge--${statusTone(record.status)}`}>
                    {record.status}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                    {formatDate(record.date)}
                  </p>
                  <Link href={record.href} className="queue-link">Open source queue</Link>
                </div>
              </article>
            ))
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--muted-foreground)]">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Link className="admin-btn admin-btn--ghost" href={buildHref(params, { page: Math.max(1, page - 1) })}>Previous</Link>
            <Link className="admin-btn admin-btn--ghost" href={buildHref(params, { page: Math.min(totalPages, page + 1) })}>Next</Link>
          </div>
        </div>
      </section>
    </div>
  );
}