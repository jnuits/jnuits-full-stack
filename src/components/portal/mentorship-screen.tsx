import { postMentorshipMessage, requestMentorshipRelationship, saveMentorshipProfile, updateMentorshipRelationship } from "@/app/(portal)/portal/mentorship/actions";
import { PortalShell } from "@/components/portal/portal-shell";
import { requirePortalUser } from "@/lib/auth/session";
import { getPortalMentorshipWorkspace } from "@/lib/portal/mentorship";
import { MessageSquareHeart, ShieldCheck, UserRoundSearch, Users } from "lucide-react";

type MentorshipScreenProps = {
  error?: null | string;
  message?: null | string;
};

const messageMap: Record<string, string> = {
  "mentorship-message-sent": "Message sent to the mentorship conversation.",
  "mentorship-profile-saved": "Mentorship profile saved.",
  "mentorship-requested": "Mentorship request sent.",
  "mentorship-status-updated": "Mentorship relationship updated.",
};

function resolveMessage(value: null | string) {
  return value ? messageMap[value] || value : null;
}

function formatDate(value: null | string) {
  if (!value) {
    return "No date";
  }

  return new Date(value).toLocaleString("en-BD", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusTone(status: string) {
  if (status === "active") {
    return "verified";
  }

  if (status === "requested") {
    return "pending";
  }

  if (status === "declined") {
    return "returned";
  }

  return "draft";
}

export async function MentorshipScreen({
  error = null,
  message = null,
}: MentorshipScreenProps) {
  const auth = await requirePortalUser({ fallbackPath: "/portal/mentorship" });
  const user = auth.user;

  if (!user) {
    return null;
  }

  const workspace = await getPortalMentorshipWorkspace(user.id);
  const member = workspace.member;
  const feedbackMessage = resolveMessage(message);
  const feedbackError = error ? decodeURIComponent(error) : null;
  const canAdvertiseAsMentor =
    member?.member_type === "alumni" ||
    workspace.canParticipate ||
    workspace.canModerate ||
    workspace.canManageAllSupport;

  return (
    <PortalShell
      avatarUrl={member?.avatar_secure_url ?? null}
      jnuitsId={member?.jnuits_id ?? null}
      memberName={member?.full_name ?? null}
      portalRole={user.portalRole}
    >
      <div className="portal-page-header">
        <div>
          <p className="portal-page-header__breadcrumb">Member Services</p>
          <h1 className="portal-page-header__title">Mentorship</h1>
          <p className="portal-page-header__desc">
            Publish alumni availability, request mentor conversations, and keep
            active guidance threads in one protected workspace.
          </p>
        </div>
        <span className="portal-badge portal-badge--member">
          {workspace.relationships.length} relationships
        </span>
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
            <p style={{ color: "var(--muted-foreground)", fontSize: "0.86rem", lineHeight: 1.7 }}>
              Mentorship needs a linked JnUITS member record before requests or
              alumni availability can be used.
            </p>
          </div>
        </section>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gap: "1.25rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 24rem), 1fr))",
            }}
          >
            <section className="portal-section">
              <div className="portal-section__header">
                <div className="portal-section__header-left">
                  <div className="portal-section__icon">
                    <Users size={14} />
                  </div>
                  <p className="portal-section__title">Your mentorship profile</p>
                </div>
              </div>
              <div className="portal-section__body">
                <form action={saveMentorshipProfile} style={{ display: "grid", gap: "0.85rem" }}>
                  <label className="input-label" htmlFor="mentorship-availability">
                    Availability
                    <select
                      defaultValue={workspace.selfProfile?.availability_status ?? "open"}
                      id="mentorship-availability"
                      name="availabilityStatus"
                    >
                      <option value="open">Open</option>
                      <option value="limited">Limited</option>
                      <option value="paused">Paused</option>
                    </select>
                  </label>
                  <label className="input-label" htmlFor="mentorship-bio">
                    Bio
                    <textarea
                      defaultValue={workspace.selfProfile?.bio ?? ""}
                      id="mentorship-bio"
                      name="bio"
                      placeholder="What experience, focus areas, or goals should this mentorship lane highlight?"
                      rows={5}
                    />
                  </label>
                  <label className="input-label" htmlFor="mentorship-interests">
                    Interests
                    <input
                      defaultValue={(workspace.selfProfile?.interests || []).join(", ")}
                      id="mentorship-interests"
                      name="interests"
                      placeholder="career planning, product, competitive programming"
                    />
                  </label>
                  <label className="input-label" style={{ gap: "0.6rem" }}>
                    <span>Publish as available mentor</span>
                    <label style={{ alignItems: "center", display: "flex", gap: "0.55rem" }}>
                      <input
                        defaultChecked={workspace.selfProfile?.opt_in ?? false}
                        disabled={!canAdvertiseAsMentor}
                        name="optIn"
                        type="checkbox"
                        value="true"
                      />
                      <span>
                        {canAdvertiseAsMentor
                          ? "Show this profile in the alumni mentorship directory."
                          : "Mentor publishing is reserved for alumni-side participants."}
                      </span>
                    </label>
                  </label>
                  <button className="primary-button" type="submit">
                    Save mentorship profile
                  </button>
                </form>
              </div>
            </section>

            <section className="portal-section">
              <div className="portal-section__header">
                <div className="portal-section__header-left">
                  <div className="portal-section__icon">
                    <ShieldCheck size={14} />
                  </div>
                  <p className="portal-section__title">Access lane</p>
                </div>
              </div>
              <div className="portal-section__body" style={{ display: "grid", gap: "0.65rem" }}>
                <div className="portal-info-row">
                  <span className="portal-info-row__label">Member type</span>
                  <span className="portal-info-row__value">
                    {member.member_type?.replaceAll("_", " ") || "Unknown"}
                  </span>
                </div>
                <div className="portal-info-row">
                  <span className="portal-info-row__label">Request access</span>
                  <span className="portal-info-row__value">
                    {workspace.canRequest ? "Enabled" : "Unavailable"}
                  </span>
                </div>
                <div className="portal-info-row">
                  <span className="portal-info-row__label">Mentor participation</span>
                  <span className="portal-info-row__value">
                    {workspace.canParticipate || canAdvertiseAsMentor
                      ? "Enabled"
                      : "Unavailable"}
                  </span>
                </div>
              </div>
            </section>
          </div>

          {member.member_type !== "alumni" ? (
            <section className="portal-section">
              <div className="portal-section__header">
                <div className="portal-section__header-left">
                  <div className="portal-section__icon">
                    <UserRoundSearch size={14} />
                  </div>
                  <p className="portal-section__title">Available alumni mentors</p>
                </div>
                <span className="portal-badge portal-badge--draft">
                  {workspace.mentors.length} listed
                </span>
              </div>
              <div className="portal-section__body">
                {workspace.mentors.length === 0 ? (
                  <p style={{ color: "var(--muted-foreground)", fontSize: "0.86rem", lineHeight: 1.7 }}>
                    No alumni mentors are published yet.
                  </p>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gap: "1rem",
                      gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 18rem), 1fr))",
                    }}
                  >
                    {workspace.mentors.map((mentor) => (
                      <article key={mentor.user_id} className="portal-project-card">
                        <div style={{ display: "grid", gap: "0.55rem" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem" }}>
                            <div>
                              <h2 style={{ fontSize: "1rem", fontWeight: 800, letterSpacing: "-0.03em" }}>
                                {mentor.member?.full_name || "Alumni mentor"}
                              </h2>
                              <p className="portal-draft-card__date">
                                {mentor.member?.designation || "Role not published"}
                              </p>
                            </div>
                            <span className="portal-badge portal-badge--verified">
                              {mentor.availability_status}
                            </span>
                          </div>
                          {mentor.bio ? (
                            <p style={{ color: "var(--muted-foreground)", fontSize: "0.84rem", lineHeight: 1.7 }}>
                              {mentor.bio}
                            </p>
                          ) : null}
                          {mentor.interests.length > 0 ? (
                            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                              {mentor.interests.slice(0, 5).map((interest) => (
                                <span key={interest} className="detail-chip">
                                  {interest}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          <form action={requestMentorshipRelationship}>
                            <input name="alumniUserId" type="hidden" value={mentor.user_id} />
                            <button className="secondary-button" type="submit">
                              Request mentorship
                            </button>
                          </form>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>
          ) : null}

          <section className="portal-section">
            <div className="portal-section__header">
              <div className="portal-section__header-left">
                <div className="portal-section__icon">
                  <MessageSquareHeart size={14} />
                </div>
                <p className="portal-section__title">Relationships &amp; conversations</p>
              </div>
              <span className="portal-badge portal-badge--draft">
                {workspace.relationships.length} visible
              </span>
            </div>
            <div className="portal-section__body">
              {workspace.relationships.length === 0 ? (
                <p style={{ color: "var(--muted-foreground)", fontSize: "0.86rem", lineHeight: 1.7 }}>
                  No mentorship relationships are visible for this account yet.
                </p>
              ) : (
                <div style={{ display: "grid", gap: "1rem" }}>
                  {workspace.relationships.map((relationship) => {
                    const isAlumniSide = relationship.alumni_user_id === user.id;
                    const canRespond =
                      isAlumniSide || workspace.canModerate || workspace.canManageAllSupport;

                    return (
                      <article key={relationship.id} className="portal-draft-card">
                        <div className="portal-draft-card__header">
                          <div>
                            <p className="portal-draft-card__title">
                              {(relationship.memberRecord?.full_name || "Member") +
                                " ↔ " +
                                (relationship.alumniMember?.full_name || "Alumni")}
                            </p>
                            <p className="portal-draft-card__date">
                              Created {formatDate(relationship.created_at)}
                            </p>
                          </div>
                          <span className={`portal-badge portal-badge--${statusTone(relationship.status)}`}>
                            {relationship.status}
                          </span>
                        </div>

                        <div className="portal-info-grid">
                          <div className="portal-info-row">
                            <span className="portal-info-row__label">Member</span>
                            <span className="portal-info-row__value">
                              {relationship.memberRecord?.full_name || "Unresolved"}
                            </span>
                          </div>
                          <div className="portal-info-row">
                            <span className="portal-info-row__label">Alumni</span>
                            <span className="portal-info-row__value">
                              {relationship.alumniMember?.full_name || "Unresolved"}
                            </span>
                          </div>
                        </div>

                        {relationship.status === "requested" && canRespond ? (
                          <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap", marginTop: "0.95rem" }}>
                            <form action={updateMentorshipRelationship}>
                              <input name="relationshipId" type="hidden" value={relationship.id} />
                              <input name="status" type="hidden" value="active" />
                              <button className="secondary-button" type="submit">
                                Accept request
                              </button>
                            </form>
                            <form action={updateMentorshipRelationship}>
                              <input name="relationshipId" type="hidden" value={relationship.id} />
                              <input name="status" type="hidden" value="declined" />
                              <button className="ghost-button" type="submit">
                                Decline
                              </button>
                            </form>
                          </div>
                        ) : null}

                        {relationship.status === "active" ? (
                          <>
                            <div style={{ display: "grid", gap: "0.65rem", marginTop: "1rem" }}>
                              {relationship.messages.length === 0 ? (
                                <p style={{ color: "var(--muted-foreground)", fontSize: "0.83rem", lineHeight: 1.65 }}>
                                  No messages yet in this relationship.
                                </p>
                              ) : (
                                relationship.messages.map((messageRecord) => (
                                  <div
                                    key={messageRecord.id}
                                    style={{
                                      border: "1px solid var(--line)",
                                      borderRadius: "1rem",
                                      padding: "0.85rem 1rem",
                                      background: "var(--surface-2)",
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        gap: "0.75rem",
                                        marginBottom: "0.45rem",
                                      }}
                                    >
                                      <span className="portal-badge portal-badge--draft">
                                        {messageRecord.author_user_id === user.id ? "You" : "Mentorship thread"}
                                      </span>
                                      <span className="portal-draft-card__date">
                                        {formatDate(messageRecord.created_at)}
                                      </span>
                                    </div>
                                    <div
                                      style={{
                                        color: "var(--foreground)",
                                        fontSize: "0.88rem",
                                        lineHeight: 1.7,
                                        whiteSpace: "pre-wrap",
                                      }}
                                    >
                                      {messageRecord.body_markdown}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>

                            <form action={postMentorshipMessage} style={{ display: "grid", gap: "0.75rem", marginTop: "1rem" }}>
                              <input name="relationshipId" type="hidden" value={relationship.id} />
                              <label className="input-label" htmlFor={`mentorship-message-${relationship.id}`}>
                                Conversation
                                <textarea
                                  id={`mentorship-message-${relationship.id}`}
                                  name="body"
                                  placeholder="Send your next mentorship update."
                                  rows={4}
                                  required
                                />
                              </label>
                              <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap" }}>
                                <button className="secondary-button" type="submit">
                                  Send message
                                </button>
                              </div>
                            </form>
                            <form action={updateMentorshipRelationship} style={{ marginTop: "0.75rem" }}>
                              <input name="relationshipId" type="hidden" value={relationship.id} />
                              <input name="status" type="hidden" value="closed" />
                              <button className="ghost-button" type="submit">
                                Close conversation
                              </button>
                            </form>
                          </>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </PortalShell>
  );
}
