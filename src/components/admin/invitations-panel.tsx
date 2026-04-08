import {
  reissueMemberInvitation,
  revokeMemberInvitation,
} from "@/app/admin/actions";

type InvitationRecord = {
  created_at: string;
  expires_at: string;
  id: string;
  last_used_at: string | null;
  max_uses: number;
  member_id: string;
  notes: string | null;
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

function resolveInvitationMember(invitation: InvitationRecord) {
  if (Array.isArray(invitation.members)) {
    return invitation.members[0] || null;
  }

  return invitation.members || null;
}

export function InvitationsPanel({
  invitations,
}: {
  invitations: InvitationRecord[];
}) {
  return (
    <section id="invitations" className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="eyebrow">Invitation lifecycle</span>
          <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(2rem,3vw,3rem)] leading-[0.96] tracking-[-0.04em]">
            Active claim invitations with replacement and revocation controls
          </h2>
        </div>
        <p className="max-w-xl text-sm leading-7 text-[var(--muted)]">
          Operators can now invalidate claim codes or issue replacements from
          the new stack instead of falling back to the legacy admin.
        </p>
      </div>

      {invitations.length === 0 ? (
        <article className="route-tile">
          <h3>No active invitations right now</h3>
          <p>
            Replacement and revocation controls will show up here when active
            invitations exist in the new stack.
          </p>
        </article>
      ) : (
        invitations.map((invitation) => {
          const member = resolveInvitationMember(invitation);

          return (
            <article key={invitation.id} className="application-card">
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.02fr)_minmax(320px,0.98fr)]">
                <div className="application-card__meta">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="eyebrow">Claim invitation</span>
                    <span className="detail-chip">
                      Created{" "}
                      {new Date(invitation.created_at).toLocaleDateString("en-BD")}
                    </span>
                    <span className="detail-chip">
                      Expires{" "}
                      {new Date(invitation.expires_at).toLocaleDateString("en-BD")}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-[family-name:var(--font-heading)] text-3xl font-semibold tracking-[-0.04em]">
                      {member?.full_name || "Linked member"}
                    </h3>
                    <p className="mt-2 text-base font-semibold text-[var(--brand-blue)]">
                      {member?.jnuits_id || invitation.member_id}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {member?.email ? (
                      <span className="detail-chip">{member.email}</span>
                    ) : null}
                    {member?.member_type ? (
                      <span className="detail-chip">{member.member_type}</span>
                    ) : null}
                    <span className="detail-chip">
                      Uses {invitation.used_count}/{invitation.max_uses}
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="route-tile">
                      <h3>Invitation status</h3>
                      <p>
                        {invitation.last_used_at
                          ? `Last used ${new Date(invitation.last_used_at).toLocaleDateString("en-BD")}`
                          : "Not used yet"}
                      </p>
                    </div>
                    <div className="route-tile">
                      <h3>Operator note</h3>
                      <p>{invitation.notes || "No operator note recorded."}</p>
                    </div>
                  </div>
                </div>

                <form className="application-card__actions">
                  <input name="invitationId" type="hidden" value={invitation.id} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="input-label">
                      Replacement expiry days
                      <input
                        defaultValue={14}
                        max={60}
                        min={1}
                        name="invitationExpiresInDays"
                        type="number"
                      />
                    </label>
                    <label className="input-label">
                      Replacement max uses
                      <input
                        defaultValue={Math.max(1, invitation.max_uses)}
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
                      placeholder="Why this invitation is being replaced or revoked"
                      rows={4}
                    />
                  </label>
                  <div className="flex flex-wrap gap-3">
                    <button
                      className="primary-button"
                      formAction={reissueMemberInvitation}
                    >
                      Issue replacement code
                    </button>
                    <button
                      className="secondary-button"
                      formAction={revokeMemberInvitation}
                    >
                      Revoke invitation
                    </button>
                  </div>
                </form>
              </div>
            </article>
          );
        })
      )}
    </section>
  );
}
