import { assignSupportTicketToSelf, createSupportTicket, replyToSupportTicket, updateSupportTicketLifecycle } from "@/app/(portal)/portal/tickets/actions";
import { PortalShell } from "@/components/portal/portal-shell";
import { requirePortalUser } from "@/lib/auth/session";
import { getPortalTicketWorkspace } from "@/lib/portal/tickets";
import { Clock3, LifeBuoy, MessageSquare, ShieldCheck } from "lucide-react";

type TicketsScreenProps = {
  error?: null | string;
  message?: null | string;
};

const messageMap: Record<string, string> = {
  "ticket-assigned": "Ticket assigned to your queue.",
  "ticket-created": "Ticket opened successfully.",
  "ticket-replied": "Reply posted to the ticket timeline.",
  "ticket-status-updated": "Ticket lifecycle updated.",
};

function resolveMessage(value: null | string) {
  return value ? messageMap[value] || value : null;
}

function formatDate(value: null | string) {
  if (!value) {
    return "No timestamp";
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
  if (status === "resolved" || status === "closed") {
    return "verified";
  }

  if (status === "waiting_on_member") {
    return "pending";
  }

  if (status === "in_progress") {
    return "claimed";
  }

  return "draft";
}

function priorityTone(priority: string) {
  if (priority === "urgent" || priority === "high") {
    return "returned";
  }

  if (priority === "low") {
    return "draft";
  }

  return "member";
}

export async function TicketsScreen({
  error = null,
  message = null,
}: TicketsScreenProps) {
  const auth = await requirePortalUser({ fallbackPath: "/portal/tickets" });
  const user = auth.user;

  if (!user) {
    return null;
  }

  const workspace = await getPortalTicketWorkspace(user.id);
  const feedbackMessage = resolveMessage(message);
  const feedbackError = error ? decodeURIComponent(error) : null;
  const defaultAudience =
    workspace.member?.member_type === "alumni" ? "Alumni queue" : "Member queue";

  return (
    <PortalShell
      avatarUrl={workspace.member?.avatar_secure_url ?? null}
      jnuitsId={workspace.member?.jnuits_id ?? null}
      memberName={workspace.member?.full_name ?? null}
      portalRole={user.portalRole}
    >
      <div className="portal-page-header">
        <div>
          <p className="portal-page-header__breadcrumb">Member Services</p>
          <h1 className="portal-page-header__title">Support Tickets</h1>
          <p className="portal-page-header__desc">
            Open requests, respond to admin guidance, and manage the active
            queue if your portal role includes support coverage.
          </p>
        </div>
        <span className="portal-badge portal-badge--member">
          {workspace.isQueueOperator ? "Queue operator" : defaultAudience}
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

      <div
        style={{
          display: "grid",
          gap: "1.25rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 22rem), 1fr))",
        }}
      >
        <section className="portal-section">
          <div className="portal-section__header">
            <div className="portal-section__header-left">
              <div className="portal-section__icon">
                <LifeBuoy size={14} />
              </div>
              <p className="portal-section__title">Open a new request</p>
            </div>
          </div>
          <div className="portal-section__body">
            <form action={createSupportTicket} style={{ display: "grid", gap: "0.85rem" }}>
              <label className="input-label" htmlFor="ticket-subject">
                Subject
                <input
                  id="ticket-subject"
                  name="subject"
                  placeholder="What do you need help with?"
                  required
                />
              </label>
              <div
                style={{
                  display: "grid",
                  gap: "0.85rem",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                }}
              >
                <label className="input-label" htmlFor="ticket-category">
                  Category
                  <input
                    id="ticket-category"
                    name="category"
                    placeholder="Support, access, workflow"
                    required
                  />
                </label>
                <label className="input-label" htmlFor="ticket-priority">
                  Priority
                  <select defaultValue="normal" id="ticket-priority" name="priority">
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </label>
              </div>
              <label className="input-label" htmlFor="ticket-summary">
                Summary
                <textarea
                  id="ticket-summary"
                  name="summary"
                  placeholder="Give the support team enough context to act quickly."
                  required
                  rows={5}
                />
              </label>
              <button className="primary-button" type="submit">
                Create ticket
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
              <p className="portal-section__title">Queue access</p>
            </div>
          </div>
          <div className="portal-section__body" style={{ display: "grid", gap: "0.65rem" }}>
            <div className="portal-info-row">
              <span className="portal-info-row__label">Access lane</span>
              <span className="portal-info-row__value">
                {workspace.isQueueOperator
                  ? "You can manage tickets visible to your role."
                  : "You can open and reply to your own support tickets."}
              </span>
            </div>
            <div className="portal-info-row">
              <span className="portal-info-row__label">Visible tickets</span>
              <span className="portal-info-row__value">{workspace.tickets.length}</span>
            </div>
            <div className="portal-info-row">
              <span className="portal-info-row__label">Escalations</span>
              <span className="portal-info-row__value">
                {workspace.tickets.filter((ticket) => ticket.escalated_to_admin).length}
              </span>
            </div>
          </div>
        </section>
      </div>

      <section className="portal-section">
        <div className="portal-section__header">
          <div className="portal-section__header-left">
            <div className="portal-section__icon">
              <Clock3 size={14} />
            </div>
            <p className="portal-section__title">
              {workspace.isQueueOperator ? "Active support queue" : "Your tickets"}
            </p>
          </div>
          <span className="portal-badge portal-badge--draft">
            {workspace.tickets.length} visible
          </span>
        </div>
        <div className="portal-section__body">
          {workspace.tickets.length === 0 ? (
            <p style={{ color: "var(--muted-foreground)", fontSize: "0.86rem", lineHeight: 1.7 }}>
              No tickets are visible in this lane yet.
            </p>
          ) : (
            <div style={{ display: "grid", gap: "1rem" }}>
              {workspace.tickets.map((ticket) => {
                const isOwner = ticket.opened_by_user_id === user.id;
                const canManageTicket =
                  workspace.isQueueOperator ||
                  ticket.assigned_to_user_id === user.id;

                return (
                  <article key={ticket.id} className="portal-draft-card">
                    <div className="portal-draft-card__header">
                      <div>
                        <p className="portal-draft-card__title">{ticket.subject}</p>
                        <p className="portal-draft-card__date">
                          {ticket.category} · Updated {formatDate(ticket.updated_at)}
                        </p>
                      </div>
                      <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
                        <span className={`portal-badge portal-badge--${statusTone(ticket.status)}`}>
                          {ticket.status.replaceAll("_", " ")}
                        </span>
                        <span className={`portal-badge portal-badge--${priorityTone(ticket.priority)}`}>
                          {ticket.priority}
                        </span>
                      </div>
                    </div>

                    <p className="portal-draft-card__summary">{ticket.summary}</p>

                    <div style={{ display: "grid", gap: "0.55rem" }}>
                      <div className="portal-info-row">
                        <span className="portal-info-row__label">Opened by</span>
                        <span className="portal-info-row__value">
                          {isOwner
                            ? "You"
                            : ticket.openedByMember?.full_name || "Community member"}
                        </span>
                      </div>
                      <div className="portal-info-row">
                        <span className="portal-info-row__label">Assigned</span>
                        <span className="portal-info-row__value">
                          {ticket.assignedToMember?.full_name || "Unassigned"}
                        </span>
                      </div>
                      <div className="portal-info-row">
                        <span className="portal-info-row__label">Last event</span>
                        <span className="portal-info-row__value">
                          {ticket.latestEvent
                            ? `${ticket.latestEvent.event_type.replaceAll("_", " ")} · ${formatDate(ticket.latestEvent.created_at)}`
                            : "No workflow events yet"}
                        </span>
                      </div>
                    </div>

                    {workspace.isQueueOperator && !ticket.assigned_to_user_id ? (
                      <form action={assignSupportTicketToSelf} style={{ marginTop: "0.85rem" }}>
                        <input name="ticketId" type="hidden" value={ticket.id} />
                        <button className="secondary-button" type="submit">
                          Assign to me
                        </button>
                      </form>
                    ) : null}

                    {canManageTicket ? (
                      <form
                        action={updateSupportTicketLifecycle}
                        style={{
                          display: "grid",
                          gap: "0.75rem",
                          gridTemplateColumns: "repeat(auto-fit, minmax(11rem, 1fr))",
                          marginTop: "0.95rem",
                        }}
                      >
                        <input name="ticketId" type="hidden" value={ticket.id} />
                        <label className="input-label">
                          Status
                          <select defaultValue={ticket.status} name="status">
                            <option value="open">Open</option>
                            <option value="in_progress">In progress</option>
                            <option value="waiting_on_member">Waiting on member</option>
                            <option value="resolved">Resolved</option>
                            <option value="closed">Closed</option>
                          </select>
                        </label>
                        <label className="input-label">
                          Escalate to admin
                          <select
                            defaultValue={ticket.escalated_to_admin ? "true" : "false"}
                            name="escalatedToAdmin"
                          >
                            <option value="false">No</option>
                            <option value="true">Yes</option>
                          </select>
                        </label>
                        <div style={{ display: "flex", alignItems: "end" }}>
                          <button className="ghost-button" type="submit">
                            Save lifecycle
                          </button>
                        </div>
                      </form>
                    ) : null}

                    <div style={{ marginTop: "1rem", display: "grid", gap: "0.65rem" }}>
                      <p
                        style={{
                          fontSize: "0.76rem",
                          fontWeight: 700,
                          letterSpacing: "0.14em",
                          textTransform: "uppercase",
                          color: "var(--muted-foreground)",
                        }}
                      >
                        Conversation
                      </p>
                      {ticket.messages.length === 0 ? (
                        <p style={{ color: "var(--muted-foreground)", fontSize: "0.83rem", lineHeight: 1.65 }}>
                          No replies yet.
                        </p>
                      ) : (
                        <div style={{ display: "grid", gap: "0.65rem" }}>
                          {ticket.messages.map((messageRecord) => {
                            const sentByRequester =
                              messageRecord.author_user_id === ticket.opened_by_user_id;
                            const label =
                              messageRecord.author_user_id === user.id
                                ? "You"
                                : sentByRequester
                                  ? "Requester"
                                  : "Queue operator";

                            return (
                              <div
                                key={messageRecord.id}
                                className="portal-message-bubble"
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: "0.75rem",
                                    marginBottom: "0.45rem",
                                  }}
                                >
                                  <span className="portal-badge portal-badge--draft">
                                    {label}
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
                                    overflowWrap: "anywhere",
                                    wordBreak: "break-word",
                                  }}
                                >
                                  {messageRecord.body_markdown}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <form action={replyToSupportTicket} style={{ display: "grid", gap: "0.75rem", marginTop: "0.95rem" }}>
                      <input name="ticketId" type="hidden" value={ticket.id} />
                      <label className="input-label" htmlFor={`ticket-reply-${ticket.id}`}>
                        <MessageSquare size={13} />
                        Reply
                        <textarea
                          id={`ticket-reply-${ticket.id}`}
                          name="body"
                          placeholder="Write your next update or instruction."
                          rows={4}
                          required
                        />
                      </label>
                      <button className="secondary-button" type="submit">
                        Send reply
                      </button>
                    </form>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </PortalShell>
  );
}
