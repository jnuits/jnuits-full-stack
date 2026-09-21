import Link from "next/link";
import { Activity, Clock3, FileClock, ShieldCheck } from "lucide-react";
import { PortalShell } from "@/components/portal/portal-shell";
import { requirePortalUser } from "@/lib/auth/session";
import { getPortalMemberSnapshot } from "@/lib/portal/member";

export const metadata = { title: "Activity | JnUITS Member Portal" };

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Date unavailable";
  }

  return new Date(value).toLocaleString("en-BD", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function requestTone(status: string) {
  if (status === "approved") {
    return "verified";
  }
  if (status === "rejected" || status === "returned") {
    return "returned";
  }
  return "draft";
}

export default async function PortalActivityPage() {
  const auth = await requirePortalUser({ fallbackPath: "/portal/activity" });
  if (!auth.user) return null;

  const snapshot = await getPortalMemberSnapshot(auth.user.id);
  const member = snapshot.member;
  const requests = [
    ...snapshot.workplaceRequests.map((request) => ({
      ...request,
      label: "Workplace update",
    })),
    ...snapshot.profileChangeRequests.map((request) => ({
      ...request,
      label: "Profile change",
    })),
  ].sort(
    (a, b) =>
      new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime()
  );

  return (
    <PortalShell
      avatarUrl={member?.avatar_secure_url ?? null}
      memberName={member?.full_name ?? null}
      jnuitsId={member?.jnuits_id ?? null}
      portalRole={auth.user.portalRole}
    >
      <div className="portal-page-header">
        <div>
          <p className="portal-page-header__breadcrumb">Member Services</p>
          <h1 className="portal-page-header__title">Activity</h1>
          <p className="portal-page-header__desc">
            Review recent lifecycle events, moderated requests, and directory
            access status for your member account.
          </p>
        </div>
        {member ? (
          <span className="portal-badge portal-badge--member">
            {member.jnuits_id}
          </span>
        ) : null}
      </div>

      <div className="portal-stat-grid">
        <div className="portal-stat-card" data-tone={member ? "success" : "danger"}>
          <div className="portal-stat-card__icon">
            <ShieldCheck size={15} />
          </div>
          <p className="portal-stat-card__label">Member link</p>
          <p className="portal-stat-card__value">
            {member ? "Connected" : "Missing"}
          </p>
          <p className="portal-stat-card__sub">
            {member?.jnuits_id ?? "Claim or request admin linking"}
          </p>
        </div>

        <div
          className="portal-stat-card"
          data-tone={snapshot.directoryVerified ? "success" : "warning"}
        >
          <div className="portal-stat-card__icon">
            <Activity size={15} />
          </div>
          <p className="portal-stat-card__label">Directory gate</p>
          <p className="portal-stat-card__value">
            {snapshot.directoryVerified ? "Verified" : "Locked"}
          </p>
          <p className="portal-stat-card__sub">Sensitive workplace visibility</p>
        </div>

        <div className="portal-stat-card">
          <div className="portal-stat-card__icon">
            <Clock3 size={15} />
          </div>
          <p className="portal-stat-card__label">Timeline events</p>
          <p className="portal-stat-card__value">{snapshot.timeline.length}</p>
          <p className="portal-stat-card__sub">Recent lifecycle entries</p>
        </div>

        <div className="portal-stat-card">
          <div className="portal-stat-card__icon">
            <FileClock size={15} />
          </div>
          <p className="portal-stat-card__label">Moderated requests</p>
          <p className="portal-stat-card__value">{requests.length}</p>
          <p className="portal-stat-card__sub">Profile and workplace changes</p>
        </div>
      </div>

      {!member ? (
        <section className="portal-section">
          <div className="portal-section__header">
            <div className="portal-section__header-left">
              <div className="portal-section__icon">
                <ShieldCheck size={14} />
              </div>
              <p className="portal-section__title">Linked member required</p>
            </div>
          </div>
          <div className="portal-section__body">
            <p className="text-sm leading-7 text-[var(--muted-foreground)]">
              Activity tracking requires this account to be linked with a
              JnUITS member record. Start from your profile or contact an admin
              if your member record already exists.
            </p>
            <div className="mt-4">
              <Link href="/portal/profile" className="secondary-button">
                Open profile
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)]">
          <section className="portal-section">
            <div className="portal-section__header">
              <div className="portal-section__header-left">
                <div className="portal-section__icon">
                  <Activity size={14} />
                </div>
                <p className="portal-section__title">Lifecycle timeline</p>
              </div>
              <span className="portal-badge portal-badge--draft">
                {snapshot.timeline.length} shown
              </span>
            </div>
            <div className="portal-section__body">
              {snapshot.timeline.length === 0 ? (
                <p className="text-sm leading-7 text-[var(--muted-foreground)]">
                  No lifecycle events have been recorded for this member yet.
                </p>
              ) : (
                <div className="grid gap-3">
                  {snapshot.timeline.map((event) => (
                    <article key={event.id} className="portal-draft-card">
                      <div className="portal-draft-card__header">
                        <p className="portal-draft-card__title">
                          {event.summary || event.event_type.replaceAll("_", " ")}
                        </p>
                        <span className="portal-badge portal-badge--verified">
                          {event.event_type.replaceAll("_", " ")}
                        </span>
                      </div>
                      <p className="portal-draft-card__date">
                        {formatDate(event.occurred_at || event.created_at)}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="portal-section">
            <div className="portal-section__header">
              <div className="portal-section__header-left">
                <div className="portal-section__icon">
                  <FileClock size={14} />
                </div>
                <p className="portal-section__title">Request history</p>
              </div>
              <Link href="/portal/profile/edit" className="queue-link">
                Submit update
              </Link>
            </div>
            <div className="portal-section__body">
              {requests.length === 0 ? (
                <p className="text-sm leading-7 text-[var(--muted-foreground)]">
                  You have not submitted profile or workplace changes yet.
                </p>
              ) : (
                <div className="grid gap-3">
                  {requests.map((request) => (
                    <article key={request.id} className="portal-draft-card">
                      <div className="portal-draft-card__header">
                        <p className="portal-draft-card__title">
                          {request.label}
                        </p>
                        <span
                          className={`portal-badge portal-badge--${requestTone(
                            request.status
                          )}`}
                        >
                          {request.status}
                        </span>
                      </div>
                      <p className="portal-draft-card__date">
                        {formatDate(request.requested_at)}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </PortalShell>
  );
}
