import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildSupportTicketUpdateEmail: vi.fn(),
  from: vi.fn(),
  getOptionalEmailRecipient: vi.fn(),
  logServerError: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  getAppBaseUrl: () => "https://preprod.example.test",
}));

vi.mock("@/lib/errors/api-error", () => ({
  logServerError: (...args: unknown[]) => mocks.logServerError(...args),
}));

vi.mock("@/lib/notifications/email-builders", () => ({
  buildSupportTicketUpdateEmail: (...args: unknown[]) =>
    mocks.buildSupportTicketUpdateEmail(...args),
}));

vi.mock("@/lib/notifications/preferences", () => ({
  getOptionalEmailRecipient: (...args: unknown[]) =>
    mocks.getOptionalEmailRecipient(...args),
}));

vi.mock("@/lib/notifications/send-email", () => ({
  sendEmail: (...args: unknown[]) => mocks.sendEmail(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mocks.from }),
}));

vi.mock("@/lib/supabase/flexible", () => ({
  asFlexibleClient: <T>(client: T) => client,
}));

import { notifySupportTicketParticipant } from "@/lib/portal/ticket-notifications";

function ticketQuery(result: unknown) {
  const query = {
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    select: vi.fn(),
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
}

describe("support ticket notification delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockReturnValue(
      ticketQuery({
        data: {
          assigned_to_user_id: "operator-2",
          opened_by_user_id: "member-1",
          status: "in_progress",
          subject: "Membership support",
        },
        error: null,
      })
    );
    mocks.buildSupportTicketUpdateEmail.mockReturnValue("<p>Ticket update</p>");
  });

  it("does not deliver a ticket update when the recipient opts out", async () => {
    mocks.getOptionalEmailRecipient.mockResolvedValue(null);

    await notifySupportTicketParticipant({
      actorUserId: "operator-2",
      event: "reply",
      ticketId: "ticket-1",
    });

    expect(mocks.getOptionalEmailRecipient).toHaveBeenCalledWith(
      "member-1",
      "ticket_digest_opt_in"
    );
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("delivers a minimal update after the recipient opts in", async () => {
    mocks.getOptionalEmailRecipient.mockResolvedValue("member@example.test");
    mocks.sendEmail.mockResolvedValue({ success: true });

    await notifySupportTicketParticipant({
      actorUserId: "operator-2",
      event: "status",
      ticketId: "ticket-1",
    });

    expect(mocks.buildSupportTicketUpdateEmail).toHaveBeenCalledWith({
      actionLabel: "The ticket status changed.",
      ticketStatus: "in_progress",
      ticketSubject: "Membership support",
      ticketUrl: "https://preprod.example.test/portal/tickets",
    });
    expect(mocks.sendEmail).toHaveBeenCalledWith({
      html: "<p>Ticket update</p>",
      subject: "JnUITS support ticket updated: Membership support",
      to: "member@example.test",
    });
    expect(mocks.logServerError).not.toHaveBeenCalled();
  });
});
