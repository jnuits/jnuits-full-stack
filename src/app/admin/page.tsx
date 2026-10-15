import { OwnAdminCompletionCards } from "@/components/profile/own-admin-completion-cards";
import { requireAdminUser } from "@/lib/auth/session";
import { cookies } from "next/headers";
import Link from "next/link";
import {
  BarChart2,
  BookOpen,
  ClipboardList,
  FileCode2,
  FileText,
  FolderOpen,
  Mail,
  RefreshCcw,
  ScrollText,
  ShieldCheck,
  Users,
  UserCheck,
} from "lucide-react";
import {
  ADMIN_FLASH_COOKIE_NAME,
  parseAdminFlash,
} from "@/lib/admin/flash";
import {
  canShowDashboardActivity,
  canShowDashboardDecisionCards,
  getAdminDashboardQuickLinks,
  resolveAdminDashboardCapabilities,
} from "@/lib/admin/dashboard-access";
import { createAdminClient } from "@/lib/supabase/admin";

// ── Types ─────────────────────────────────────────────────────────────────────

type ApplicationRecord = {
  id: string;
  name: string;
  email: string;
  department_code: string | null;
  batch_label: string | null;
  student_id: string | null;
  phone: string | null;
  facebook_url: string | null;
  linkedin_url: string | null;
  photo_url: string | null;
  status: string;
  created_at: string;
  review_note: string | null;
  reviewed_at: string | null;
  invitation_id: string | null;
  processed_member_id: string | null;
  departments?: { name?: string | null } | { name?: string | null }[] | null;
};

