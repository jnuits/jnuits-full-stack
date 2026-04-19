import Link from "next/link";
import { PortalShell } from "@/components/portal/portal-shell";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getPortalMemberSnapshot } from "@/lib/portal/member";
import {
  AlertTriangle,
  BookText,
  Building2,
  Clock,
  Hash,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  User,
} from "lucide-react";

export const metadata = { title: "My Profile | JnUITS Member Portal" };

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-BD", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatEventLabel(value: string): string {
  return value.replaceAll("_", " ");
}

function requestStatusBadge(status: string): string {
  if (status === "approved") return "portal-badge--verified";
  if (status === "rejected" || status === "returned") return "portal-badge--returned";
  if (status === "pending") return "portal-badge--pending";
  return "portal-badge--draft";
}

export default async function ProfilePage() {
  const auth = await requireAuthenticatedUser({ fallbackPath: "/profile" });
  const user = auth.user;
  if (!user) return null;

  const snapshot = await getPortalMemberSnapshot(user.id);
  const member = snapshot.member;

  return (
    <PortalShell
      memberName={member?.full_name ?? null}
      jnuitsId={member?.jnuits_id ?? null}
    >
      {/* ── No member record ── */}
      {!member ? (
        <>
          <div className="portal-page-header">
            <div>
              <p className="portal-page-header__breadcrumb">My Profile</p>
              <h1 className="portal-page-header__title">Member account not linked</h1>
              <p className="portal-page-header__desc">
                Your portal account hasn&apos;t been linked to a JnUITS member record yet.
              </p>
            </div>
          </div>
          <div className="portal-section">
            <div className="portal-section__header">
              <div className="portal-section__header-left">
                <div className="portal-section__icon"><AlertTriangle size={14} /></div>
                <p className="portal-section__title">No linked member record</p>
              </div>
            </div>
            <div className="portal-section__body">
              <p style={{ fontSize: "0.88rem", color: "var(--muted-foreground)", lineHeight: 1.7 }}>
                The portal is protected but a linked member record is required to
                display directory, workplace, and timeline data. Contact an admin
                to link your account, or use the claim flow if you have a JNUITS ID.
              </p>
              <div style={{ marginTop: "1rem" }}>
                <Link href="/portal" className="secondary-button" style={{ display: "inline-flex" }}>
                  Back to overview
                </Link>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* ── Page header ── */}
          <div className="portal-page-header">
            <div>
              <p className="portal-page-header__breadcrumb">My Profile</p>
              <h1 className="portal-page-header__title">Profile &amp; Identity</h1>
              <p className="portal-page-header__desc">
                Your member identity, directory data, and lifecycle history.
              </p>
            </div>
            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
              <Link href="/profile/edit" className="secondary-button">Edit profile</Link>
            </div>
          </div>

          {/* ── Identity banner ── */}
          <div className="portal-identity-banner">
            <div className="portal-identity-banner__avatar" aria-hidden="true">
              {member.full_name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase()).join("")}
            </div>
            <div className="portal-identity-banner__info">
              <h2 className="portal-identity-banner__name">{member.full_name}</h2>
              <div className="portal-identity-banner__meta">
                <span>{snapshot.departmentName ?? "Department pending"}</span>
                <span aria-hidden>·</span>
                <code style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>{member.jnuits_id}</code>
                <span aria-hidden>·</span>
                <span>{member.batch_no ? `Batch ${member.batch_no}` : "Batch unknown"}</span>
              </div>
            </div>
            <div className="portal-identity-banner__actions">
              <span className={`portal-badge portal-badge--${member.is_profile_claimed ? "claimed" : "locked"}`}>
                {member.is_profile_claimed ? "Claimed" : "Unclaimed"}
              </span>
              <span className="portal-badge portal-badge--member">{member.member_type}</span>
            </div>
          </div>

          {/* ── Info grid ── */}
          <div className="portal-section">
            <div className="portal-section__header">
              <div className="portal-section__header-left">
                <div className="portal-section__icon"><User size={14} /></div>
                <p className="portal-section__title">Contact &amp; professional info</p>
              </div>
              {!snapshot.directoryVerified && (
                <span className="portal-badge portal-badge--locked">
                  <Lock size={9} /> Directory locked
                </span>
              )}
              {snapshot.directoryVerified && (
                <span className="portal-badge portal-badge--verified">
                  <ShieldCheck size={9} /> Verified
                </span>
              )}
            </div>
            <div className="portal-section__body">
              <div className="portal-info-grid">
                <div className="portal-info-row">
                  <span className="portal-info-row__label"><Mail size={9} style={{ display: "inline", marginRight: "0.3rem" }} />Email</span>
                  <span className="portal-info-row__value">{member.email ?? user.email ?? "Not set"}</span>
                </div>
                <div className="portal-info-row">
                  <span className="portal-info-row__label"><Phone size={9} style={{ display: "inline", marginRight: "0.3rem" }} />Phone</span>
                  <span className="portal-info-row__value">{member.phone ?? "Not set"}</span>
                </div>
                <div className="portal-info-row" data-locked={snapshot.directoryVerified ? undefined : "true"}>
                  <span className="portal-info-row__label"><Building2 size={9} style={{ display: "inline", marginRight: "0.3rem" }} />Organization</span>
                  <span
                    className="portal-info-row__value"
                    data-locked={snapshot.directoryVerified ? undefined : "true"}
                  >
                    {snapshot.directoryVerified
                      ? (member.current_organization ?? "Not published")
                      : "Locked (verify identity)"}
                  </span>
                </div>
                <div className="portal-info-row" data-locked={snapshot.directoryVerified ? undefined : "true"}>
                  <span className="portal-info-row__label"><Hash size={9} style={{ display: "inline", marginRight: "0.3rem" }} />Designation</span>
                  <span
                    className="portal-info-row__value"
                    data-locked={snapshot.directoryVerified ? undefined : "true"}
                  >
                    {snapshot.directoryVerified
                      ? (member.designation ?? "Not published")
                      : "Locked (verify identity)"}
                  </span>
                </div>
                <div className="portal-info-row">
                  <span className="portal-info-row__label">Visibility</span>
                  <span className="portal-info-row__value" style={{ textTransform: "capitalize" }}>
                    {member.professional_visibility?.replaceAll("_", " ") ?? "Full"}
                  </span>
                </div>
                {member.linkedin_url && (
                  <div className="portal-info-row">
                    <span className="portal-info-row__label">LinkedIn</span>
                    <a
                      href={member.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="portal-info-row__value queue-link"
                    >
                      View profile →
                    </a>
                  </div>
                )}
              </div>
              {!snapshot.directoryVerified && (
                <p style={{ marginTop: "0.85rem", fontSize: "0.8rem", color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <Lock size={11} />
                  Workplace fields require directory verification.{" "}
                  <Link href="/profile/edit" className="queue-link">Verify on edit page →</Link>
                </p>
              )}
            </div>
          </div>

          {/* ── Recent moderation requests ── */}
          <div className="portal-section">
            <div className="portal-section__header">
              <div className="portal-section__header-left">
                <div className="portal-section__icon"><BookText size={14} /></div>
                <p className="portal-section__title">Recent requests</p>
              </div>
              <span className="portal-badge portal-badge--draft">{snapshot.workplaceRequests.length} total</span>
            </div>
            <div className="portal-section__body">
              {snapshot.workplaceRequests.length === 0 ? (
                <p style={{ fontSize: "0.86rem", color: "var(--muted-foreground)", lineHeight: 1.6 }}>
                  No moderation requests have been submitted from this account yet.
                </p>
              ) : (
                <div style={{ display: "grid", gap: "0.6rem" }}>
                  {snapshot.workplaceRequests.map((req) => (
                    <div key={req.id} className="portal-draft-card">
                      <div className="portal-draft-card__header">
                        <p className="portal-draft-card__title" style={{ textTransform: "capitalize" }}>
                          {req.request_type.replaceAll("_", " ")}
                        </p>
                        <span className={`portal-badge ${requestStatusBadge(req.status)}`}>{req.status}</span>
                      </div>
                      {req.review_note && (
                        <p className="portal-draft-card__summary">{req.review_note}</p>
                      )}
                      <div className="portal-draft-card__footer">
                        <span className="portal-draft-card__date">
                          Submitted {formatDate(req.requested_at)}
                        </span>
                        {req.reviewed_at && (
                          <span className="portal-draft-card__date">
                            Reviewed {formatDate(req.reviewed_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Timeline ── */}
          <div className="portal-section">
            <div className="portal-section__header">
              <div className="portal-section__header-left">
                <div className="portal-section__icon"><Clock size={14} /></div>
                <p className="portal-section__title">Lifecycle timeline</p>
              </div>
              <span className="portal-badge portal-badge--draft">{snapshot.timeline.length} events</span>
            </div>
            <div className="portal-section__body">
              {snapshot.timeline.length === 0 ? (
                <p style={{ fontSize: "0.86rem", color: "var(--muted-foreground)", lineHeight: 1.6 }}>
                  Timeline events have not been recorded for this member yet.
                </p>
              ) : (
                <div className="portal-timeline">
                  {snapshot.timeline.map((event) => (
                    <div key={event.id} className="portal-timeline-item">
                      <div className="portal-timeline-item__dot" aria-hidden="true" />
                      <div className="portal-timeline-item__content">
                        <p className="portal-timeline-item__title">
                          {event.summary ?? formatEventLabel(event.event_type)}
                        </p>
                        <p className="portal-timeline-item__meta" style={{ textTransform: "capitalize" }}>
                          {formatEventLabel(event.event_type)} · {formatDate(event.occurred_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </PortalShell>
  );
}
