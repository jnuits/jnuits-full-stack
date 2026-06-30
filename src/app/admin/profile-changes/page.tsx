import { createAdminClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";
import { ADMIN_FLASH_COOKIE_NAME, parseAdminFlash } from "@/lib/admin/flash";
import { getActiveDepartmentOptions } from "@/lib/departments.server";
import {
  approveProfileChangeRequest,
  rejectProfileChangeRequest,
} from "@/app/admin/membership/moderation-actions";
import { EmptyState } from "@/components/ui/empty-state";
import { User, CheckCircle, XCircle, Clock } from "lucide-react";

type ProfileChangeRequestRecord = {
  id: string;
  member_id: string;
  payload: unknown;
  request_type: string;
  requested_at: string;
  review_note: string | null;
  reviewed_at: string | null;
  status: string;
  members?:
    | { department_code?: string | null; email?: string | null; facebook_url?: string | null; full_name?: string | null; jnuits_id?: string | null; phone?: string | null; linkedin_url?: string | null; website_url?: string | null }
    | { department_code?: string | null; email?: string | null; facebook_url?: string | null; full_name?: string | null; jnuits_id?: string | null; phone?: string | null; linkedin_url?: string | null; website_url?: string | null }[]
    | null;
};

function resolveMember<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

function parseProfilePayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      fullName: null,
      departmentCode: null,
      facebookUrl: null,
      linkedinUrl: null,
      newEmail: null,
      newJnuitsId: null,
      phone: null,
      websiteUrl: null,
    };
  }
  const r = payload as Record<string, unknown>;
  return {
    fullName: typeof r.fullName === "string" && r.fullName.trim() ? r.fullName.trim() : null,
    departmentCode: typeof r.departmentCode === "string" && r.departmentCode.trim() ? r.departmentCode.trim().toLowerCase() : null,
    facebookUrl: typeof r.facebookUrl === "string" && r.facebookUrl.trim() ? r.facebookUrl.trim() : null,
    linkedinUrl: typeof r.linkedinUrl === "string" && r.linkedinUrl.trim() ? r.linkedinUrl.trim() : null,
    newEmail: typeof r.newEmail === "string" && r.newEmail.trim() ? r.newEmail.trim() : null,
    newJnuitsId: typeof r.newJnuitsId === "string" && r.newJnuitsId.trim() ? r.newJnuitsId.trim() : null,
    phone: typeof r.phone === "string" && r.phone.trim() ? r.phone.trim() : null,
    websiteUrl: typeof r.websiteUrl === "string" && r.websiteUrl.trim() ? r.websiteUrl.trim() : null,
  };
}

function formatRequestType(value: string) {
  return value.replaceAll("_", " ");
}

export const metadata = { title: "Profile Changes — Admin | JnUITS" };

