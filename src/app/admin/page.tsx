import { cookies } from "next/headers";
import {
  approveMembershipApplication,
  rejectMembershipApplication,
} from "@/app/admin/actions";
import { InvitationsPanel } from "@/components/admin/invitations-panel";
import { WorkplaceRequestsPanel } from "@/components/admin/workplace-requests-panel";
import {
  ADMIN_FLASH_COOKIE_NAME,
  parseAdminFlash,
} from "@/lib/admin/flash";
import { createAdminClient } from "@/lib/supabase/admin";

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

type InvitationRecord = {
  id: string;
  member_id: string;
  created_at: string;
  expires_at: string;
  is_active: boolean;
  last_used_at: string | null;
  max_uses: number;
  notes: string | null;
  revoked_at: string | null;
  used_count: number;
  members?:
    | {
        email?: string | null;
        full_name?: string | null;
        jnuits_id?: string | null;
        member_type?: string | null;
      }
    | {
        email?: string | null;
        full_name?: string | null;
        jnuits_id?: string | null;
        member_type?: string | null;
      }[]
    | null;
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
        professional_visibility?: string | null;
        work_location?: string | null;
      }[]
    | null;
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

export default async function AdminPage() {
  const admin = createAdminClient();
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
    activeInvitationRowsResult,
    pendingWorkplaceRequestsResult,
    pendingWorkplaceCountResult,
    recentWorkplaceDecisionsResult,
  ] = await Promise.all([
    admin
      .from("membership_applications")
      .select(
        "id, name, email, department_code, batch_label, student_id, phone, facebook_url, linkedin_url, photo_url, status, created_at, review_note, reviewed_at, invitation_id, processed_member_id, departments(name)"
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(12),
    admin
      .from("membership_applications")
      .select(
        "id, name, email, status, review_note, reviewed_at, invitation_id, processed_member_id"
      )
      .neq("status", "pending")
      .order("reviewed_at", { ascending: false })
      .limit(6),
    admin
      .from("membership_applications")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    admin
      .from("member_invitations")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)
      .is("revoked_at", null),
    admin.from("members").select("*", { count: "exact", head: true }),
    admin
      .from("member_invitations")
      .select(
        "id, member_id, created_at, expires_at, is_active, last_used_at, max_uses, notes, revoked_at, used_count, members(full_name, jnuits_id, email, member_type)"
      )
      .eq("is_active", true)
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .limit(8),
    admin
      .from("profile_update_requests")
      .select(
        "id, member_id, payload, request_type, requested_at, review_note, reviewed_at, status, members(full_name, jnuits_id, email, member_type, current_organization, designation, work_location, professional_visibility)"
      )
      .eq("request_type", "workplace_update")
      .eq("status", "pending")
      .order("requested_at", { ascending: true })
      .limit(8),
    admin
      .from("profile_update_requests")
      .select("*", { count: "exact", head: true })
      .eq("request_type", "workplace_update")
      .eq("status", "pending"),
    admin
      .from("profile_update_requests")
      .select(
        "id, member_id, payload, request_type, requested_at, review_note, reviewed_at, status, members(full_name, jnuits_id, email, member_type)"
      )
      .eq("request_type", "workplace_update")
      .neq("status", "pending")
      .order("reviewed_at", { ascending: false })
      .limit(6),
  ]);

  const pendingApplications =
    (pendingApplicationsResult.data || []) as ApplicationRecord[];
  const recentDecisions =
    (recentDecisionsResult.data || []) as ApplicationRecord[];
  const activeInvitationRows =
    (activeInvitationRowsResult.data || []) as InvitationRecord[];
  const pendingWorkplaceRequests =
    (pendingWorkplaceRequestsResult.data || []) as WorkplaceRequestRecord[];
  const recentWorkplaceDecisions =
    (recentWorkplaceDecisionsResult.data || []) as WorkplaceRequestRecord[];

  const processedMemberIds = recentDecisions
    .map((decision) => decision.processed_member_id)
    .filter((value): value is string => Boolean(value));

  const relatedMembers =
    processedMemberIds.length > 0
      ? await admin
          .from("members")
          .select("id, jnuits_id")
          .in("id", processedMemberIds)
      : { data: [] as { id: string; jnuits_id: string }[] };

  const memberMap = new Map(
    (relatedMembers.data || []).map((member) => [member.id, member.jnuits_id])
  );

  return (
    <div className="grid gap-8">
      <div>
        <div className="workspace-topbar">
          <span className="eyebrow">Technical operator workspace</span>
          <span className="status-pill">Phase 05 and 07 now active</span>
        </div>
        <h1 className="section-title text-[2.5rem]">
          Admin queues, invitation review, and protected operations.
        </h1>
        <p className="section-copy mt-3">
          This area is for technical moderators and admins. Membership
          application review, invitation lifecycle control, and workplace
          moderation now live here instead of depending on the legacy operator
          stack.
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="metric-card">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--muted)]">
            Pending applications
          </p>
          <p className="metric-card__value mt-3">{pendingCountResult.count || 0}</p>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            These records still need an operator decision before the applicant
            can enter the claim flow.
          </p>
        </article>
        <article className="metric-card" id="invitations">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--muted)]">
            Active invitations
          </p>
          <p className="metric-card__value mt-3">
            {activeInvitationsResult.count || 0}
          </p>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            Invitation creation is now live; resend and lifecycle controls
            follow in the next operator pass.
          </p>
        </article>
        <article className="metric-card" id="workplace">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--muted)]">
            Pending workplace requests
          </p>
          <p className="metric-card__value mt-3">
            {pendingWorkplaceCountResult.count || 0}
          </p>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            Alumni workplace changes are now queued for operator moderation
            instead of being applied directly from the member portal.
          </p>
        </article>
        <article className="metric-card">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--muted)]">
            Members in the new stack
          </p>
          <p className="metric-card__value mt-3">{membersCountResult.count || 0}</p>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            Approved applications now create durable member records directly in
            Supabase instead of the legacy admin.
          </p>
        </article>
      </section>

      <section id="applications" className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="eyebrow">Membership queue</span>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,3rem)] leading-[0.96] tracking-[-0.04em]">
              Pending applications ready for operator review
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-7 text-[var(--muted)]">
            Approving an application creates or reuses the member record,
            assigns a legacy-compatible JnUITS ID, generates a claim code, and
            writes audit evidence.
          </p>
        </div>

        {pendingApplications.length === 0 ? (
          <article className="route-tile">
            <h3>No pending applications right now</h3>
            <p>
              The intake queue is empty. As new submissions arrive, they will
              show up here for approval or rejection.
            </p>
          </article>
        ) : (
          pendingApplications.map((application) => (
            <article key={application.id} className="application-card">
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
                <div className="application-card__meta">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="eyebrow">Pending review</span>
                    <span className="detail-chip">
                      Applied{" "}
                      {new Date(application.created_at).toLocaleDateString(
                        "en-BD"
                      )}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-[family-name:var(--font-heading)] text-3xl font-semibold tracking-[-0.04em]">
                      {application.name}
                    </h3>
                    <p className="mt-2 text-base font-semibold text-[var(--brand-blue)]">
                      {application.email}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="detail-chip">
                      {resolveDepartmentName(
                        application.departments,
                        application.department_code
                      )}
                    </span>
                    {application.batch_label ? (
                      <span className="detail-chip">
                        Batch {application.batch_label}
                      </span>
                    ) : null}
                    {application.student_id ? (
                      <span className="detail-chip">
                        Student ID {application.student_id}
                      </span>
                    ) : null}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {application.phone ? (
                      <div className="route-tile">
                        <h3>Phone</h3>
                        <p>{application.phone}</p>
                      </div>
                    ) : null}
                    {application.photo_url ? (
                      <div className="route-tile">
                        <h3>Photo</h3>
                        <a
                          className="queue-link"
                          href={application.photo_url}
                          rel="noreferrer"
                          target="_blank"
                        >
                          Open uploaded photo
                        </a>
                      </div>
                    ) : null}
                    {application.facebook_url ? (
                      <div className="route-tile">
                        <h3>Facebook</h3>
                        <a
                          className="queue-link"
                          href={application.facebook_url}
                          rel="noreferrer"
                          target="_blank"
                        >
                          Review profile
                        </a>
                      </div>
                    ) : null}
                    {application.linkedin_url ? (
                      <div className="route-tile">
                        <h3>LinkedIn</h3>
                        <a
                          className="queue-link"
                          href={application.linkedin_url}
                          rel="noreferrer"
                          target="_blank"
                        >
                          Review profile
                        </a>
                      </div>
                    ) : null}
                  </div>
                </div>

                <form className="application-card__actions">
                  <input
                    type="hidden"
                    name="applicationId"
                    value={application.id}
                  />
                  <label className="input-label">
                    Optional JnUITS ID override
                    <input
                      name="jnuitsIdOverride"
                      placeholder="JNUITS-2026001"
                      type="text"
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="input-label">
                      Invitation expiry days
                      <input
                        defaultValue={14}
                        max={60}
                        min={1}
                        name="invitationExpiresInDays"
                        type="number"
                      />
                    </label>
                    <label className="input-label">
                      Max uses
                      <input
                        defaultValue={1}
                        max={5}
                        min={1}
                        name="maxUses"
                        type="number"
                      />
                    </label>
                  </div>
                  <label className="input-label">
                    Review note
                    <textarea
                      name="reviewNote"
                      placeholder="Operator note, context, or decision rationale"
                      rows={4}
                    />
                  </label>
                  <div className="flex flex-wrap gap-3">
                    <button
                      className="primary-button"
                      formAction={approveMembershipApplication}
                    >
                      Approve and generate invite
                    </button>
                    <button
                      className="secondary-button"
                      formAction={rejectMembershipApplication}
                    >
                      Reject application
                    </button>
                  </div>
                </form>
              </div>
            </article>
          ))
        )}
      </section>

      <InvitationsPanel invitations={activeInvitationRows} />

      <WorkplaceRequestsPanel requests={pendingWorkplaceRequests} />

      <section
        id="decisions"
        className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.92fr)]"
      >
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
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {decision.email}
                  </p>
                  {decision.review_note ? (
                    <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                      {decision.review_note}
                    </p>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </article>

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
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      {member?.email || request.request_type}
                    </p>
                    {request.review_note ? (
                      <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                        {request.review_note}
                      </p>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </article>

        <div className="grid gap-4" id="certificates">
          <article className="route-tile">
            <h3>Certificates</h3>
            <p>
              The public verification path is live. The next operator pass still
              needs import run history, parity evidence, and recovery tooling in
              this workspace.
            </p>
          </article>
          <article className="route-tile" id="reconcile">
            <h3>Reconcile and CSV onboarding</h3>
            <p>
              The old onboarding scripts are still waiting to be ported into
              deterministic dry-run and apply flows with archived reports.
            </p>
          </article>
        </div>
      </section>
    </div>
  );
}
