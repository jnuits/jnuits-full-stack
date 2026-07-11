"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  hasPermission,
  requirePortalPermission,
  requirePortalUser,
} from "@/lib/auth/session";
import { notifySupportTicketParticipant } from "@/lib/portal/ticket-notifications";
import { asFlexibleClient } from "@/lib/supabase/flexible";
import { createClient } from "@/lib/supabase/server";

const createTicketSchema = z.object({
  category: z.string().trim().min(1, "Choose a ticket category.").max(80),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  subject: z.string().trim().min(6, "Add a clear subject.").max(180),
  summary: z.string().trim().min(12, "Add a short summary.").max(2000),
});

const ticketReplySchema = z.object({
  body: z.string().trim().min(2, "Add a reply before sending.").max(4000),
  ticketId: z.string().trim().uuid("Ticket reference is invalid."),
});

const ticketAssignSchema = z.object({
  ticketId: z.string().trim().uuid("Ticket reference is invalid."),
});

const ticketLifecycleSchema = z.object({
  escalatedToAdmin: z.enum(["true", "false"]).default("false"),
  status: z
    .enum(["open", "in_progress", "waiting_on_member", "resolved", "closed"])
    .default("open"),
  ticketId: z.string().trim().uuid("Ticket reference is invalid."),
});

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

async function resolveSupportActorContext() {
  const auth = await requirePortalUser({ fallbackPath: "/portal/tickets" });
  const supabase = asFlexibleClient(await createClient());
  const [canManageMember, canManageAlumni, canManageAll, memberTypeResult] =
    await Promise.all([
      hasPermission("portal.tickets.manage_member"),
      hasPermission("portal.tickets.manage_alumni"),
      hasPermission("admin.support.manage"),
      supabase.rpc("current_member_type"),
    ]);

  return {
    auth,
    canManageAll,
    canManageAlumni,
    canManageMember,
    memberType:
      typeof memberTypeResult.data === "string" ? memberTypeResult.data : null,
    supabase,
  };
}

export async function createSupportTicket(formData: FormData) {
  const auth = await requirePortalPermission("portal.tickets.create_self", {
    fallbackPath: "/portal/tickets",
  });

  if (!auth.user) {
    redirect("/portal/login?next=%2Fportal%2Ftickets");
  }

  const parsed = createTicketSchema.safeParse({
    category: asString(formData.get("category")),
    priority: asString(formData.get("priority")) || "normal",
    subject: asString(formData.get("subject")),
    summary: asString(formData.get("summary")),
  });

  if (!parsed.success) {
    redirect(
      `/portal/tickets?error=${encodeURIComponent(
        parsed.error.issues[0]?.message || "ticket-invalid"
      )}`
    );
  }

  const supabase = asFlexibleClient(await createClient());
  const memberTypeResult = await supabase.rpc("current_member_type");
  const audienceScope = memberTypeResult.data === "alumni" ? "alumni" : "member";
  const ticketId = randomUUID();
  const { error: ticketError } = await supabase
    .from("support_tickets")
    .insert({
      id: ticketId,
      audience_scope: audienceScope,
      category: parsed.data.category,
      member_id: auth.user.memberId,
      opened_by_user_id: auth.user.id,
      priority: parsed.data.priority,
      subject: parsed.data.subject,
      summary: parsed.data.summary,
    });

  if (ticketError) {
    redirect(
      `/portal/tickets?error=${encodeURIComponent(
        ticketError?.message || "ticket-create"
      )}`
    );
  }

  await supabase.from("support_ticket_events").insert({
    actor_user_id: auth.user.id,
    event_type: "ticket_opened",
    payload: {
      audienceScope,
      category: parsed.data.category,
      priority: parsed.data.priority,
    },
    ticket_id: ticketId,
  });

  revalidatePath("/portal/tickets");
  redirect("/portal/tickets?message=ticket-created");
}