export default async function ProfileChangesPage() {
  const admin = createAdminClient();
  const cookieStore = await cookies();
  const flash = parseAdminFlash(cookieStore.get(ADMIN_FLASH_COOKIE_NAME)?.value);

  const [pendingResult, recentResult, countResult, departments] = await Promise.all([
    admin
      .from("profile_update_requests")
      .select(
        "id, member_id, payload, request_type, requested_at, review_note, reviewed_at, status, members(full_name, jnuits_id, email, phone, department_code, facebook_url, linkedin_url, website_url)"
      )
      .in("request_type", ["profile_change", "email_change", "jnuits_id_change"])
      .eq("status", "pending")
      .order("requested_at", { ascending: true })
      .limit(20),
    admin
      .from("profile_update_requests")
      .select("id, member_id, request_type, requested_at, reviewed_at, status, members(full_name, jnuits_id)")
      .in("request_type", ["profile_change", "email_change", "jnuits_id_change"])
      .neq("status", "pending")
      .order("reviewed_at", { ascending: false })
      .limit(10),
    admin
      .from("profile_update_requests")
      .select("*", { count: "exact", head: true })
      .in("request_type", ["profile_change", "email_change", "jnuits_id_change"])
      .eq("status", "pending"),
    getActiveDepartmentOptions(),
  ]);

  const pending = (pendingResult.data || []) as ProfileChangeRequestRecord[];
  const recent = (recentResult.data || []) as ProfileChangeRequestRecord[];
  const pendingCount = countResult.count || 0;
  const departmentNameByCode = new Map(
    departments.map((department) => [department.code, department.name])
  );

  return (
    <div className="grid gap-8">
      <div className="admin-page-header">
        <div>
          <p className="admin-page-header__breadcrumb">Admin / Membership</p>
          <h1 className="admin-page-header__title">Profile Changes</h1>
          <p className="admin-page-header__desc">
            Review each member-requested name, phone, and social link edit before it is applied to the member record.
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
      <div className="admin-metric-grid">
        <div className="admin-metric-card" data-tone="warning">
          <div className="admin-metric-card__icon"><Clock size={16} /></div>
          <p className="admin-metric-card__label">Pending</p>
          <p className="admin-metric-card__value">{pendingCount}</p>
          <p className="admin-metric-card__sub">Await review</p>
        </div>
        <div className="admin-metric-card" data-tone="info">
          <div className="admin-metric-card__icon"><User size={16} /></div>
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
      </div>

      {/* Pending Queue */}
      <section>
        <p className="admin-section-label">Pending profile change requests</p>

        {pending.length === 0 ? (
          <EmptyState
            title="No pending profile change requests"
            description="When members request name, phone, or social link edits from the portal, they will appear here."
          />
        ) : (
          <div className="grid gap-4">
            {pending.map((req) => {
              const member = resolveMember(req.members);
              const payload = parseProfilePayload(req.payload);

              return (
                <div key={req.id} className="admin-review-card admin-review-card--pending">
                  <div className="admin-review-card__header">
                    <div>
                      <div className="admin-review-card__chips">
                        <span className="abadge abadge--pending">
                          {formatRequestType(req.request_type)}
                        </span>
                        {member?.jnuits_id && <span className="detail-chip">{member.jnuits_id}</span>}
                        <span className="detail-chip">{new Date(req.requested_at).toLocaleDateString("en-BD")}</span>
                      </div>
                      <p className="admin-review-card__name mt-1">{member?.full_name || "Linked member"}</p>
                      <p className="admin-review-card__id">{member?.email || "Email unavailable"}</p>
                    </div>
                  </div>

                  <div className="admin-review-card__diff">
                    <div className="admin-diff-box">
                      <p className="admin-diff-box__label">Requested updates</p>
                      {payload.fullName && (
                        <div className="admin-diff-box__item">
                          <span className="admin-diff-box__key">Full name</span>
                          <span>{payload.fullName}</span>
                        </div>
                      )}
                      {payload.phone && (
                        <div className="admin-diff-box__item">
                          <span className="admin-diff-box__key">Phone</span>
                          <span>{payload.phone}</span>
                        </div>
                      )}
                      {payload.departmentCode && (
                        <div className="admin-diff-box__item">
                          <span className="admin-diff-box__key">Department</span>
                          <span>{departmentNameByCode.get(payload.departmentCode) || payload.departmentCode}</span>
                        </div>
                      )}
                      {payload.linkedinUrl && (
                        <div className="admin-diff-box__item">
                          <span className="admin-diff-box__key">LinkedIn URL</span>
                          <span className="truncate text-xs">{payload.linkedinUrl}</span>
                        </div>
                      )}
                      {payload.facebookUrl && (
                        <div className="admin-diff-box__item">
                          <span className="admin-diff-box__key">Facebook URL</span>
                          <span className="truncate text-xs">{payload.facebookUrl}</span>
                        </div>
                      )}
                      {payload.newEmail && (
                        <div className="admin-diff-box__item">
                          <span className="admin-diff-box__key">New email</span>
                          <span>{payload.newEmail}</span>
                        </div>
                      )}
                      {payload.newJnuitsId && (
                        <div className="admin-diff-box__item">
                          <span className="admin-diff-box__key">New JnUITS ID</span>
                          <span>{payload.newJnuitsId}</span>
                        </div>
                      )}
                      {payload.websiteUrl && (
                        <div className="admin-diff-box__item">
                          <span className="admin-diff-box__key">Website URL</span>
                          <span className="truncate text-xs">{payload.websiteUrl}</span>
                        </div>
                      )}
                      {!payload.fullName && !payload.departmentCode && !payload.phone && !payload.facebookUrl && !payload.linkedinUrl && !payload.websiteUrl && !payload.newEmail && !payload.newJnuitsId && (
                        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>No specific field changes detected</p>
                      )}
                    </div>
                    <div className="admin-diff-box">
                      <p className="admin-diff-box__label">Current member data</p>
                      <div className="admin-diff-box__item">
                        <span className="admin-diff-box__key">Name on record</span>
                        <span>{member?.full_name || "—"}</span>
                      </div>
                      <div className="admin-diff-box__item">
                        <span className="admin-diff-box__key">Email on record</span>
                        <span>{member?.email || "—"}</span>
                      </div>
                      <div className="admin-diff-box__item">
                        <span className="admin-diff-box__key">JnUITS ID on record</span>
                        <span>{member?.jnuits_id || "—"}</span>
                      </div>
                      <div className="admin-diff-box__item">
                        <span className="admin-diff-box__key">Phone on record</span>
                        <span>{member?.phone || "Not set"}</span>
                      </div>
                      <div className="admin-diff-box__item">
                        <span className="admin-diff-box__key">Department on record</span>
                        <span>
                          {member?.department_code
                            ? departmentNameByCode.get(member.department_code) || member.department_code
                            : "Not set"}
                        </span>
                      </div>
                      <div className="admin-diff-box__item">
                        <span className="admin-diff-box__key">LinkedIn on record</span>
                        <span className="truncate text-xs">{member?.linkedin_url || "Not set"}</span>
                      </div>
                      <div className="admin-diff-box__item">
                        <span className="admin-diff-box__key">Facebook on record</span>
                        <span className="truncate text-xs">{member?.facebook_url || "Not set"}</span>
                      </div>
                    </div>
                  </div>

                  <form className="admin-review-card__actions">
                    <input type="hidden" name="requestId" value={req.id} />
                    <label className="input-label" htmlFor={`pcr-note-${req.id}`}>
                      Review note
                      <textarea
                        id={`pcr-note-${req.id}`}
                        name="reviewNote"
                        placeholder="Operator rationale or follow-up context"
                        rows={3}
                      />
                    </label>
                    <div className="flex flex-wrap gap-3">
                      <button className="admin-btn admin-btn--success" formAction={approveProfileChangeRequest}>
                        <CheckCircle size={14} /> Approve profile update
                      </button>
                      <button className="admin-btn admin-btn--danger" formAction={rejectProfileChangeRequest}>
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
                  <th>Type</th>
                  <th>Status</th>
                  <th>Reviewed</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((req) => {
                  const m = Array.isArray(req.members) ? req.members[0] : req.members;
                  return (
                    <tr key={req.id}>
                      <td className="font-semibold text-sm">{m?.full_name || "—"}</td>
                      <td className="text-xs font-mono" style={{ color: "var(--brand-blue)" }}>{m?.jnuits_id || "—"}</td>
                      <td className="text-xs capitalize">{formatRequestType(req.request_type)}</td>
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

