import { cookies } from "next/headers";
import { CheckCircle, Clock, SearchCheck, UserCheck, XCircle } from "lucide-react";
import { ADMIN_FLASH_COOKIE_NAME, parseAdminFlash } from "@/lib/admin/flash";
import { EmptyState } from "@/components/ui/empty-state";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";
import { requireAdminPermission } from "@/lib/auth/session";
import {
  approveMembershipApplication,
  rejectMembershipApplication,
  requestMembershipApplicationReview,
} from "./membership-actions";
import {
  approveAlumniOnboardingCase,
  rejectAlumniOnboardingCase,
} from "./alumni-actions";

type MembershipApplication = {
  batch_label: null | string;
  created_at: string;
  department_code: null | string;
  email: string;
  id: string;
  name: string;
  phone: null | string;
  review_note: null | string;
  status: "needs_review" | "pending";
  student_id: null | string;
};

type AlumniCase = {
  created_at: string;
  email: null | string;
  full_name: null | string;
  id: string;
  jnuits_id: null | string;
  review_note: null | string;
  status: "pending";
};

type RecentDecision = {
  email: string;
  id: string;
  name: string;
  review_note: null | string;
  reviewed_at: null | string;
  status: string;
};

function relativeTime(value: string) {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 60_000)
  );
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1_440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1_440)}d ago`;
}

export const metadata = { title: "Applications — Admin | JnUITS" };

export default async function ApplicationsPage() {
  await requireAdminPermission("admin.membership.manage", { fallbackPath: "/admin/dashboard" });
  const admin = asFlexibleClient(createAdminClient());
  const cookieStore = await cookies();
  const flash = parseAdminFlash(cookieStore.get(ADMIN_FLASH_COOKIE_NAME)?.value);
  const [membershipResult, membershipCountResult, recentResult, alumniResult, alumniCountResult] = await Promise.all([
    admin
      .from("membership_applications" as string)
      .select("id, name, email, department_code, batch_label, student_id, phone, status, created_at, review_note")
      .in("status", ["pending", "needs_review"])
      .order("created_at", { ascending: true })
      .limit(50),
    admin
      .from("membership_applications" as string)
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "needs_review"]),
    admin
      .from("membership_applications" as string)
      .select("id, name, email, status, review_note, reviewed_at")
      .in("status", ["approved", "rejected"])
      .order("reviewed_at", { ascending: false })
      .limit(20),
    admin
      .from("alumni_onboarding_cases" as string)
      .select("id, full_name, email, jnuits_id, status, review_note, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(50),
    admin
      .from("alumni_onboarding_cases" as string)
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  // These columns are introduced by local-only migrations and intentionally
  // remain outside generated remote schema types until migration approval.
  const membership = (membershipResult.data || []) as unknown as MembershipApplication[];
  const recent = (recentResult.data || []) as unknown as RecentDecision[];
  const alumni = (alumniResult.data || []) as unknown as AlumniCase[];
  const membershipCount = membershipCountResult.count || 0;
  const alumniCount = alumniCountResult.count || 0;

  return (
    <div className="grid gap-8">
      <header className="admin-page-header">
        <div>
          <p className="admin-page-header__breadcrumb">Admin / Membership</p>
          <h1 className="admin-page-header__title">Applications</h1>
          <p className="admin-page-header__desc">
            Review confirmed annual membership and alumni onboarding cases. Approval reconciles canonical identity and issues a claim, never an account.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="abadge abadge--pending"><Clock size={10} /> {membershipCount} membership</span>
          <span className="abadge abadge--pending"><Clock size={10} /> {alumniCount} alumni</span>
        </div>
      </header>

      {flash ? (
        <section className="flash-panel" data-tone={flash.tone}>
          <p className="admin-section-label">Operator feedback</p>
          <h2 className="mt-2 text-2xl font-semibold">{flash.title}</h2>
          <p className="mt-1 text-sm leading-7">{flash.message}</p>
        </section>
      ) : null}

      <section className="grid gap-4" aria-labelledby="membership-queue-heading">
        <div>
          <p className="admin-section-label">Annual membership</p>
          <h2 className="admin-card-row__title" id="membership-queue-heading">Confirmed applications, oldest first</h2>
        </div>
        {!membership.length ? (
          <EmptyState title="No membership applications awaiting review" description="Email-confirmed membership submissions appear here. No cycle window is required." />
        ) : membership.map((application) => (
          <article className="admin-review-card admin-review-card--pending" key={application.id}>
            <div className="admin-review-card__header">
              <div>
                <div className="admin-review-card__chips">
                  <span className="abadge abadge--pending">{application.status === "needs_review" ? "Needs review" : "Pending"}</span>
                  <span className="detail-chip">{relativeTime(application.created_at)}</span>
                  {application.batch_label ? <span className="detail-chip">Batch {application.batch_label}</span> : null}
                </div>
                <h3 className="admin-review-card__name mt-1">{application.name}</h3>
                <p className="admin-review-card__id">{application.email}</p>
              </div>
              <div className="text-right text-xs text-[var(--muted-foreground)]">
                <p>{application.department_code || "Department not supplied"}</p>
                <p>{application.student_id || "Student ID not supplied"}</p>
              </div>
            </div>
            <form className="admin-review-card__actions">
              <input name="applicationId" type="hidden" value={application.id} />
              <label className="input-label">
                Official joining date (optional)
                <input name="joinedOn" type="date" />
                <span className="text-xs text-[var(--muted-foreground)]">Leave blank to use the approval date in Bangladesh. Enter an earlier date only after checking the official member register. Renewal follows this date each year.</span>
              </label>
              <label className="input-label">
                Review note
                <textarea defaultValue={application.review_note || ""} name="reviewNote" placeholder="Decision rationale or follow-up needed" rows={3} />
              </label>
              <div className="flex flex-wrap gap-3">
                <button className="admin-btn admin-btn--success" formAction={approveMembershipApplication}>
                  <CheckCircle size={15} /> Approve and issue claim
                </button>
                <button className="admin-btn admin-btn--ghost" formAction={requestMembershipApplicationReview}>
                  <SearchCheck size={15} /> Request review
                </button>
                <button className="admin-btn admin-btn--danger" formAction={rejectMembershipApplication}>
                  <XCircle size={15} /> Reject
                </button>
              </div>
            </form>
          </article>
        ))}
      </section>

      <section className="grid gap-4" id="alumni-onboarding" aria-labelledby="alumni-queue-heading">
        <div>
          <p className="admin-section-label">Alumni onboarding</p>
          <h2 className="admin-card-row__title" id="alumni-queue-heading">Confirmed alumni cases, oldest first</h2>
        </div>
        {!alumni.length ? (
          <EmptyState title="No alumni cases awaiting review" description="Email-confirmed alumni onboarding cases appear here." />
        ) : alumni.map((onboardingCase) => (
          <article className="admin-review-card admin-review-card--pending" key={onboardingCase.id}>
            <div className="admin-review-card__header">
              <div>
                <span className="abadge abadge--pending">Pending</span>
                <h3 className="admin-review-card__name mt-2">{onboardingCase.full_name || "Alumni applicant"}</h3>
                <p className="admin-review-card__id">{onboardingCase.email || "Email unavailable"}</p>
              </div>
              <span className="detail-chip">{onboardingCase.jnuits_id || "Identity match required"}</span>
            </div>
            <form className="admin-review-card__actions">
              <input name="caseId" type="hidden" value={onboardingCase.id} />
              <label className="input-label">
                Review note
                <textarea defaultValue={onboardingCase.review_note || ""} name="reviewNote" rows={3} />
              </label>
              <div className="flex flex-wrap gap-3">
                <button className="admin-btn admin-btn--success" formAction={approveAlumniOnboardingCase}>
                  <UserCheck size={15} /> Approve and issue claim
                </button>
                <button className="admin-btn admin-btn--danger" formAction={rejectAlumniOnboardingCase}>
                  <XCircle size={15} /> Reject
                </button>
              </div>
            </form>
          </article>
        ))}
      </section>

      {recent.length ? (
        <section className="grid gap-3">
          <p className="admin-section-label">Recent membership decisions</p>
          <div className="grid gap-3">
            {recent.map((decision) => (
              <article className="admin-review-card" key={decision.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><h3 className="font-semibold">{decision.name}</h3><p className="text-sm text-[var(--muted-foreground)]">{decision.email}</p></div>
                  <span className={`abadge abadge--${decision.status}`}>{decision.status}</span>
                </div>
                <p className="mt-3 text-sm text-[var(--muted-foreground)]">{decision.review_note || "No review note."}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
