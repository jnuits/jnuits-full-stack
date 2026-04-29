import { cookies } from "next/headers";
import {
  createInvitationBatchAction,
  createMembershipCycleAction,
  enrollMemberInCycleAction,
  issueInvitationsFromBatchAction,
  reviewMemberAccountRequestAction,
  syncInvitationBatchMetricsAction,
  updateMemberLifecycleAction,
  updateMemberPortalRoleAction,
  updateCycleMemberStateAction,
  updateInvitationBatchStatusAction,
  updateMembershipCycleStatusAction,
} from "@/app/admin/membership/actions";
import { AvatarUploadField } from "@/components/profile/avatar-upload-field";
import { ADMIN_FLASH_COOKIE_NAME, parseAdminFlash } from "@/lib/admin/flash";
import { formatMembershipIdForDisplay } from "@/lib/members/jnuits-id";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";

type MembershipCycleRecord = {
  id: string;
  code: string;
  title: string;
  starts_on: string;
  ends_on: string | null;
  renewal_open_on: string | null;
  renewal_close_on: string | null;
  status: string;
  created_at: string;
};

type CycleMemberRecord = {
  id: string;
  cycle_id: string;
  member_id: string;
  state: string;
  enrolled_at: string;
  renewed_at: string | null;
  expires_on: string | null;
  note: string | null;
  members?:
    | {
        id?: string;
        full_name?: string | null;
        jnuits_id?: string | null;
        is_profile_claimed?: boolean | null;
      }
    | {
        id?: string;
        full_name?: string | null;
        jnuits_id?: string | null;
        is_profile_claimed?: boolean | null;
      }[]
    | null;
};

type InvitationBatchRecord = {
  id: string;
  cycle_id: string | null;
  label: string;
  source: string;
  status: string;
  issued_count: number;
  claimed_count: number;
  expires_at: string | null;
  created_at: string;
};

type ManagedMemberRecord = {
  id: string;
  avatar_secure_url: string | null;
  email: string | null;
  full_name: string;
  is_profile_claimed: boolean | null;
  jnuits_id: string;
  lifecycle_status: string | null;
  member_type: string | null;
  portal_access_status: string | null;
  updated_at: string;
  user_id: string | null;
};

type PortalRoleOptionRecord = {
  code: "alumni" | "alumni_ambassador" | "executive" | "member";
  display_name: string;
};

type PortalRoleGrantRecord = {
  user_id: string;
  rbac_platform_roles:
    | { code?: string | null; display_name?: string | null }
    | { code?: string | null; display_name?: string | null }[]
    | null;
};

type AccountRequestRecord = {
  id: string;
  member_id: string;
  request_type: string;
  status: string;
  requested_at: string;
  review_note: string | null;
  members?:
    | {
        full_name?: string | null;
        jnuits_id?: string | null;
      }
    | {
        full_name?: string | null;
        jnuits_id?: string | null;
      }[]
    | null;
};

function resolveMember(
  relation: CycleMemberRecord["members"]
):
  | {
      id?: string;
      full_name?: string | null;
      jnuits_id?: string | null;
      is_profile_claimed?: boolean | null;
    }
  | null {
  if (!relation) {
    return null;
  }

  if (Array.isArray(relation)) {
    return relation[0] || null;
  }

  return relation;
}

function resolveAccountRequestMember(relation: AccountRequestRecord["members"]) {
  if (!relation) {
    return null;
  }

  if (Array.isArray(relation)) {
    return relation[0] || null;
  }

  return relation;
}

function resolvePortalRoleRelation(
  relation: PortalRoleGrantRecord["rbac_platform_roles"]
) {
  if (!relation) {
    return null;
  }

  if (Array.isArray(relation)) {
    return relation[0] || null;
  }

  return relation;
}

function normalizeCycleStatus(status: string) {
  if (status === "active") {
    return "active";
  }
  if (status === "closed") {
    return "closed";
  }
  if (status === "archived") {
    return "archived";
  }
  return "draft";
}

function normalizeBatchStatus(status: string) {
  if (status === "active") {
    return "active";
  }
  if (status === "closed") {
    return "closed";
  }
  if (status === "archived") {
    return "archived";
  }
  return "draft";
}

function displayMembershipId(
  value: null | string | undefined,
  fallback = "Unknown ID"
) {
  return formatMembershipIdForDisplay(value) || fallback;
}

