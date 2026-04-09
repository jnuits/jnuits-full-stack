import { cookies } from "next/headers";
import {
  createInvitationBatchAction,
  createMembershipCycleAction,
  enrollMemberInCycleAction,
  issueInvitationsFromBatchAction,
  syncInvitationBatchMetricsAction,
  updateCycleMemberStateAction,
  updateInvitationBatchStatusAction,
  updateMembershipCycleStatusAction,
} from "@/app/admin/membership/actions";
import { ADMIN_FLASH_COOKIE_NAME, parseAdminFlash } from "@/lib/admin/flash";
import { createAdminClient } from "@/lib/supabase/admin";

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

export default async function AdminMembershipPage() {
  const admin = createAdminClient();
  const cookieStore = await cookies();
  const flash = parseAdminFlash(cookieStore.get(ADMIN_FLASH_COOKIE_NAME)?.value);

  const [cyclesResult, cycleMembersResult, batchesResult] = await Promise.all([
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
  ]);

  const cycles = (cyclesResult.data || []) as MembershipCycleRecord[];
  const cycleMembers = (cycleMembersResult.data || []) as CycleMemberRecord[];
  const batches = (batchesResult.data || []) as InvitationBatchRecord[];
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
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-[var(--muted)]">
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
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--muted)]">
            Cycles
          </p>
          <p className="metric-card__value mt-3">{cycles.length}</p>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            Draft, active, closed, and archived membership windows.
          </p>
        </article>
        <article className="metric-card">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--muted)]">
            Active cycle
          </p>
          <p className="mt-3 text-2xl font-semibold tracking-[-0.03em]">
            {activeCycle?.code || "None"}
          </p>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            {activeCycle?.title || "Set one cycle active for renewal processing."}
          </p>
        </article>
        <article className="metric-card">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--muted)]">
            Pending renewals
          </p>
          <p className="metric-card__value mt-3">{pendingRenewals}</p>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            Members waiting for renewal decision or invitation outreach.
          </p>
        </article>
        <article className="metric-card">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--muted)]">
            Active cycle members
          </p>
          <p className="metric-card__value mt-3">{activeMembersInCycles}</p>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            Members currently active across loaded cycle rows.
          </p>
        </article>
        <article className="metric-card">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--muted)]">
            Batch claims
          </p>
          <p className="mt-3 text-2xl font-semibold tracking-[-0.03em]">
            {totalClaimedInvitations}/{totalIssuedInvitations}
          </p>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            Claimed versus issued invitations across active reconciliation batches.
          </p>
        </article>
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
              <input name="memberJnuitsId" placeholder="JNUITS-2026001" required />
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
                    <p className="mt-2 text-sm text-[var(--muted)]">
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

              return (
                <article key={row.id} className="route-tile">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3>{member?.full_name || "Member record"}</h3>
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        {member?.jnuits_id || "Unknown ID"} • Cycle row {row.cycle_id}
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
                    <p className="mt-2 text-sm text-[var(--muted)]">
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