export async function replyToSupportTicket(formData: FormData) {
  const auth = await requirePortalUser({ fallbackPath: "/portal/tickets" });

  if (!auth.user) {
    redirect("/portal/login?next=%2Fportal%2Ftickets");
  }

  const parsed = ticketReplySchema.safeParse({
    body: asString(formData.get("body")),
    ticketId: asString(formData.get("ticketId")),
  });

  if (!parsed.success) {
    redirect(
      `/portal/tickets?error=${encodeURIComponent(
        parsed.error.issues[0]?.message || "ticket-reply-invalid"
      )}`
    );
  }

  const supabase = asFlexibleClient(await createClient());
  const { error: replyError } = await supabase.from("support_ticket_messages").insert({
    author_user_id: auth.user.id,
    body_markdown: parsed.data.body,
    ticket_id: parsed.data.ticketId,
  });

  if (replyError) {
    redirect(
      `/portal/tickets?error=${encodeURIComponent(
        replyError.message || "ticket-reply"
      )}`
    );
  }

  await supabase.from("support_ticket_events").insert({
    actor_user_id: auth.user.id,
    event_type: "reply_posted",
    payload: {
      replyLength: parsed.data.body.length,
    },
    ticket_id: parsed.data.ticketId,
  });

  await notifySupportTicketParticipant({
    actorUserId: auth.user.id,
    event: "reply",
    ticketId: parsed.data.ticketId,
  });

  revalidatePath("/portal/tickets");
  redirect("/portal/tickets?message=ticket-replied");
}

export async function assignSupportTicketToSelf(formData: FormData) {
  await requirePortalPermission(
    [
      "portal.tickets.manage_member",
      "portal.tickets.manage_alumni",
      "admin.support.manage",
    ],
    { fallbackPath: "/portal/tickets" }
  );

  const parsed = ticketAssignSchema.safeParse({
    ticketId: asString(formData.get("ticketId")),
  });

  if (!parsed.success) {
    redirect(
      `/portal/tickets?error=${encodeURIComponent(
        parsed.error.issues[0]?.message || "ticket-assign-invalid"
      )}`
    );
  }

  const { auth, canManageAll, canManageAlumni, supabase } =
    await resolveSupportActorContext();

  if (!auth.user) {
    redirect("/portal/login?next=%2Fportal%2Ftickets");
  }

  const assignedRoleScope = canManageAll
    ? "admin"
    : canManageAlumni
      ? "alumni"
      : "member";
  const { error: updateError } = await supabase
    .from("support_tickets")
    .update({
      assigned_role_scope: assignedRoleScope,
      assigned_to_user_id: auth.user.id,
      status: "in_progress",
    })
    .eq("id", parsed.data.ticketId);

  if (updateError) {
    redirect(
      `/portal/tickets?error=${encodeURIComponent(
        updateError.message || "ticket-assign"
      )}`
    );
  }

  await supabase.from("support_ticket_events").insert({
    actor_user_id: auth.user.id,
    event_type: "assigned_to_self",
    payload: {
      assignedRoleScope,
    },
    ticket_id: parsed.data.ticketId,
  });

  await notifySupportTicketParticipant({
    actorUserId: auth.user.id,
    event: "assignment",
    ticketId: parsed.data.ticketId,
  });

  revalidatePath("/portal/tickets");
  redirect("/portal/tickets?message=ticket-assigned");
}

export async function updateSupportTicketLifecycle(formData: FormData) {
  await requirePortalPermission(
    [
      "portal.tickets.manage_member",
      "portal.tickets.manage_alumni",
      "admin.support.manage",
    ],
    { fallbackPath: "/portal/tickets" }
  );

  const parsed = ticketLifecycleSchema.safeParse({
    escalatedToAdmin: asString(formData.get("escalatedToAdmin")) || "false",
    status: asString(formData.get("status")) || "open",
    ticketId: asString(formData.get("ticketId")),
  });

  if (!parsed.success) {
    redirect(
      `/portal/tickets?error=${encodeURIComponent(
        parsed.error.issues[0]?.message || "ticket-status-invalid"
      )}`
    );
  }

  const { auth, supabase } = await resolveSupportActorContext();

  if (!auth.user) {
    redirect("/portal/login?next=%2Fportal%2Ftickets");
  }

  const status = parsed.data.status;
  const escalatedToAdmin = parsed.data.escalatedToAdmin === "true";
  const { error: updateError } = await supabase
    .from("support_tickets")
    .update({
      escalated_to_admin: escalatedToAdmin,
      resolved_at:
        status === "resolved" || status === "closed"
          ? new Date().toISOString()
          : null,
      status,
    })
    .eq("id", parsed.data.ticketId);

  if (updateError) {
    redirect(
      `/portal/tickets?error=${encodeURIComponent(
        updateError.message || "ticket-status"
      )}`
    );
  }

  await supabase.from("support_ticket_events").insert({
    actor_user_id: auth.user.id,
    event_type: "status_changed",
    payload: {
      escalatedToAdmin,
      status,
    },
    ticket_id: parsed.data.ticketId,
  });

  await notifySupportTicketParticipant({
    actorUserId: auth.user.id,
    event: "status",
    ticketId: parsed.data.ticketId,
  });

  revalidatePath("/portal/tickets");
  redirect("/portal/tickets?message=ticket-status-updated");
}
