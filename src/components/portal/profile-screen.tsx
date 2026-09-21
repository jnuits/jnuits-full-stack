import Link from "next/link";
import { PortalShell } from "@/components/portal/portal-shell";
import { AvatarUploadField } from "@/components/profile/avatar-upload-field";
import { savePortalProfilePreferences } from "@/app/(portal)/portal/profile/actions";
import { requirePortalUser } from "@/lib/auth/session";
import { formatMembershipIdForDisplay } from "@/lib/members/jnuits-id";
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
  Palette,
  ShieldCheck,
  User,
} from "lucide-react";

type ProfileScreenProps = {
  error?: null | string;
  message?: null | string;
};

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

function resolveProfileMessage(message: null | string) {
  if (message === "preferences-saved") {
    return "Portal preferences saved.";
  }

  if (message === "email-change-verification-sent") {
    return "Email change verification is in progress. Check both the current and new email inboxes.";
  }

  return null;
}

function resolveProfileError(error: null | string) {
  if (error === "preferences-invalid") {
    return "The submitted portal preferences were invalid.";
  }

  if (error) {
    return decodeURIComponent(error);
  }

  return null;
}

export async function ProfileScreen({
  error = null,
  message = null,
}: ProfileScreenProps) {
  const auth = await requirePortalUser({ fallbackPath: "/portal/profile" });
  const user = auth.user;

  if (!user) return null;

  const snapshot = await getPortalMemberSnapshot(user.id);
  const member = snapshot.member;
  const feedbackMessage = resolveProfileMessage(message);
  const feedbackError = resolveProfileError(error);
  const canMutateProfile = snapshot.access.canMutate;
  const displayJnuitsId = formatMembershipIdForDisplay(member?.jnuits_id);

  return (
    <PortalShell
      avatarUrl={member?.avatar_secure_url ?? null}
      jnuitsId={displayJnuitsId || null}
      memberName={member?.full_name ?? null}
      portalRole={user.portalRole}
    >
      {!member ? (
        <>
          <div className="portal-page-header">
            <div>
              <p className="portal-page-header__breadcrumb">Portal Profile</p>
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
              <p style={{ color: "var(--muted-foreground)", fontSize: "0.88rem", lineHeight: 1.7 }}>
                The portal is protected but a linked member record is required to
                display directory, workplace, and timeline data. Contact an admin
                to link your account, or use the claim flow if you have a JNUITS ID.
              </p>
              <div style={{ marginTop: "1rem" }}>
                <Link
                  className="secondary-button"
                  href="/portal/dashboard"
                  style={{ display: "inline-flex" }}
                >
                  Back to overview
                </Link>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="portal-page-header">
            <div>
              <p className="portal-page-header__breadcrumb">Portal Profile</p>
              <h1 className="portal-page-header__title">Profile &amp; Identity</h1>
              <p className="portal-page-header__desc">
                Your member identity, portal preferences, directory data, and lifecycle history.
              </p>
            </div>
            {canMutateProfile ? (
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                <Link href="/portal/profile/edit" className="secondary-button">
                  Edit profile
                </Link>
              </div>
            ) : (
              <span className="portal-badge portal-badge--locked">
                {snapshot.access.portalAccessStatus || snapshot.access.lifecycleStatus}
              </span>
            )}
          </div>

          {feedbackMessage ? (
            <div className="flash-panel" data-tone="success">
              <p style={{ fontSize: "0.84rem", lineHeight: 1.6 }}>{feedbackMessage}</p>
            </div>
          ) : null}
          {feedbackError ? (
            <div className="flash-panel" data-tone="error">
              <p style={{ fontSize: "0.84rem", lineHeight: 1.6 }}>{feedbackError}</p>
            </div>
          ) : null}

          <div className="portal-identity-banner">
            <AvatarUploadField
              canUpload={canMutateProfile}
              compact
              currentUrl={member.avatar_secure_url ?? null}
              displayName={member.full_name}
              showLegacyAvatar={false}
              targetId={member.id}
              targetType="member"
            />
            <div className="portal-identity-banner__info">
              <h2 className="portal-identity-banner__name">{member.full_name}</h2>
              <div className="portal-identity-banner__meta">
                <span>{snapshot.departmentName ?? "Department pending"}</span>
                <span aria-hidden>·</span>
                <code style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>
                  {displayJnuitsId}
                </code>
                <span aria-hidden>·</span>
                <span>{member.batch_no ? `Batch ${member.batch_no}` : "Batch unknown"}</span>
                {member.student_id ? (
                  <>
                    <span aria-hidden>·</span>
                    <span>Student ID {member.student_id}</span>
                  </>
                ) : null}
                {member.graduation_year ? (
                  <>
                    <span aria-hidden>·</span>
                    <span>Graduation {member.graduation_year}</span>
                  </>
                ) : null}
              </div>
            </div>
            <div className="portal-identity-banner__actions">
              <span className={`portal-badge portal-badge--${member.is_profile_claimed ? "claimed" : "locked"}`}>
                {member.is_profile_claimed ? "Claimed" : "Unclaimed"}
              </span>
              <span className="portal-badge portal-badge--member">{member.member_type}</span>
              {!canMutateProfile ? (
                <span className="portal-badge portal-badge--locked">Read-only</span>
              ) : null}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gap: "1.25rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 24rem), 1fr))",
            }}
          >
            <div className="portal-section">
              <div className="portal-section__header">
                <div className="portal-section__header-left">
                  <div className="portal-section__icon"><User size={14} /></div>
                  <p className="portal-section__title">Contact &amp; professional info</p>
                </div>
                {!snapshot.directoryVerified ? (
                  <span className="portal-badge portal-badge--locked">
                    <Lock size={9} /> Directory locked
                  </span>
                ) : (
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
                    <span className="portal-info-row__value" data-locked={snapshot.directoryVerified ? undefined : "true"}>
                      {snapshot.directoryVerified
                        ? (member.current_organization ?? "Not published")
                        : "Locked (verify identity)"}
                    </span>
                  </div>
                  <div className="portal-info-row" data-locked={snapshot.directoryVerified ? undefined : "true"}>
                    <span className="portal-info-row__label"><Hash size={9} style={{ display: "inline", marginRight: "0.3rem" }} />Designation</span>
                    <span className="portal-info-row__value" data-locked={snapshot.directoryVerified ? undefined : "true"}>
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
                  {member.linkedin_url ? (
                    <div className="portal-info-row">
                      <span className="portal-info-row__label">LinkedIn</span>
                      <a
                        className="portal-info-row__value queue-link"
                        href={member.linkedin_url}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        View profile →
                      </a>
                    </div>
                  ) : null}
                </div>
                {!snapshot.directoryVerified ? (
                  <p
                    style={{
                      alignItems: "center",
                      color: "var(--muted-foreground)",
                      display: "flex",
                      fontSize: "0.8rem",
                      gap: "0.4rem",
                      marginTop: "0.85rem",
                    }}
                  >
                    <Lock size={11} />
                    Workplace fields require directory verification.{" "}
                    <Link href="/portal/profile/edit" className="queue-link">
                      Verify on edit page →
                    </Link>
                  </p>
                ) : null}
              </div>
            </div>

            <div className="portal-section">
              <div className="portal-section__header">
                <div className="portal-section__header-left">
                  <div className="portal-section__icon"><Palette size={14} /></div>
                  <p className="portal-section__title">Portal preferences</p>
                </div>
              </div>
              <div className="portal-section__body">
                <form action={savePortalProfilePreferences} style={{ display: "grid", gap: "0.9rem" }}>
                  <label className="input-label" htmlFor="portal-preferred-theme">
                    Theme preference
                    <select
                      defaultValue={snapshot.settings?.preferred_theme ?? "system"}
                      disabled={!canMutateProfile}
                      id="portal-preferred-theme"
                      name="preferredTheme"
                    >
                      <option value="system">System</option>
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                    </select>
                  </label>

                  <div style={{ display: "grid", gap: "0.4rem" }}>
                    <span style={{ fontSize: "0.84rem", fontWeight: 600 }}>Email notifications</span>
                    <label style={{ alignItems: "center", display: "flex", gap: "0.55rem", cursor: "pointer" }}>
                      <input
                        defaultChecked={snapshot.settings?.notification_email_opt_in ?? true}
                        disabled={!canMutateProfile}
                        name="notificationEmailOptIn"
                        type="checkbox"
                        value="true"
                      />
                      <span style={{ fontSize: "0.85rem", color: "var(--foreground)" }}>Receive account and workflow notices by email</span>
                    </label>
                  </div>

                  <div style={{ display: "grid", gap: "0.4rem" }}>
                    <span style={{ fontSize: "0.84rem", fontWeight: 600 }}>Ticket digests</span>
                    <label style={{ alignItems: "center", display: "flex", gap: "0.55rem", cursor: "pointer" }}>
                      <input
                        defaultChecked={snapshot.settings?.ticket_digest_opt_in ?? true}
                        disabled={!canMutateProfile}
                        name="ticketDigestOptIn"
                        type="checkbox"
                        value="true"
                      />
                      <span style={{ fontSize: "0.85rem", color: "var(--foreground)" }}>Receive ticket queue and reply digests</span>
                    </label>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "0.35rem" }}>
                    <button className="primary-button" disabled={!canMutateProfile} type="submit">
                      Save preferences
                    </button>
                    <Link className="secondary-button" href="/portal/profile/change-password">
                      Change password
                    </Link>
                  </div>
                </form>
              </div>
            </div>
          </div>

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
                <p style={{ color: "var(--muted-foreground)", fontSize: "0.86rem", lineHeight: 1.6 }}>
                  No moderation requests have been submitted from this account yet.
                </p>
              ) : (
                <div style={{ display: "grid", gap: "0.6rem" }}>
                  {snapshot.workplaceRequests.map((request) => (
                    <div key={request.id} className="portal-draft-card">
                      <div className="portal-draft-card__header">
                        <p className="portal-draft-card__title" style={{ textTransform: "capitalize" }}>
                          {request.request_type.replaceAll("_", " ")}
                        </p>
                        <span className={`portal-badge ${requestStatusBadge(request.status)}`}>
                          {request.status}
                        </span>
                      </div>
                      {request.review_note ? (
                        <p className="portal-draft-card__summary">{request.review_note}</p>
                      ) : null}
                      <div className="portal-draft-card__footer">
                        <span className="portal-draft-card__date">
                          Submitted {formatDate(request.requested_at)}
                        </span>
                        {request.reviewed_at ? (
                          <span className="portal-draft-card__date">
                            Reviewed {formatDate(request.reviewed_at)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

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
                <p style={{ color: "var(--muted-foreground)", fontSize: "0.86rem", lineHeight: 1.6 }}>
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
