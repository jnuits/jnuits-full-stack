import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";
import { cookies } from "next/headers";
import { ADMIN_FLASH_COOKIE_NAME, parseAdminFlash } from "@/lib/admin/flash";
import {
  approveMembershipApplication,
  rejectMembershipApplication,
} from "@/app/admin/membership/moderation-actions";
import {
  approveAlumniOnboardingCase,
  rejectAlumniOnboardingCase,
} from "./alumni-actions";
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


type AlumniOnboardingCase = {
  created_at: string;
  email: string | null;
  form_submission_id: string;
  full_name: string | null;
  id: string;
  invitation_id: string | null;
  jnuits_id: string | null;
  processed_member_id: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  status: "approved" | "pending" | "rejected";
};function resolveDepartmentName(
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
  const admin = asFlexibleClient(createAdminClient());
  const cookieStore = await cookies();
  const flash = parseAdminFlash(cookieStore.get(ADMIN_FLASH_COOKIE_NAME)?.value);

  const [pendingResult, recentResult, countResult, alumniPendingResult, alumniCountResult] = await Promise.all([
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
    admin
      .from("alumni_onboarding_cases")
      .select(
        "id, form_submission_id, full_name, email, jnuits_id, status, review_note, reviewed_at, invitation_id, processed_member_id, created_at"
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(20),
    admin
      .from("alumni_onboarding_cases")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);
  const pending = (pendingResult.data || []) as ApplicationRecord[];
  const recent = (recentResult.data || []) as ApplicationRecord[];
  const pendingCount = countResult.count || 0;
  const alumniPending = (alumniPendingResult.data || []) as AlumniOnboardingCase[];
  const alumniPendingCount = alumniCountResult.count || 0;

  return (
    <div className="grid gap-8">
      <div className="admin-page-header">
        <div>
          <p className="admin-page-header__breadcrumb">Admin / Membership</p>
          <h1 className="admin-page-header__title">Applications</h1>
          <p className="admin-page-header__desc">
            Review annual membership applications and confirmed alumni onboarding cases. Approval creates or reactivates a member, then issues the canonical claim invitation.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <span className="abadge abadge--pending">
              <Clock size={10} /> {pendingCount} pending
            </span>
          )}
          {alumniPendingCount > 0 && (
            <span className="abadge abadge--pending">
              <Clock size={10} /> {alumniPendingCount} alumni
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
      <div className="admin-metric-grid">
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


      <section id="alumni-onboarding">
        <p className="admin-section-label">Alumni onboarding — oldest first</p>

        {alumniPending.length === 0 ? (
          <EmptyState
            title="No alumni cases awaiting review"
            description="Confirmed alumni onboarding submissions will appear here after staff publishes an alumni form."
          />
        ) : (
          <div className="grid gap-4">
            {alumniPending.map((onboardingCase) => (
              <div key={onboardingCase.id} className="admin-review-card admin-review-card--pending">
                <div className="admin-review-card__header">
                  <div>
                    <div className="admin-review-card__chips">
                      <span className="abadge abadge--pending">Pending</span>
                      <span className="detail-chip">{relativeTime(onboardingCase.created_at)}</span>
                    </div>
                    <p className="admin-review-card__name mt-1">
                      {onboardingCase.full_name || "Alumni applicant"}
                    </p>
                    <p className="admin-review-card__id">{onboardingCase.email || "Email unavailable"}</p>
                  </div>
                  {onboardingCase.jnuits_id ? (
                    <span className="detail-chip">{onboardingCase.jnuits_id}</span>
                  ) : null}
                </div>

                <div className="admin-review-card__diff">
                  <div className="admin-diff-box">
                    <p className="admin-diff-box__label">Identity review</p>
                    <div className="admin-diff-box__item">
                      <span className="admin-diff-box__key">Submitted</span>
                      <span>{new Date(onboardingCase.created_at).toLocaleDateString("en-BD")}</span>
                    </div>
                    <div className="admin-diff-box__item">
                      <span className="admin-diff-box__key">Member match</span>
                      <span>Verified during approval</span>
                    </div>
                  </div>
                  <div className="admin-diff-box">
                    <p className="admin-diff-box__label">Approval result</p>
                    <p className="text-xs leading-6" style={{ color: "var(--muted-foreground)" }}>
                      Approval deduplicates by email and JnUITS ID, safely reactivates an existing alumni record, and issues the canonical invitation claim.
                    </p>
                  </div>
                </div>

                <form className="admin-review-card__actions">
                  <input name="caseId" type="hidden" value={onboardingCase.id} />
                  <label className="input-label">
                    Review note (optional for approval, recommended for rejection)
                    <textarea
                      name="reviewNote"
                      placeholder="Identity verification or follow-up note"
                      rows={3}
                    />
                  </label>
                  <div className="flex flex-wrap gap-3">
                    <button className="admin-btn admin-btn--success" formAction={approveAlumniOnboardingCase}>
                      <CheckCircle size={15} /> Approve &amp; issue claim
                    </button>
                    <button className="admin-btn admin-btn--danger" formAction={rejectAlumniOnboardingCase}>
                      <XCircle size={15} /> Reject onboarding
                    </button>
                  </div>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>      {/* ── Recent Decisions ── */}
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
                    <td className="max-w-64 whitespace-normal break-words text-xs" data-label="Note" style={{ color: "var(--muted-foreground)" }}>
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


