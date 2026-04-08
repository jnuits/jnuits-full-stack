import Link from "next/link";
import { PortalShell } from "@/components/portal/portal-shell";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getPortalMemberSnapshot } from "@/lib/portal/member";

function formatTimelineLabel(value: string) {
  return value.replaceAll("_", " ");
}

export default async function ProfilePage() {
  const auth = await requireAuthenticatedUser();
  const user = auth.user;

  if (!user) {
    return null;
  }

  const snapshot = await getPortalMemberSnapshot(user.id);

  return (
    <PortalShell
      title="Profile view"
      summary="Profile identity, timeline, and directory-gated workplace visibility now come from the linked Supabase member record instead of placeholder portal copy."
    >
      {!snapshot.member ? (
        <section className="section-band grid gap-4">
          <span className="eyebrow">Linked member required</span>
          <h2 className="font-[family-name:var(--font-heading)] text-[clamp(1.8rem,3vw,2.4rem)] leading-[0.96] tracking-[-0.04em]">
            This signed-in account does not have a member record yet
          </h2>
          <p className="section-copy">
            The portal is protected, but it still needs a claimed or linked
            member record to expose directory and timeline data. Claim flows and
            membership review are active in earlier phases.
          </p>
        </section>
      ) : (
        <div className="grid gap-4">
          <section className="info-grid">
            <article className="info-card">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--muted)]">
                Full name
              </p>
              <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold tracking-[-0.04em]">
                {snapshot.member.full_name}
              </h2>
              <p className="mt-3 text-sm text-[var(--muted)]">
                {snapshot.departmentName || "Department pending"} •{" "}
                {snapshot.member.member_type}
              </p>
            </article>
            <article className="info-card">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--muted)]">
                Member identity
              </p>
              <p className="mt-3 font-[family-name:var(--font-mono)] text-2xl tracking-[0.08em]">
                {snapshot.member.jnuits_id}
              </p>
              <p className="mt-3 text-sm text-[var(--muted)]">
                Claim status:{" "}
                {snapshot.member.is_profile_claimed ? "Claimed" : "Not claimed"}
              </p>
            </article>
            <article className="info-card">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--muted)]">
                Directory access
              </p>
              <p className="mt-3 text-2xl font-semibold tracking-[-0.03em]">
                {snapshot.directoryVerified ? "Verified for 1 hour" : "Locked"}
              </p>
              <p className="mt-3 text-sm text-[var(--muted)]">
                Use the verification panel on the edit page to unlock sensitive
                workplace fields for this browser.
              </p>
            </article>
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
            <article className="section-band">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="eyebrow">Member profile</span>
                  <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(1.8rem,3vw,2.4rem)] leading-[0.96] tracking-[-0.04em]">
                    Safe profile and visibility snapshot
                  </h2>
                </div>
                <Link className="secondary-button" href="/profile/edit">
                  Edit and verify
                </Link>
              </div>

              <div className="mt-6 info-grid">
                <div className="route-tile">
                  <h3>Contact</h3>
                  <p>{snapshot.member.email || user.email || "Email not set"}</p>
                  <p>{snapshot.member.phone || "Phone not set"}</p>
                </div>
                <div className="route-tile">
                  <h3>Professional visibility</h3>
                  <p>{snapshot.member.professional_visibility}</p>
                </div>
                <div className="route-tile">
                  <h3>Current organization</h3>
                  <p>
                    {snapshot.directoryVerified
                      ? snapshot.member.current_organization || "No workplace data published"
                      : "Hidden until directory verification succeeds"}
                  </p>
                </div>
                <div className="route-tile">
                  <h3>Designation</h3>
                  <p>
                    {snapshot.directoryVerified
                      ? snapshot.member.designation || "No designation published"
                      : "Hidden until directory verification succeeds"}
                  </p>
                </div>
              </div>
            </article>

            <article className="section-band">
              <span className="eyebrow">Recent requests</span>
              <div className="mt-5 grid gap-3">
                {snapshot.workplaceRequests.length === 0 ? (
                  <div className="empty-state">
                    No workplace moderation requests have been submitted yet.
                  </div>
                ) : (
                  snapshot.workplaceRequests.map((request) => (
                    <article key={request.id} className="timeline-item">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="font-[family-name:var(--font-heading)] text-lg">
                          {request.request_type.replaceAll("_", " ")}
                        </strong>
                        <span className="status-pill">{request.status}</span>
                      </div>
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        Requested{" "}
                        {new Date(request.requested_at).toLocaleDateString("en-BD", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </article>
                  ))
                )}
              </div>
            </article>
          </section>

          <section className="section-band">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <span className="eyebrow">Timeline</span>
                <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[clamp(1.8rem,3vw,2.4rem)] leading-[0.96] tracking-[-0.04em]">
                  Lifecycle events tied to this member account
                </h2>
              </div>
            </div>
            <div className="timeline-list mt-6">
              {snapshot.timeline.length === 0 ? (
                <div className="empty-state">
                  Timeline events have not been loaded for this member yet.
                </div>
              ) : (
                snapshot.timeline.map((event) => (
                  <article key={event.id} className="timeline-item">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="font-[family-name:var(--font-heading)] text-lg">
                        {event.summary || formatTimelineLabel(event.event_type)}
                      </strong>
                      <span className="detail-chip">
                        {new Date(event.occurred_at).toLocaleDateString("en-BD", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    <p className="mt-2 text-sm capitalize text-[var(--muted)]">
                      {formatTimelineLabel(event.event_type)}
                    </p>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </PortalShell>
  );
}