type WorkplaceRequestRecord = {
  id: string;
  member_id: string;
  payload: unknown;
  request_type: string;
  requested_at: string;
  review_note: string | null;
  reviewed_at: string | null;
  status: string;
  members?:
    | {
        current_organization?: string | null;
        designation?: string | null;
        email?: string | null;
        full_name?: string | null;
        jnuits_id?: string | null;
        member_type?: string | null;
        avatar_secure_url?: string | null;
        professional_visibility?: string | null;
        work_location?: string | null;
      }
    | {
        current_organization?: string | null;
        designation?: string | null;
        email?: string | null;
        full_name?: string | null;
        jnuits_id?: string | null;
        member_type?: string | null;
        avatar_secure_url?: string | null;
        professional_visibility?: string | null;
        work_location?: string | null;
      }[]
    | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveDepartmentName(
  departments: ApplicationRecord["departments"],
  fallbackCode: string | null
) {
  if (Array.isArray(departments)) {
    return departments[0]?.name || fallbackCode || "Department not set";
  }
  return departments?.name || fallbackCode || "Department not set";
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const adminQuickIconMap = {
  barChart: BarChart2,
  book: BookOpen,
  clipboard: ClipboardList,
  code: FileCode2,
  file: FileText,
  folder: FolderOpen,
  mail: Mail,
  refresh: RefreshCcw,
  scroll: ScrollText,
  shield: ShieldCheck,
  userCheck: UserCheck,
  users: Users,
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminPage() {
  await requireAdminUser({ fallbackPath: "/admin" });

  const admin = createAdminClient();
  const dashboardCapabilities = await resolveAdminDashboardCapabilities();
  const canManageMembership = dashboardCapabilities.membershipManage;
  const canReadAudit = dashboardCapabilities.auditRead;
  const canViewMembershipDecisions =
    canManageMembership || dashboardCapabilities.decisionsRead;
  const showActivityPanels =
    canManageMembership || canShowDashboardActivity(dashboardCapabilities);
  const showDecisionCards = canShowDashboardDecisionCards(dashboardCapabilities);
  const quickLinks = getAdminDashboardQuickLinks(dashboardCapabilities);
  const cookieStore = await cookies();
  const flash = parseAdminFlash(
    cookieStore.get(ADMIN_FLASH_COOKIE_NAME)?.value
  );

  const [
    pendingApplicationsResult,
    recentDecisionsResult,
    pendingCountResult,
    activeInvitationsResult,
    membersCountResult,
    pendingWorkplaceCountResult,
    recentWorkplaceDecisionsResult,
    pendingProfileChangeCountResult,
    auditLogsResult,
  ] = await Promise.all([
    canManageMembership
      ? admin
          .from("membership_applications")
          .select(
            "id, name, email, department_code, batch_label, student_id, phone, facebook_url, linkedin_url, photo_url, status, created_at, review_note, reviewed_at, invitation_id, processed_member_id, departments(name)"
          )
          .eq("status", "pending")
          .order("created_at", { ascending: true })
          .limit(12)
      : Promise.resolve({ data: [] as ApplicationRecord[] }),
    canViewMembershipDecisions
      ? admin
          .from("membership_applications")
          .select(
            "id, name, email, status, review_note, reviewed_at, invitation_id, processed_member_id"
          )
          .neq("status", "pending")
          .order("reviewed_at", { ascending: false })
          .limit(6)
      : Promise.resolve({ data: [] as ApplicationRecord[] }),
    canManageMembership
      ? admin
          .from("membership_applications")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending")
      : Promise.resolve({ count: 0 }),
    canManageMembership
      ? admin
          .from("member_invitations")
          .select("*", { count: "exact", head: true })
          .eq("is_active", true)
          .is("revoked_at", null)
      : Promise.resolve({ count: 0 }),
    canManageMembership
      ? admin.from("members").select("*", { count: "exact", head: true })
      : Promise.resolve({ count: 0 }),
    canManageMembership
      ? admin
          .from("profile_update_requests")
          .select("*", { count: "exact", head: true })
          .eq("request_type", "workplace_update")
          .eq("status", "pending")
      : Promise.resolve({ count: 0 }),
    canViewMembershipDecisions
      ? admin
          .from("profile_update_requests")
          .select(
            "id, member_id, payload, request_type, requested_at, review_note, reviewed_at, status, members!profile_update_requests_member_id_fkey(full_name, jnuits_id, email, member_type)"
          )
          .eq("request_type", "workplace_update")
          .neq("status", "pending")
          .order("reviewed_at", { ascending: false })
          .limit(6)
      : Promise.resolve({ data: [] as WorkplaceRequestRecord[] }),
    canManageMembership
      ? admin
          .from("profile_update_requests")
          .select("*", { count: "exact", head: true })
          .eq("request_type", "profile_change")
          .eq("status", "pending")
      : Promise.resolve({ count: 0 }),
    canReadAudit
      ? admin
          .from("audit_events")
          .select("id, action, entity_type, entity_id, metadata, created_at")
          .order("created_at", { ascending: false })
          .limit(12)
      : Promise.resolve({ data: [] }),
  ]);

  const pendingApplications =
    (pendingApplicationsResult.data || []) as ApplicationRecord[];
  const recentDecisions =
    (recentDecisionsResult.data || []) as ApplicationRecord[];
  const recentWorkplaceDecisions =
    (recentWorkplaceDecisionsResult.data || []) as WorkplaceRequestRecord[];
  const auditLogs = auditLogsResult.data || [];

  const processedMemberIds = recentDecisions
    .map((d) => d.processed_member_id)
    .filter((v): v is string => Boolean(v));

  const relatedMembers =
    canViewMembershipDecisions && processedMemberIds.length > 0
      ? await admin
          .from("members")
          .select("id, jnuits_id")
          .in("id", processedMemberIds)
      : { data: [] as { id: string; jnuits_id: string }[] };

  const memberMap = new Map(
    (relatedMembers.data || []).map((m) => [m.id, m.jnuits_id])
  );

  // Total pending count
  const totalPending =
    (pendingCountResult.count || 0) +
    (pendingWorkplaceCountResult.count || 0) +
    (pendingProfileChangeCountResult.count || 0);

  return (
    <div className="grid gap-8">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <OwnAdminCompletionCards />
      <div className="admin-page-header">
        <div>
          <p className="admin-page-header__breadcrumb">Admin</p>
          <h1 className="admin-page-header__title">Dashboard</h1>
          <p className="admin-page-header__desc">
            Pending queues, moderation actions, membership metrics, and platform activity at a glance.
          </p>
        </div>
        {totalPending > 0 && (
          <div
            className="flex items-center gap-2 rounded-xl border px-4 py-2.5"
            style={{
              borderColor: "color-mix(in oklab, var(--brand-gold) 45%, transparent)",
              background: "color-mix(in oklab, var(--brand-gold) 8%, transparent)",
            }}
          >
            <span
              className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black text-white"
              style={{ background: "var(--brand-gold)" }}
            >
              {totalPending}
            </span>
            <span className="text-sm font-semibold" style={{ color: "var(--brand-gold)" }}>
              items need your attention
            </span>
          </div>
        )}
      </div>

      {/* ── Flash ───────────────────────────────────────────────────────────── */}
      {flash ? (
        <section className="flash-panel" data-tone={flash.tone}>
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
            Operator feedback
          </p>
          <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-[-0.03em]">
            {flash.title}
          </h2>
          <p className="section-copy mt-2">{flash.message}</p>
          {flash.invitationCode ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="route-tile">
                <h3>Generated claim code</h3>
                <p className="mt-2 font-[family-name:var(--font-mono)] text-xl tracking-[0.12em] text-[var(--brand-blue)]">
                  {flash.invitationCode}
                </p>
              </div>
              <div className="route-tile">
                <h3>Assigned JnUITS ID</h3>
                <p className="mt-2 font-[family-name:var(--font-mono)] text-lg tracking-[0.08em]">
                  {flash.jnuitsId || "Not available"}
                </p>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* ── Metric cards ────────────────────────────────────────────────────── */}
      {canManageMembership ? (
        <section className="admin-metric-grid">
          <div
            className="admin-metric-card"
            data-tone={pendingCountResult.count ? "warning" : undefined}
          >
            <div className="admin-metric-card__icon">
              <UserCheck size={16} />
            </div>
            <p className="admin-metric-card__label">Pending applications</p>
            <p className="admin-metric-card__value">{pendingCountResult.count || 0}</p>
            <p className="admin-metric-card__sub">Awaiting operator review</p>
          </div>

          <div className="admin-metric-card" data-tone="info">
            <div className="admin-metric-card__icon">
              <Mail size={16} />
            </div>
            <p className="admin-metric-card__label">Active invitations</p>
            <p className="admin-metric-card__value">{activeInvitationsResult.count || 0}</p>
            <p className="admin-metric-card__sub">Claim codes outstanding</p>
          </div>

          <div
            className="admin-metric-card"
            data-tone={pendingWorkplaceCountResult.count ? "warning" : undefined}
          >
            <div className="admin-metric-card__icon">
              <ClipboardList size={16} />
            </div>
            <p className="admin-metric-card__label">Workplace requests</p>
            <p className="admin-metric-card__value">{pendingWorkplaceCountResult.count || 0}</p>
            <p className="admin-metric-card__sub">Pending workplace changes</p>
          </div>

          <div
            className="admin-metric-card"
            data-tone={pendingProfileChangeCountResult.count ? "warning" : undefined}
          >
            <div className="admin-metric-card__icon">
              <Users size={16} />
            </div>
            <p className="admin-metric-card__label">Profile changes</p>
            <p className="admin-metric-card__value">{pendingProfileChangeCountResult.count || 0}</p>
            <p className="admin-metric-card__sub">Pending profile edits</p>
          </div>

          <div className="admin-metric-card" data-tone="success">
            <div className="admin-metric-card__icon">
              <ShieldCheck size={16} />
            </div>
            <p className="admin-metric-card__label">Total members</p>
            <p className="admin-metric-card__value">{membersCountResult.count || 0}</p>
            <p className="admin-metric-card__sub">Registered portal accounts</p>
          </div>
        </section>
      ) : null}

      {/* ── Dashboard split: recent queue + audit log ────────────────────────── */}
      {showActivityPanels ? (
        <div className="admin-dashboard-split">

        {/* Pending queue summary */}
        {canManageMembership ? (
          <section
            className="glass-card p-5"
            style={{ borderRadius: "1.2rem" }}
          >
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold tracking-[-0.02em]">
              Pending queue
            </h2>
            <Link href="/admin/applications" className="queue-link text-xs">
              View all →
            </Link>
          </div>
          {pendingApplications.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">
              No pending applications — queue is clear.
            </p>
          ) : (
            <div className="admin-activity-feed">
              {pendingApplications.slice(0, 6).map((app) => (
                <div key={app.id} className="admin-activity-item">
                  <span className="admin-activity-item__dot" />
                  <div>
                    <p className="admin-activity-item__action">{app.name}</p>
                    <p className="admin-activity-item__meta">
                      {app.email} ·{" "}
                      {resolveDepartmentName(app.departments, app.department_code)}
                    </p>
                  </div>
                  <span className="admin-activity-item__time">
                    {relativeTime(app.created_at)}
                  </span>
                </div>
              ))}
              {pendingApplications.length > 6 && (
                <p className="pt-3 text-xs text-[var(--muted-foreground)]">
                  +{pendingApplications.length - 6} more in queue
                </p>
              )}
            </div>
          )}
          </section>
        ) : null}

        {/* Audit log */}
        {canReadAudit ? (
          <section
            className="glass-card p-5"
            style={{ borderRadius: "1.2rem" }}
          >
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold tracking-[-0.02em]">
              Recent activity
            </h2>
            <Link href="/admin/audit" className="queue-link text-xs">
              View all →
            </Link>
          </div>
          {auditLogs.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">
              No audit events recorded yet.
            </p>
          ) : (
            <div className="admin-activity-feed">
              {auditLogs.slice(0, 5).map((log) => (
                <div key={log.id as string} className="admin-activity-item">
                  <span className="admin-activity-item__dot" />
                  <div>
                    <p className="admin-activity-item__action">
                      {((log.action as string) || "system")
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (c) => c.toUpperCase())}
                    </p>
                    <p className="admin-activity-item__meta">
                      {(log.entity_type as string)
                        ? `on ${log.entity_type}`
                        : "platform event"}
                    </p>
                  </div>
                  <span className="admin-activity-item__time">
                    {relativeTime(log.created_at as string)}
                  </span>
                </div>
              ))}
              {auditLogs.length > 5 && (
                <details className="admin-expandable-details mt-2">
                  <summary className="text-xs text-[var(--color-primary)] cursor-pointer py-1 font-medium hover:underline">
                    +{auditLogs.length - 5} more recent activities
                  </summary>
                  <div className="pt-2">
                    {auditLogs.slice(5).map((log) => (
                      <div key={log.id as string} className="admin-activity-item">
                        <span className="admin-activity-item__dot" />
                        <div>
                          <p className="admin-activity-item__action">
                            {((log.action as string) || "system")
                              .replace(/_/g, " ")
                              .replace(/\b\w/g, (c) => c.toUpperCase())}
                          </p>
                          <p className="admin-activity-item__meta">
                            {(log.entity_type as string)
                              ? `on ${log.entity_type}`
                              : "platform event"}
                          </p>
                        </div>
                        <span className="admin-activity-item__time">
                          {relativeTime(log.created_at as string)}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
          </section>
        ) : null}
        </div>
      ) : null}

      {/* ── Quick-action tiles ───────────────────────────────────────────────── */}
      {quickLinks.length > 0 ? (
        <section>
          <h2
            className="mb-3 text-xs font-bold uppercase tracking-[0.18em]"
            style={{ color: "var(--muted-foreground)" }}
          >
            Quick navigation
          </h2>
          <div className="admin-quick-grid">
            {quickLinks.map((link) => {
              const Icon =
                adminQuickIconMap[
                  link.iconKey as keyof typeof adminQuickIconMap
                ] || FolderOpen;

              return (
                <Link href={link.href} className="admin-quick-tile" key={link.href}>
                  <span className="admin-quick-tile__icon">
                    <Icon size={16} />
                  </span>
                  {link.label}
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}
      {/* ── Source-of-truth membership workflows ───────────────────────────── */}
      {canManageMembership ? (
        <section id="membership-workflows" className="grid gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <span className="eyebrow">Membership workflows</span>
              <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,3rem)] leading-[0.96] tracking-[-0.04em]">
                Daily queues live on dedicated operator pages
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-[var(--muted-foreground)]">
              The dashboard summarizes queue pressure only. Open the dedicated
              workspace for approval, rejection, delivery, and audit actions.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <article className="route-tile">
              <h3>Applications</h3>
              <p>
                {pendingCountResult.count || 0} membership application{(pendingCountResult.count || 0) === 1 ? "" : "s"} waiting for review.
              </p>
              <Link className="queue-link" href="/admin/applications">
                Open applications
              </Link>
            </article>
            <article className="route-tile">
              <h3>Invitations</h3>
              <p>
                {activeInvitationsResult.count || 0} active claim-code invitation{(activeInvitationsResult.count || 0) === 1 ? "" : "s"}; delivery and revocation live in the invitation workspace.
              </p>
              <Link className="queue-link" href="/admin/invitations">
                Open invitations
              </Link>
            </article>
            <article className="route-tile">
              <h3>Profile requests</h3>
              <p>
                {(pendingWorkplaceCountResult.count || 0) + (pendingProfileChangeCountResult.count || 0)} profile or workplace request{((pendingWorkplaceCountResult.count || 0) + (pendingProfileChangeCountResult.count || 0)) === 1 ? "" : "s"} waiting for moderation.
              </p>
              <Link className="queue-link" href="/admin/profile-changes">
                Open profile requests
              </Link>
            </article>
          </div>

          <article className="route-tile" id="workplace">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3>Workplace directory and history</h3>
                <p className="mt-2">
                  The dedicated workplace workspace remains available for alumni
                  workplace history, stale profile checks, bulk moderation, and
                  direct profile corrections.
                </p>
              </div>
              <Link className="secondary-button" href="/admin/workplace">
                Open workplace workspace
              </Link>
            </div>
          </article>
        </section>
      ) : null}
      {showDecisionCards ? (
        <section
          id="decisions"
          className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.92fr)]"
        >
        {canViewMembershipDecisions ? (
          <article className="route-tile">
          <h3>Recent queue decisions</h3>
          <div className="mt-4 grid gap-3">
            {recentDecisions.length === 0 ? (
              <p>No approvals or rejections recorded yet in the new stack.</p>
            ) : (
              recentDecisions.map((decision) => (
                <div
                  key={decision.id}
                  className="rounded-[1.1rem] border border-[var(--line)] p-4"
                  style={{
                    background:
                      "color-mix(in oklab, var(--panel) 92%, transparent)",
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="font-[family-name:var(--font-heading)] text-lg">
                      {decision.name}
                    </strong>
                    <span className="status-pill">
                      {decision.status}
                      {decision.processed_member_id
                        ? ` • ${
                            memberMap.get(decision.processed_member_id) ||
                            "member linked"
                          }`
                        : ""}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                    {decision.email}
                  </p>
                  {decision.review_note ? (
                    <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">
                      {decision.review_note}
                    </p>
                  ) : null}
                </div>
              ))
            )}
          </div>
          </article>
        ) : null}

        {canViewMembershipDecisions ? (
          <article className="route-tile">
          <h3>Recent workplace moderation</h3>
          <div className="mt-4 grid gap-3">
            {recentWorkplaceDecisions.length === 0 ? (
              <p>No workplace approvals or rejections recorded yet.</p>
            ) : (
              recentWorkplaceDecisions.map((request) => {
                const member = Array.isArray(request.members)
                  ? request.members[0]
                  : request.members;

                return (
                  <div
                    key={request.id}
                    className="rounded-[1.1rem] border border-[var(--line)] p-4"
                    style={{
                      background:
                        "color-mix(in oklab, var(--panel) 92%, transparent)",
                    }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="font-[family-name:var(--font-heading)] text-lg">
                        {member?.full_name || "Linked member"}
                      </strong>
                      <span className="status-pill">
                        {request.status}
                        {member?.jnuits_id ? ` • ${member.jnuits_id}` : ""}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                      {member?.email || request.request_type}
                    </p>
                    {request.review_note ? (
                      <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">
                        {request.review_note}
                      </p>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
          </article>
        ) : null}

        {dashboardCapabilities.certificatesManage ||
        dashboardCapabilities.reconcileManage ? (
          <div className="grid gap-4" id="certificates">
          {dashboardCapabilities.certificatesManage ? (
            <article className="route-tile">
            <h3>Certificates</h3>
            <p>
              Public certificate verification is live through certificate IDs and public verification links. Use the Certificates workspace to create records, import batches, and monitor import history.
            </p>
            </article>
          ) : null}
          {dashboardCapabilities.reconcileManage ? (
            <article className="route-tile" id="reconcile">
            <h3>Batch import and reconciliation</h3>
            <p>
              Reconciliation snapshots now live in Reports. Use saved operator reports for migration parity, queue pressure, and cutover evidence.
            </p>
            </article>
          ) : null}
          </div>
        ) : null}
        </section>
      ) : null}
    </div>
  );
}
