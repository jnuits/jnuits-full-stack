import "server-only";

import { hasPermission } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";
import { createClient } from "@/lib/supabase/server";
import { getPortalMemberSnapshot } from "@/lib/portal/member";

type MemberReference = {
  full_name: null | string;
  jnuits_id: null | string;
  member_type: null | string;
  user_id: null | string;
};

type SupportTicketRecord = {
  assigned_role_scope: null | string;
  assigned_to_user_id: null | string;
  audience_scope: "alumni" | "member";
  category: string;
  created_at: string;
  escalated_to_admin: boolean;
  id: string;
  member_id: null | string;
  opened_by_user_id: string;
  priority: "high" | "low" | "normal" | "urgent";
  resolved_at: null | string;
  status:
    | "closed"
    | "in_progress"
    | "open"
    | "resolved"
    | "waiting_on_member";
  subject: string;
  summary: string;
  updated_at: string;
};

type SupportTicketMessageRecord = {
  author_user_id: string;
  body_markdown: string;
  created_at: string;
  id: string;
  ticket_id: string;
};

type SupportTicketEventRecord = {
  actor_user_id: null | string;
  created_at: string;
  event_type: string;
  id: string;
  payload: Record<string, unknown> | null;
  ticket_id: string;
};

type EnrichedSupportTicket = SupportTicketRecord & {
  assignedToMember: MemberReference | null;
  latestEvent: SupportTicketEventRecord | null;
  messages: SupportTicketMessageRecord[];
  openedByMember: MemberReference | null;
};

function buildMemberMap(rows: MemberReference[] | null | undefined) {
  return new Map(
    (rows || [])
      .filter((row): row is MemberReference & { user_id: string } =>
        typeof row.user_id === "string" && row.user_id.length > 0
      )
      .map((row) => [row.user_id, row])
  );
}

export async function getPortalTicketWorkspace(userId: string) {
  const [snapshot, canManageMember, canManageAlumni, canManageAll] =
    await Promise.all([
      getPortalMemberSnapshot(userId),
      hasPermission("portal.tickets.manage_member"),
      hasPermission("portal.tickets.manage_alumni"),
      hasPermission("admin.support.manage"),
    ]);
  const supabase = asFlexibleClient(await createClient());
  const { data: ticketRows, error: ticketError } = await supabase
    .from("support_tickets")
    .select(
      "id, opened_by_user_id, member_id, audience_scope, category, status, priority, assigned_to_user_id, assigned_role_scope, escalated_to_admin, subject, summary, resolved_at, created_at, updated_at"
    )
    .order("updated_at", { ascending: false })
    .limit(canManageAll || canManageMember || canManageAlumni ? 24 : 12);

  if (ticketError) {
    throw new Error(ticketError.message);
  }

  const tickets = (ticketRows || []) as SupportTicketRecord[];
  const ticketIds = tickets.map((ticket) => ticket.id);
  const [messageResult, eventResult] = ticketIds.length
    ? await Promise.all([
        supabase
          .from("support_ticket_messages")
          .select("id, ticket_id, author_user_id, body_markdown, created_at")
          .in("ticket_id", ticketIds)
          .order("created_at", { ascending: true }),
        supabase
          .from("support_ticket_events")
          .select("id, ticket_id, actor_user_id, event_type, payload, created_at")
          .in("ticket_id", ticketIds)
          .order("created_at", { ascending: false }),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];

  if (messageResult.error) {
    throw new Error(messageResult.error.message);
  }

  if (eventResult.error) {
    throw new Error(eventResult.error.message);
  }

  const messages = (messageResult.data || []) as SupportTicketMessageRecord[];
  const events = (eventResult.data || []) as SupportTicketEventRecord[];
  const actorIds = Array.from(
    new Set(
      tickets
        .flatMap((ticket) => [ticket.opened_by_user_id, ticket.assigned_to_user_id])
        .concat(messages.map((message) => message.author_user_id))
        .filter((value): value is string => typeof value === "string" && value.length > 0)
    )
  );

  const admin = createAdminClient();
  const { data: memberRows, error: memberError } = actorIds.length
    ? await admin
        .from("members")
        .select("user_id, full_name, jnuits_id, member_type")
        .in("user_id", actorIds)
    : { data: [], error: null };

  if (memberError) {
    throw new Error(memberError.message);
  }

  const memberByUserId = buildMemberMap((memberRows || []) as MemberReference[]);
  const messagesByTicket = new Map<string, SupportTicketMessageRecord[]>();
  const latestEventByTicket = new Map<string, SupportTicketEventRecord>();

  for (const message of messages) {
    const bucket = messagesByTicket.get(message.ticket_id) || [];
    bucket.push(message);
    messagesByTicket.set(message.ticket_id, bucket);
  }

  for (const event of events) {
    if (!latestEventByTicket.has(event.ticket_id)) {
      latestEventByTicket.set(event.ticket_id, event);
    }
  }

  const enrichedTickets: EnrichedSupportTicket[] = tickets.map((ticket) => ({
    ...ticket,
    assignedToMember:
      (ticket.assigned_to_user_id
        ? memberByUserId.get(ticket.assigned_to_user_id)
        : null) || null,
    latestEvent: latestEventByTicket.get(ticket.id) || null,
    messages: messagesByTicket.get(ticket.id) || [],
    openedByMember: memberByUserId.get(ticket.opened_by_user_id) || null,
  }));

  return {
    canManageAll,
    canManageAlumni,
    canManageMember,
    isQueueOperator: canManageAll || canManageMember || canManageAlumni,
    member: snapshot.member,
    tickets: enrichedTickets,
  };
}
