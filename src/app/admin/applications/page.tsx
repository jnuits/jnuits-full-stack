import { createAdminClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";
import { ADMIN_FLASH_COOKIE_NAME, parseAdminFlash } from "@/lib/admin/flash";
import {
  approveMembershipApplication,
  rejectMembershipApplication,
} from "@/app/admin/membership/moderation-actions";
import { EmptyState } from "@/components/ui/empty-state";
import { CheckCircle, XCircle, Clock, UserCheck } from "lucide-react";

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

export const metadata = { title: "Applications — Admin | JnUITS" };

export default async function ApplicationsPage() {
  const admin = createAdminClient();
  const cookieStore = await cookies();
  const flash = parseAdminFlash(cookieStore.get(ADMIN_FLASH_COOKIE_NAME)?.value);

  const [pendingResult, recentResult, countResult] = await Promise.all([
    admin
      .from("membership_applications")
      .select(
        "id, name, email, department_code, batch_label, student_id, phone, facebook_url, linkedin_url, photo_url, status, created_at, review_note, reviewed_at, invitation_id, processed_member_id, departments(name)"
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(20),
    admin
      .from("membership_applications")
      .select("id, name, email, status, review_note, reviewed_at, invitation_id, processed_member_id")
      .neq("status", "pending")
      .order("reviewed_at", { ascending: false })
      .limit(10),
    admin
      .from("membership_applications")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  const pending = (pendingResult.data || []) as ApplicationRecord[];
  const recent = (recentResult.data || []) as ApplicationRecord[];
  const pendingCount = countResult.count || 0;

  return (
    <div className="grid gap-8">
      <div className="admin-page-header">
        <div>
          <p className="admin-page-header__breadcrumb">Admin / Membership</p>
          <h1 className="admin-page-header__title">Applications</h1>
          <p className="admin-page-header__desc">
            Review, approve, or reject pending membership applications. Approved applicants receive a membership record and invitation claim code.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <span className="abadge abadge--pending">
              <Clock size={10} /> {pendingCount} pending
            </span>
          )}
        </div>
      </div>

      {flash && (
        <section className="flash-panel" data-tone={flash.tone}>
          <p className="admin-section-label">Operator feedback</p>
          <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-[-0.03em]">
            {flash.title}
          </h2>
          <p className="mt-1 text-sm leading-7">{flash.message}</p>
        </section>
      )}

      {/* ── Metrics ── */}
      <div className="admin-metric-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(11rem, 1fr))" }}>
        <div className="admin-metric-card" data-tone="warning">
          <div className="admin-metric-card__icon"><Clock size={16} /></div>
          <p className="admin-metric-card__label">Pending</p>
          <p className="admin-metric-card__value">{pendingCount}</p>
          <p className="admin-metric-card__sub">Awaiting review</p>
        </div>
        <div className="admin-metric-card" data-tone="info">
          <div className="admin-metric-card__icon"><UserCheck size={16} /></div>
          <p className="admin-metric-card__label">In queue</p>
          <p className="admin-metric-card__value">{pending.length}</p>
          <p className="admin-metric-card__sub">Showing oldest first</p>
        </div>
        <div className="admin-metric-card" data-tone="success">
          <div className="admin-metric-card__icon"><CheckCircle size={16} /></div>
          <p className="admin-metric-card__label">Approved</p>
          <p className="admin-metric-card__value">{recent.filter((r) => r.status === "approved").length}</p>
          <p className="admin-metric-card__sub">Recent decisions</p>
        </div>
        <div className="admin-metric-card" data-tone="danger">
          <div className="admin-metric-card__icon"><XCircle size={16} /></div>
          <p className="admin-metric-card__label">Rejected</p>
          <p className="admin-metric-card__value">{recent.filter((r) => r.status === "rejected").length}</p>
          <p className="admin-metric-card__sub">Recent decisions</p>
        </div>
      </div>

      {/* ── Pending Queue ── */}
      <section>
        <p className="admin-section-label">Pending applications — oldest first</p>

        {pending.length === 0 ? (
          <EmptyState
            title="No pending applications"
            description="The application queue is clear. New submissions from the portal will appear here."
          />
        ) : (
          <div className="grid gap-4">
            {pending.map((app) => (
              <div key={app.id} className="admin-review-card admin-review-card--pending">
                <div className="admin-review-card__header">
                  <div>
                    <div className="admin-review-card__chips">
                      <span className="abadge abadge--pending">Pending</span>
                      <span className="detail-chip">{relativeTime(app.created_at)}</span>
                      {app.batch_label && <span className="detail-chip">Batch {app.batch_label}</span>}
                    </div>
                    <p className="admin-review-card__name mt-1">{app.name}</p>
                    <p className="admin-review-card__id">{app.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">
                      {resolveDepartmentName(app.departments, app.department_code)}
                    </p>
                    {app.student_id && (
                      <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                        ID: {app.student_id}
                      </p>
                    )}
                  </div>
                </div>

                <div className="admin-review-card__diff">
                  <div className="admin-diff-box">
                    <p className="admin-diff-box__label">Contact info</p>
                    {app.phone && (
                      <div className="admin-diff-box__item">
                        <span className="admin-diff-box__key">Phone</span>
                        <span>{app.phone}</span>
                      </div>
                    )}
                    {app.facebook_url && (
                      <div className="admin-diff-box__item">
                        <span className="admin-diff-box__key">Facebook</span>
                        <span className="truncate text-xs">{app.facebook_url}</span>
                      </div>
                    )}
                    {app.linkedin_url && (
                      <div className="admin-diff-box__item">
                        <span className="admin-diff-box__key">LinkedIn</span>
                        <span className="truncate text-xs">{app.linkedin_url}</span>
                      </div>
                    )}
                    {!app.phone && !app.facebook_url && !app.linkedin_url && (
                      <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>No contact info provided</p>
                    )}
                  </div>
                  <div className="admin-diff-box">
                    <p className="admin-diff-box__label">Application detail</p>
                    <div className="admin-diff-box__item">
                      <span className="admin-diff-box__key">Submitted</span>
                      <span>{new Date(app.created_at).toLocaleDateString("en-BD")}</span>
                    </div>
                    <div className="admin-diff-box__item">
                      <span className="admin-diff-box__key">Status</span>
                      <span className="capitalize">{app.status}</span>
                    </div>
                  </div>
                </div>

                <form className="admin-review-card__actions">
                  <input type="hidden" name="applicationId" value={app.id} />
                  <label className="input-label">
                    Review note (required for rejection, optional for approval)
                    <textarea
                      name="reviewNote"
                      placeholder="Operator rationale or follow-up instruction"
                      rows={3}
                    />
                  </label>
                  <div className="flex flex-wrap gap-3">
                    <button className="admin-btn admin-btn--success" formAction={approveMembershipApplication}>
                      <CheckCircle size={15} /> Approve &amp; create member
                    </button>
                    <button className="admin-btn admin-btn--danger" formAction={rejectMembershipApplication}>
                      <XCircle size={15} /> Reject application
                    </button>
                  </div>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Recent Decisions ── */}
      {recent.length > 0 && (
        <section>
          <p className="admin-section-label">Recent decisions</p>
          <div className="admin-responsive-table-shell overflow-x-auto rounded-xl border" style={{ borderColor: "var(--line)" }}>
            <table className="admin-queue-table admin-responsive-table">
              <thead>
                <tr>
                  <th>Applicant</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Reviewed</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((app) => (
                  <tr key={app.id}>
                    <td className="font-semibold text-sm" data-label="Applicant">{app.name}</td>
                    <td className="text-sm" data-label="Email" style={{ color: "var(--muted-foreground)" }}>{app.email}</td>
                    <td data-label="Status">
                      <span className={`abadge abadge--${app.status}`}>{app.status}</span>
                    </td>
                    <td className="text-xs" data-label="Reviewed" style={{ color: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}>
                      {app.reviewed_at ? new Date(app.reviewed_at).toLocaleDateString("en-BD") : "—"}
                    </td>
                    <td className="text-xs max-w-[16rem] truncate" data-label="Note" style={{ color: "var(--muted-foreground)" }}>
                      {app.review_note || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