export default async function AdminMembershipPage() {
  const admin = createAdminClient();
  const flexibleAdmin = asFlexibleClient(admin);
  const cookieStore = await cookies();
  const flash = parseAdminFlash(cookieStore.get(ADMIN_FLASH_COOKIE_NAME)?.value);

  const [
    cyclesResult,
    cycleMembersResult,
    batchesResult,
    managedMembersResult,
    accountRequestsResult,
  ] = await Promise.all([
    admin
      .from("membership_cycles")
      .select(
        "id, code, title, starts_on, ends_on, renewal_open_on, renewal_close_on, status, created_at"
      )
      .order("starts_on", { ascending: false })
      .limit(20),
    admin
      .from("membership_cycle_memberships")
      .select(
        "id, cycle_id, member_id, state, enrolled_at, renewed_at, expires_on, note, members(id, full_name, jnuits_id, is_profile_claimed)"
      )
      .in("state", ["pending_renewal", "active"])
      .order("updated_at", { ascending: true })
      .limit(60),
    admin
      .from("invitation_batches")
      .select(
        "id, cycle_id, label, source, status, issued_count, claimed_count, expires_at, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(20),
    flexibleAdmin
      .from("members" as string)
      .select(
        "id, user_id, jnuits_id, full_name, email, member_type, is_profile_claimed, lifecycle_status, portal_access_status, avatar_secure_url, updated_at"
      )
      .not("jnuits_id", "ilike", "JNUITS-ADMIN-%")
      .order("updated_at", { ascending: false })
      .limit(40),
    flexibleAdmin
      .from("profile_update_requests" as string)
      .select(
        "id, member_id, request_type, status, requested_at, review_note, members(full_name, jnuits_id)"
      )
      .in("request_type", ["alumni_conversion", "account_deletion"])
      .eq("status", "pending")
      .order("requested_at", { ascending: true })
      .limit(30),
  ]);

  const cycles = (cyclesResult.data || []) as MembershipCycleRecord[];
  const cycleMembers = (cycleMembersResult.data || []) as CycleMemberRecord[];
  const batches = (batchesResult.data || []) as InvitationBatchRecord[];
  const managedMembers = (managedMembersResult.data || []) as ManagedMemberRecord[];
  const accountRequests = (accountRequestsResult.data || []) as AccountRequestRecord[];
  const memberUserIds = managedMembers
    .map((member) => member.user_id)
    .filter((value): value is string => Boolean(value));
  const [portalRolesResult, activePortalRoleGrantsResult] = await Promise.all([
    flexibleAdmin
      .from("rbac_platform_roles" as string)
      .select("code, display_name")
      .eq("scope", "portal")
      .eq("is_assignable", true)
      .order("rank", { ascending: true }),
    memberUserIds.length > 0
      ? flexibleAdmin
          .from("rbac_user_platform_roles" as string)
          .select("user_id, rbac_platform_roles(code, display_name)")
          .eq("scope", "portal")
          .is("revoked_at", null)
          .in("user_id", memberUserIds)
      : Promise.resolve({ data: [] }),
  ]);
  const portalRoleOptions = (portalRolesResult.data || []) as PortalRoleOptionRecord[];
  const activePortalRoleByUserId = new Map(
    ((activePortalRoleGrantsResult.data || []) as PortalRoleGrantRecord[])
      .map((grant) => {
        const role = resolvePortalRoleRelation(grant.rbac_platform_roles);
        return [grant.user_id, role?.code || null] as const;
      })
      .filter((entry): entry is readonly [string, string] => Boolean(entry[1]))
  );
  const activeCycle = cycles.find((cycle) => cycle.status === "active") || null;
  const pendingRenewals = cycleMembers.filter(
    (row) => row.state === "pending_renewal"
  ).length;
  const activeMembersInCycles = cycleMembers.filter(
    (row) => row.state === "active"
  ).length;
  const totalIssuedInvitations = batches.reduce(
    (sum, batch) => sum + (batch.issued_count || 0),
    0
  );
  const totalClaimedInvitations = batches.reduce(
    (sum, batch) => sum + (batch.claimed_count || 0),
    0
  );

  return (
    <div className="grid gap-8">
      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="admin-page-header">
        <div>
          <p className="admin-page-header__breadcrumb">Admin / Membership</p>
          <h1 className="admin-page-header__title">Membership DB</h1>
          <p className="admin-page-header__desc">
            Cycle lifecycle management, renewal queue, member-cycle state transitions, and invitation batch controls.
          </p>
        </div>
        {activeCycle && (
          <span className="status-pill">{activeCycle.code} active</span>
        )}
      </div>

      {flash ? (
        <section className="flash-panel" data-tone={flash.tone}>
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
            Operator feedback
          </p>
          <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-[-0.03em]">
            {flash.title}
          </h2>
          <p className="section-copy mt-2">{flash.message}</p>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <article className="metric-card">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
            Cycles
          </p>
          <p className="metric-card__value mt-3">{cycles.length}</p>
          <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">
            Draft, active, closed, and archived membership windows.
          </p>
        </article>
        <article className="metric-card">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
            Active cycle
          </p>
          <p className="mt-3 text-2xl font-semibold tracking-[-0.03em]">
            {activeCycle?.code || "None"}
          </p>
          <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">
            {activeCycle?.title || "Set one cycle active for renewal processing."}
          </p>
        </article>
        <article className="metric-card">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
            Pending renewals
          </p>
          <p className="metric-card__value mt-3">{pendingRenewals}</p>
          <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">
            Members waiting for renewal decision or invitation outreach.
          </p>
        </article>
        <article className="metric-card">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
            Active cycle members
          </p>
          <p className="metric-card__value mt-3">{activeMembersInCycles}</p>
          <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">
            Members currently active across loaded cycle rows.
          </p>
        </article>
        <article className="metric-card">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
            Batch claims
          </p>
          <p className="mt-3 text-2xl font-semibold tracking-[-0.03em]">
            {totalClaimedInvitations}/{totalIssuedInvitations}
          </p>
          <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">
            Claimed versus issued invitations across active reconciliation batches.
          </p>
        </article>
      </section>

      <section className="section-band">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="eyebrow">Member operations</span>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.7rem)] leading-[0.96] tracking-[-0.04em]">
              Lifecycle, access, and portal roles
            </h2>
          </div>
          <span className="status-pill">{managedMembers.length} loaded</span>
        </div>

        <div className="mt-6 grid gap-4">
          {managedMembers.length === 0 ? (
            <div className="empty-state">No member records found.</div>
          ) : (
            managedMembers.map((member) => {
              const currentPortalRole = member.user_id
                ? activePortalRoleByUserId.get(member.user_id) || "member"
                : "member";
              const displayJnuitsId = displayMembershipId(member.jnuits_id);

              return (
                <article key={member.id} className="application-card">
                  <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.8fr)]">
                    <div>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-wrap items-start gap-3">
                          <AvatarUploadField
                            canUpload
                            compact
                            currentUrl={member.avatar_secure_url}
                            displayName={member.full_name}
                            targetId={member.id}
                            targetType="member"
                          />
                          <div className="min-w-0">
                            <h3 className="font-[family-name:var(--font-heading)] text-[1.6rem] leading-[0.98] tracking-[-0.04em]">
                              {member.full_name}
                            </h3>
                            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                              {displayJnuitsId} • {member.email || "No email"}
                            </p>
                          </div>
                        </div>
                        <span className="status-pill">
                          {member.portal_access_status || "active"}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="detail-chip">
                          Lifecycle {member.lifecycle_status || "current"}
                        </span>
                        <span className="detail-chip">
                          Type {member.member_type || "current"}
                        </span>
                        <span className="detail-chip">
                          {member.is_profile_claimed ? "Claimed" : "Unclaimed"}
                        </span>
                        <span className="detail-chip">
                          Portal role {currentPortalRole}
                        </span>
                      </div>
                    </div>

                    <div className="grid gap-3">
                      <form action={updateMemberLifecycleAction} className="grid gap-2">
                        <input name="memberId" type="hidden" value={member.id} />
                        <div className="grid gap-2 sm:grid-cols-2">
                          <label className="input-label">
                            Lifecycle
                            <select
                              defaultValue={member.lifecycle_status || "current"}
                              name="nextLifecycleStatus"
                            >
                              <option value="current">Current</option>
                              <option value="former">Former</option>
                              <option value="alumni">Alumni</option>
                              <option value="deleted">Deleted</option>
                            </select>
                          </label>
                          <label className="input-label">
                            Portal access
                            <select
                              defaultValue={member.portal_access_status || "active"}
                              name="nextPortalAccessStatus"
                            >
                              <option value="active">Active</option>
                              <option value="frozen">Frozen</option>
                              <option value="suspended">Suspended</option>
                              <option value="deletion_requested">Deletion requested</option>
                              <option value="deactivated">Deactivated</option>
                            </select>
                          </label>
                        </div>
                        <label className="input-label">
                          Lifecycle note
                          <input name="note" placeholder="Reason for lifecycle change" />
                        </label>
                        <button className="secondary-button" type="submit">
                          Update lifecycle
                        </button>
                      </form>

                      <form action={updateMemberPortalRoleAction} className="grid gap-2">
                        <input name="memberId" type="hidden" value={member.id} />
                        <label className="input-label">
                          Portal role
                          <select
                            defaultValue={currentPortalRole}
                            disabled={!member.user_id}
                            name="nextPortalRole"
                          >
                            {portalRoleOptions.map((role) => (
                              <option key={role.code} value={role.code}>
                                {role.display_name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="input-label">
                          Role note
                          <input
                            disabled={!member.user_id}
                            name="note"
                            placeholder="Reason for role change"
                          />
                        </label>
                        <button
                          className="secondary-button"
                          disabled={!member.user_id}
                          type="submit"
                        >
                          Update portal role
                        </button>
                      </form>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      <section className="section-band">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="eyebrow">Account request reviews</span>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.7rem)] leading-[0.96] tracking-[-0.04em]">
              Alumni conversion and deletion queue
            </h2>
          </div>
          <span className="status-pill">{accountRequests.length} pending</span>
        </div>

        <div className="mt-6 grid gap-4">
          {accountRequests.length === 0 ? (
            <div className="empty-state">No account requests pending review.</div>
          ) : (
            accountRequests.map((request) => {
              const member = resolveAccountRequestMember(request.members);
              const displayJnuitsId = member?.jnuits_id
                ? displayMembershipId(member.jnuits_id)
                : request.member_id;

              return (
                <article key={request.id} className="route-tile">
                  <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.7fr)]">
                    <div>
                      <h3>{request.request_type.replaceAll("_", " ")}</h3>
                      <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                        {member?.full_name || "Member record"} • {displayJnuitsId}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="status-pill">{request.status}</span>
                        <span className="detail-chip">
                          Requested {request.requested_at.slice(0, 10)}
                        </span>
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <form action={reviewMemberAccountRequestAction} className="grid gap-2">
                        <input name="requestId" type="hidden" value={request.id} />
                        <input name="decision" type="hidden" value="approved" />
                        <label className="input-label">
                          Review note
                          <input name="reviewNote" placeholder="Approval note" />
                        </label>
                        <button className="primary-button" type="submit">
                          Approve request
                        </button>
                      </form>
                      <form action={reviewMemberAccountRequestAction} className="grid gap-2">
                        <input name="requestId" type="hidden" value={request.id} />
                        <input name="decision" type="hidden" value="rejected" />
                        <label className="input-label">
                          Rejection note
                          <input name="reviewNote" placeholder="Reason for rejection" />
                        </label>
                        <button className="secondary-button" type="submit">
                          Reject request
                        </button>
                      </form>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)]">
        <form action={createMembershipCycleAction} className="section-band grid gap-4">
          <div>
            <span className="eyebrow">Cycle management</span>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.6rem)] leading-[0.96] tracking-[-0.04em]">
              Create membership cycle windows
            </h2>
          </div>
          <div className="portal-form-grid">
            <label className="input-label">
              Cycle code
              <input name="code" placeholder="cycle-2026" required />
            </label>
            <label className="input-label">
              Status
              <select defaultValue="draft" name="status">
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label className="input-label sm:col-span-2">
              Cycle title
              <input name="title" placeholder="Membership Cycle 2026" required />
            </label>
            <label className="input-label">
              Starts on
              <input name="startsOn" type="date" required />
            </label>
            <label className="input-label">
              Ends on
              <input name="endsOn" type="date" />
            </label>
            <label className="input-label">
              Renewal opens
              <input name="renewalOpenOn" type="date" />
            </label>
            <label className="input-label">
              Renewal closes
              <input name="renewalCloseOn" type="date" />
            </label>
          </div>
          <button className="primary-button" type="submit">
            Save cycle
          </button>
        </form>

        <form action={enrollMemberInCycleAction} className="section-band grid gap-4">
          <div>
            <span className="eyebrow">Member-cycle state</span>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.6rem)] leading-[0.96] tracking-[-0.04em]">
              Enroll member into cycle
            </h2>
          </div>
          <div className="portal-form-grid">
            <label className="input-label">
              Cycle
              <select name="cycleId" required>
                <option value="">Select cycle</option>
                {cycles.map((cycle) => (
                  <option key={cycle.id} value={cycle.id}>
                    {cycle.code} • {cycle.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="input-label">
              State
              <select defaultValue="pending_renewal" name="memberState">
                <option value="pending_renewal">Pending renewal</option>
                <option value="active">Active</option>
                <option value="renewed">Renewed</option>
                <option value="expired">Expired</option>
                <option value="lapsed">Lapsed</option>
              </select>
            </label>
            <label className="input-label sm:col-span-2">
              Member JnUITS ID
              <input name="memberJnuitsId" placeholder="JnUITS-2026001" required />
            </label>
            <label className="input-label">
              Expires on
              <input name="expiresOn" type="date" />
            </label>
            <label className="input-label">
              Note
              <input name="note" placeholder="Cycle enrollment note" />
            </label>
          </div>
          <button className="primary-button" type="submit">
            Upsert cycle member
          </button>
        </form>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)]">
        <form action={createInvitationBatchAction} className="section-band grid gap-4">
          <div>
            <span className="eyebrow">Invitation batches</span>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.6rem)] leading-[0.96] tracking-[-0.04em]">
              Create invitation batch
            </h2>
          </div>
          <div className="portal-form-grid">
            <label className="input-label sm:col-span-2">
              Label
              <input name="label" placeholder="Renewal outreach batch A" required />
            </label>
            <label className="input-label">
              Source
              <select defaultValue="renewal" name="source">
                <option value="manual">Manual</option>
                <option value="csv_onboarding">CSV onboarding</option>
                <option value="reconciliation">Reconciliation</option>
                <option value="renewal">Renewal</option>
              </select>
            </label>
            <label className="input-label">
              Status
              <select defaultValue="draft" name="status">
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label className="input-label">
              Linked cycle
              <select name="cycleId">
                <option value="">No cycle link</option>
                {cycles.map((cycle) => (
                  <option key={cycle.id} value={cycle.id}>
                    {cycle.code}
                  </option>
                ))}
              </select>
            </label>
            <label className="input-label">
              Expires at
              <input name="expiresAt" type="datetime-local" />
            </label>
          </div>
          <button className="primary-button" type="submit">
            Save batch
          </button>
        </form>

        <form action={issueInvitationsFromBatchAction} className="section-band grid gap-4">
          <div>
            <span className="eyebrow">Renewal queue issue</span>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.6rem)] leading-[0.96] tracking-[-0.04em]">
              Issue invitations from cycle queue
            </h2>
          </div>
          <div className="portal-form-grid">
            <label className="input-label sm:col-span-2">
              Batch
              <select name="batchId" required>
                <option value="">Select batch</option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.label} ({batch.status})
                  </option>
                ))}
              </select>
            </label>
            <label className="input-label">
              Expiry days
              <input defaultValue={14} min={1} name="invitationExpiresInDays" type="number" />
            </label>
            <label className="input-label">
              Max uses
              <input defaultValue={1} min={1} name="maxUses" type="number" />
            </label>
            <label className="input-label sm:col-span-2">
              Pending renewal only
              <select defaultValue="true" name="onlyPendingRenewal">
                <option value="true">Yes, pending renewal only</option>
                <option value="false">Include active and renewed rows</option>
              </select>
            </label>
          </div>
          <button className="primary-button" type="submit">
            Issue invitations
          </button>
        </form>
      </section>

      <section className="section-band">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="eyebrow">Cycle registry</span>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.7rem)] leading-[0.96] tracking-[-0.04em]">
              Membership cycles and status transitions
            </h2>
          </div>
        </div>
        <div className="mt-6 grid gap-4">
          {cycles.length === 0 ? (
            <div className="empty-state">No cycles found yet.</div>
          ) : (
            cycles.map((cycle) => (
              <article key={cycle.id} className="application-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-[family-name:var(--font-heading)] text-[1.8rem] leading-[0.98] tracking-[-0.04em]">
                      {cycle.title}
                    </h3>
                    <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                      {cycle.code} • {cycle.starts_on}
                      {cycle.ends_on ? ` → ${cycle.ends_on}` : ""}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="detail-chip">Status: {cycle.status}</span>
                      {cycle.renewal_open_on ? (
                        <span className="detail-chip">
                          Renewal opens {cycle.renewal_open_on}
                        </span>
                      ) : null}
                      {cycle.renewal_close_on ? (
                        <span className="detail-chip">
                          Renewal closes {cycle.renewal_close_on}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <form action={updateMembershipCycleStatusAction} className="grid gap-2">
                    <input type="hidden" name="cycleId" value={cycle.id} />
                    <label className="input-label">
                      Update status
                      <select name="nextStatus" defaultValue={normalizeCycleStatus(cycle.status)}>
                        <option value="draft">Draft</option>
                        <option value="active">Active</option>
                        <option value="closed">Closed</option>
                        <option value="archived">Archived</option>
                      </select>
                    </label>
                    <button className="secondary-button" type="submit">
                      Apply status
                    </button>
                  </form>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="section-band">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="eyebrow">Renewal queue</span>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.7rem)] leading-[0.96] tracking-[-0.04em]">
              Cycle member state queue
            </h2>
          </div>
        </div>
        <div className="mt-6 grid gap-4">
          {cycleMembers.length === 0 ? (
            <div className="empty-state">No pending renewal queue rows found.</div>
          ) : (
            cycleMembers.map((row) => {
              const member = resolveMember(row.members);
              const displayJnuitsId = displayMembershipId(member?.jnuits_id);

              return (
                <article key={row.id} className="route-tile">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3>{member?.full_name || "Member record"}</h3>
                      <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                        {displayJnuitsId} • Cycle row {row.cycle_id}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="status-pill">{row.state}</span>
                        {row.expires_on ? (
                          <span className="detail-chip">Expires {row.expires_on}</span>
                        ) : null}
                        {member?.is_profile_claimed ? (
                          <span className="detail-chip">Claimed</span>
                        ) : (
                          <span className="detail-chip">Not claimed</span>
                        )}
                      </div>
                    </div>

                    <form action={updateCycleMemberStateAction} className="grid gap-2 sm:min-w-[280px]">
                      <input type="hidden" name="rowId" value={row.id} />
                      <label className="input-label">
                        Next state
                        <select name="nextState" defaultValue={row.state}>
                          <option value="pending_renewal">Pending renewal</option>
                          <option value="active">Active</option>
                          <option value="renewed">Renewed</option>
                          <option value="expired">Expired</option>
                          <option value="lapsed">Lapsed</option>
                        </select>
                      </label>
                      <label className="input-label">
                        Note
                        <input name="note" defaultValue={row.note || ""} />
                      </label>
                      <button className="secondary-button" type="submit">
                        Update member state
                      </button>
                    </form>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      <section className="section-band">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="eyebrow">Invitation batches</span>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,2.7rem)] leading-[0.96] tracking-[-0.04em]">
              Batch registry and sync controls
            </h2>
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          {batches.length === 0 ? (
            <div className="empty-state">No invitation batches found yet.</div>
          ) : (
            batches.map((batch) => (
              <article key={batch.id} className="application-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-[family-name:var(--font-heading)] text-[1.6rem] leading-[0.98] tracking-[-0.04em]">
                      {batch.label}
                    </h3>
                    <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                      Source {batch.source} • status {batch.status}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="detail-chip">Issued {batch.issued_count}</span>
                      <span className="detail-chip">Claimed {batch.claimed_count}</span>
                      {batch.cycle_id ? (
                        <span className="detail-chip">Cycle linked</span>
                      ) : (
                        <span className="detail-chip">No cycle link</span>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-2 sm:min-w-[290px]">
                    <form action={updateInvitationBatchStatusAction} className="grid gap-2">
                      <input type="hidden" name="batchId" value={batch.id} />
                      <label className="input-label">
                        Update status
                        <select
                          name="nextStatus"
                          defaultValue={normalizeBatchStatus(batch.status)}
                        >
                          <option value="draft">Draft</option>
                          <option value="active">Active</option>
                          <option value="closed">Closed</option>
                          <option value="archived">Archived</option>
                        </select>
                      </label>
                      <button className="secondary-button" type="submit">
                        Apply batch status
                      </button>
                    </form>

                    <form action={syncInvitationBatchMetricsAction}>
                      <input type="hidden" name="batchId" value={batch.id} />
                      <button className="ghost-button w-full" type="submit">
                        Sync issued/claimed metrics
                      </button>
                    </form>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
