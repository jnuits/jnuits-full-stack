import { createAdminClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";
import { ADMIN_FLASH_COOKIE_NAME, parseAdminFlash } from "@/lib/admin/flash";
import {
  approveWorkplaceUpdateRequest,
  rejectWorkplaceUpdateRequest,
} from "@/app/admin/actions";
import { formatMembershipIdForDisplay } from "@/lib/members/jnuits-id";
import { getWorkplacePayloadEntries } from "@/lib/members/workplace-payload";
import { EmptyState } from "@/components/ui/empty-state";
import { CheckCircle, Clock, XCircle } from "lucide-react";

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

function resolveMember(req: WorkplaceRequestRecord) {
  if (Array.isArray(req.members)) return req.members[0] || null;
  return req.members || null;
}

export const metadata = { title: "Workplace Requests — Admin | JnUITS" };

export default async function WorkplacePage() {
  const admin = createAdminClient();
  const cookieStore = await cookies();
  const flash = parseAdminFlash(cookieStore.get(ADMIN_FLASH_COOKIE_NAME)?.value);

  const [pendingResult, recentResult, countResult] = await Promise.all([
    admin
      .from("profile_update_requests")
      .select(
        "id, member_id, payload, request_type, requested_at, review_note, reviewed_at, status, members(full_name, jnuits_id, email, member_type, current_organization, designation, work_location, professional_visibility)"
      )
      .eq("request_type", "workplace_update")
      .eq("status", "pending")
      .order("requested_at", { ascending: true })
      .limit(20),
    admin
      .from("profile_update_requests")
      .select("id, member_id, request_type, requested_at, reviewed_at, status, members(full_name, jnuits_id)")
      .eq("request_type", "workplace_update")
      .neq("status", "pending")
      .order("reviewed_at", { ascending: false })
      .limit(10),
    admin
      .from("profile_update_requests")
      .select("*", { count: "exact", head: true })
      .eq("request_type", "workplace_update")
      .eq("status", "pending"),
  ]);

  const pending = (pendingResult.data || []) as WorkplaceRequestRecord[];
  const recent = (recentResult.data || []) as WorkplaceRequestRecord[];
  const pendingCount = countResult.count || 0;

  return (
    <div className="grid gap-8">
      <div className="admin-page-header">
        <div>
          <p className="admin-page-header__breadcrumb">Admin / Membership</p>
          <h1 className="admin-page-header__title">Workplace Requests</h1>
          <p className="admin-page-header__desc">
            Review pending alumni workplace change requests side-by-side with their current member state. Approving updates the member record and writes audit evidence.
          </p>
        </div>
        {pendingCount > 0 && (
          <span className="abadge abadge--pending">
            <Clock size={10} /> {pendingCount} pending
          </span>
        )}
      </div>

      {flash && (
        <section className="flash-panel" data-tone={flash.tone}>
          <p className="admin-section-label">Operator feedback</p>
          <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold">{flash.title}</h2>
          <p className="mt-1 text-sm leading-7">{flash.message}</p>
        </section>
      )}

      {/* Metrics */}
      <div className="admin-metric-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(11rem, 1fr))" }}>
        <div className="admin-metric-card" data-tone="warning">
          <div className="admin-metric-card__icon"><Clock size={16} /></div>
          <p className="admin-metric-card__label">Pending</p>
          <p className="admin-metric-card__value">{pendingCount}</p>
          <p className="admin-metric-card__sub">Await review</p>
        </div>
        <div className="admin-metric-card" data-tone="success">
          <div className="admin-metric-card__icon"><CheckCircle size={16} /></div>
          <p className="admin-metric-card__label">Approved</p>
          <p className="admin-metric-card__value">{recent.filter((r) => r.status === "approved").length}</p>
          <p className="admin-metric-card__sub">Recent</p>
        </div>
        <div className="admin-metric-card" data-tone="danger">
          <div className="admin-metric-card__icon"><XCircle size={16} /></div>
          <p className="admin-metric-card__label">Rejected</p>
          <p className="admin-metric-card__value">{recent.filter((r) => r.status === "rejected").length}</p>
          <p className="admin-metric-card__sub">Recent</p>
        </div>
      </div>

      {/* Pending Queue */}
      <section>
        <p className="admin-section-label">Pending workplace requests</p>

        {pending.length === 0 ? (
          <EmptyState
            title="No pending workplace requests"
            description="When alumni submit workplace updates from the portal, they will appear here for approval."
          />
        ) : (
          <div className="grid gap-4">
            {pending.map((req) => {
              const member = resolveMember(req);
              const payloadEntries = getWorkplacePayloadEntries(req.payload);
              const displayJnuitsId =
                formatMembershipIdForDisplay(member?.jnuits_id) || req.member_id;

              return (
                <div key={req.id} className="admin-review-card admin-review-card--pending">
                  <div className="admin-review-card__header">
                    <div>
                      <div className="admin-review-card__chips">
                        <span className="abadge abadge--pending">Pending review</span>
                        <span className="detail-chip">
                          {new Date(req.requested_at).toLocaleDateString("en-BD")}
                        </span>
                        {member?.member_type && (
                          <span className="detail-chip">{member.member_type}</span>
                        )}
                      </div>
                      <p className="admin-review-card__name mt-1">{member?.full_name || "Linked member"}</p>
                      <p className="admin-review-card__id">{displayJnuitsId}</p>
                    </div>
                    {member?.email && (
                      <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{member.email}</p>
                    )}
                  </div>

                  <div className="admin-review-card__diff">
                    <div className="admin-diff-box">
                      <p className="admin-diff-box__label">Requested changes</p>
                      {payloadEntries.map((entry) => (
                        <div key={entry.key} className="admin-diff-box__item">
                          <span className="admin-diff-box__key">{entry.label}</span>
                          <span>{entry.value}</span>
                        </div>
                      ))}
                    </div>
                    <div className="admin-diff-box">
                      <p className="admin-diff-box__label">Current member state</p>
                      <div className="admin-diff-box__item">
                        <span className="admin-diff-box__key">Organization</span>
                        <span>{member?.current_organization || "Not set"}</span>
                      </div>
                      <div className="admin-diff-box__item">
                        <span className="admin-diff-box__key">Designation</span>
                        <span>{member?.designation || "Not set"}</span>
                      </div>
                      <div className="admin-diff-box__item">
                        <span className="admin-diff-box__key">Work location</span>
                        <span>{member?.work_location || "Not set"}</span>
                      </div>
                      <div className="admin-diff-box__item">
                        <span className="admin-diff-box__key">Visibility</span>
                        <span>{member?.professional_visibility || "Not set"}</span>
                      </div>
                    </div>
                  </div>

                  <form className="admin-review-card__actions">
                    <input name="requestId" type="hidden" value={req.id} />
                    <label className="input-label" htmlFor={`wp-note-${req.id}`}>
                      Review note
                      <textarea
                        id={`wp-note-${req.id}`}
                        name="reviewNote"
                        placeholder="Explain the decision or any follow-up required"
                        rows={3}
                      />
                    </label>
                    <div className="flex flex-wrap gap-3">
                      <button className="admin-btn admin-btn--success" formAction={approveWorkplaceUpdateRequest}>
                        <CheckCircle size={14} /> Approve workplace update
                      </button>
                      <button className="admin-btn admin-btn--danger" formAction={rejectWorkplaceUpdateRequest}>
                        <XCircle size={14} /> Reject request
                      </button>
                    </div>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent Decisions */}
      {recent.length > 0 && (
        <section>
          <p className="admin-section-label">Recent decisions</p>
          <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--line)" }}>
            <table className="admin-queue-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>JnUITS ID</th>
                  <th>Status</th>
                  <th>Reviewed</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((req) => {
                  const m = Array.isArray(req.members) ? req.members[0] : req.members;
                  const displayJnuitsId = formatMembershipIdForDisplay(m?.jnuits_id);
                  return (
                    <tr key={req.id}>
                      <td className="font-semibold text-sm">{m?.full_name || "—"}</td>
                      <td className="text-xs font-mono" style={{ color: "var(--brand-blue)" }}>{displayJnuitsId || "—"}</td>
                      <td><span className={`abadge abadge--${req.status}`}>{req.status}</span></td>
                      <td className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                        {req.reviewed_at ? new Date(req.reviewed_at).toLocaleDateString("en-BD") : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
