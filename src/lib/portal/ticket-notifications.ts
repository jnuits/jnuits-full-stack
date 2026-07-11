import "server-only";

import { getAppBaseUrl } from "@/lib/env";
import { logServerError } from "@/lib/errors/api-error";
import { buildSupportTicketUpdateEmail } from "@/lib/notifications/email-builders";
import { getOptionalEmailRecipient } from "@/lib/notifications/preferences";
import { sendEmail } from "@/lib/notifications/send-email";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";

type TicketNotificationEvent = "assignment" | "reply" | "status";

type SupportTicketNotificationRecord = {
  assigned_to_user_id: null | string;
  opened_by_user_id: string;
  status: string;
  subject: string;
};

function eventLabel(event: TicketNotificationEvent) {
  if (event === "assignment") return "The ticket was assigned to an operator.";
  if (event === "status") return "The ticket status changed.";
  return "A new reply was posted.";
}

/**
 * Sends a preference-aware ticket notice after the authenticated RLS-protected
 * mutation succeeds. It never throws, and it never includes message contents.
 */
export async function notifySupportTicketParticipant(options: {
  actorUserId: string;
  event: TicketNotificationEvent;
  ticketId: string;
}) {
  const admin = asFlexibleClient(createAdminClient());
  const { data, error } = await admin
    .from("support_tickets" as string)
    .select("opened_by_user_id, assigned_to_user_id, status, subject")
    .eq("id", options.ticketId)
    .maybeSingle();

  if (error || !data) {
    logServerError("support ticket notification lookup failed", {
      code: error?.code,
      event: options.event,
      ticketId: options.ticketId,
    });
    return;
  }

  const ticket = data as SupportTicketNotificationRecord;
  const recipientUserId =
    ticket.opened_by_user_id === options.actorUserId
      ? ticket.assigned_to_user_id
      : ticket.opened_by_user_id;

  if (!recipientUserId || recipientUserId === options.actorUserId) {
    return;
  }

  const recipientEmail = await getOptionalEmailRecipient(
    recipientUserId,
    "ticket_digest_opt_in"
  );

  if (!recipientEmail) {
    return;
  }

  const result = await sendEmail({
    html: buildSupportTicketUpdateEmail({
      actionLabel: eventLabel(options.event),
      ticketStatus: ticket.status,
      ticketSubject: ticket.subject,
      ticketUrl: `${getAppBaseUrl()}/portal/tickets`,
    }),
    subject: `JnUITS support ticket updated: ${ticket.subject}`,
    to: recipientEmail,
  });

  if (!result.success) {
    logServerError("support ticket notification delivery failed", {
      event: options.event,
      ticketId: options.ticketId,
    });
  }
}