import { createAdminClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";
import { ADMIN_FLASH_COOKIE_NAME, parseAdminFlash } from "@/lib/admin/flash";
import {
  reissueMemberInvitation,
  revokeMemberInvitation,
} from "@/app/admin/actions";
import { EmptyState } from "@/components/ui/empty-state";
import { Hash, Mail, RefreshCcw } from "lucide-react";

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
    | { email?: string | null; full_name?: string | null; jnuits_id?: string | null; member_type?: string | null }
    | { email?: string | null; full_name?: string | null; jnuits_id?: string | null; member_type?: string | null }[]
    | null;
};

function resolveMember(inv: InvitationRecord) {
  if (Array.isArray(inv.members)) return inv.members[0] || null;
  return inv.members || null;
}

export const metadata = { title: "Invitations — Admin | JnUITS" };

export default async function InvitationsPage() {
  const admin = createAdminClient();
  const cookieStore = await cookies();
  const flash = parseAdminFlash(cookieStore.get(ADMIN_FLASH_COOKIE_NAME)?.value);

  const [activeResult, countResult] = await Promise.all([
    admin
      .from("member_invitations")
      .select(
        "id, member_id, created_at, expires_at, is_active, last_used_at, max_uses, notes, revoked_at, used_count, members(full_name, jnuits_id, email, member_type)"
      )
      .eq("is_active", true)
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("member_invitations")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)
      .is("revoked_at", null),
  ]);

  const invitations = (activeResult.data || []) as InvitationRecord[];
  const activeCount = countResult.count || 0;

  return (
    <div className="grid gap-8">
      <div className="admin-page-header">
        <div>
          <p className="admin-page-header__breadcrumb">Admin / Membership</p>
          <h1 className="admin-page-header__title">Invitations</h1>
          <p className="admin-page-header__desc">
            Manage active claim invitation codes. Issue replacements for lost codes, or revoke codes that are no longer valid.
          </p>
        </div>
        <span className="abadge abadge--active">
          <Mail size={10} /> {activeCount} active
        </span>
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
        <div className="admin-metric-card" data-tone="info">
          <div className="admin-metric-card__icon"><Mail size={16} /></div>
          <p className="admin-metric-card__label">Active codes</p>
          <p className="admin-metric-card__value">{activeCount}</p>
          <p className="admin-metric-card__sub">Not revoked, not expired</p>
        </div>
        <div className="admin-metric-card">
          <div className="admin-metric-card__icon"><Hash size={16} /></div>
          <p className="admin-metric-card__label">In view</p>
          <p className="admin-metric-card__value">{invitations.length}</p>
          <p className="admin-metric-card__sub">Shown per page</p>
        </div>
        <div className="admin-metric-card" data-tone="success">
          <div className="admin-metric-card__icon"><RefreshCcw size={16} /></div>
          <p className="admin-metric-card__label">Used</p>
          <p className="admin-metric-card__value">{invitations.filter((i) => i.used_count > 0).length}</p>
          <p className="admin-metric-card__sub">Have been claimed</p>
        </div>
      </div>

      {/* Active invitations */}
      <section>
        <p className="admin-section-label">Active claim invitations</p>

        {invitations.length === 0 ? (
          <EmptyState
            title="No active invitations"
            description="When approved applicants are sent claim codes, active ones will appear here for management."
          />
        ) : (
          <div className="grid gap-4">
            {invitations.map((invitation) => {
              const member = resolveMember(invitation);
              const isExpired = new Date(invitation.expires_at) < new Date();

              return (
                <div key={invitation.id} className="admin-review-card">
                  <div className="admin-review-card__header">
                    <div>
                      <div className="admin-review-card__chips">
                        <span className={`abadge abadge--${isExpired ? "rejected" : "active"}`}>
                          {isExpired ? "Expired" : "Active"}
                        </span>
                        <span className="detail-chip">
                          Uses {invitation.used_count}/{invitation.max_uses}
                        </span>
                        <span className="detail-chip">
                          Created {new Date(invitation.created_at).toLocaleDateString("en-BD")}
                        </span>
                      </div>
                      <p className="admin-review-card__name mt-1">{member?.full_name || "Linked member"}</p>
                      <p className="admin-review-card__id">{member?.jnuits_id || invitation.member_id}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p style={{ color: "var(--muted-foreground)" }}>
                        Expires {new Date(invitation.expires_at).toLocaleDateString("en-BD")}
                      </p>
                      {member?.email && (
                        <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{member.email}</p>
                      )}
                    </div>
                  </div>

                  <div className="admin-review-card__diff">
                    <div className="admin-diff-box">
                      <p className="admin-diff-box__label">Invitation status</p>
                      <div className="admin-diff-box__item">
                        <span className="admin-diff-box__key">Last used</span>
                        <span>
                          {invitation.last_used_at
                            ? new Date(invitation.last_used_at).toLocaleDateString("en-BD")
                            : "Not used yet"}
                        </span>
                      </div>
                      <div className="admin-diff-box__item">
                        <span className="admin-diff-box__key">Member type</span>
                        <span>{member?.member_type || "—"}</span>
                      </div>
                    </div>
                    <div className="admin-diff-box">
                      <p className="admin-diff-box__label">Operator note</p>
                      <p className="text-sm pt-1">{invitation.notes || "No note recorded."}</p>
                    </div>
                  </div>

                  <form className="admin-review-card__actions">
                    <input name="invitationId" type="hidden" value={invitation.id} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="input-label">
                        Replacement expiry (days)
                        <input defaultValue={14} max={60} min={1} name="invitationExpiresInDays" type="number" />
                      </label>
                      <label className="input-label">
                        Max uses
                        <input defaultValue={Math.max(1, invitation.max_uses)} max={5} min={1} name="maxUses" type="number" />
                      </label>
                    </div>
                    <label className="input-label">
                      Review note
                      <textarea name="reviewNote" placeholder="Why this invitation is being replaced or revoked" rows={3} />
                    </label>
                    <div className="flex flex-wrap gap-3">
                      <button className="admin-btn admin-btn--primary" formAction={reissueMemberInvitation}>
                        <RefreshCcw size={14} /> Issue replacement code
                      </button>
                      <button className="admin-btn admin-btn--ghost" formAction={revokeMemberInvitation}>
                        Revoke invitation
                      </button>
                    </div>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
