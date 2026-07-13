import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildAlumniInvitationEmail: vi.fn(),
  buildClaimProfileUrl: vi.fn(),
  buildMemberInvitationEmail: vi.fn(),
  deliveryInsert: vi.fn(),
  from: vi.fn(),
  generateInvitationCode: vi.fn(),
  getInvitationExpiryIso: vi.fn(),
  hashInvitationCode: vi.fn(),
  invitationInsert: vi.fn(),
  invitationInsertSelect: vi.fn(),
  invitationInsertSingle: vi.fn(),
  invitationUpdate: vi.fn(),
  invitationUpdateEq: vi.fn(),
  lookupEq: vi.fn(),
  lookupMaybeSingle: vi.fn(),
  memberInvitationSelect: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/members/invitation-code", () => ({
  generateInvitationCode: () => mocks.generateInvitationCode(),
  getInvitationExpiryIso: (...args: unknown[]) => mocks.getInvitationExpiryIso(...args),
  hashInvitationCode: (...args: unknown[]) => mocks.hashInvitationCode(...args),
}));

vi.mock("@/lib/members/claim-url", () => ({
  buildClaimProfileUrl: (...args: unknown[]) => mocks.buildClaimProfileUrl(...args),
}));

vi.mock("@/lib/notifications/email-builders", () => ({
  buildAlumniInvitationEmail: (...args: unknown[]) =>
    mocks.buildAlumniInvitationEmail(...args),
  buildMemberInvitationEmail: (...args: unknown[]) =>
    mocks.buildMemberInvitationEmail(...args),
}));

vi.mock("@/lib/notifications/send-email", () => ({
  sendEmail: (...args: unknown[]) => mocks.sendEmail(...args),
}));

vi.mock("@/lib/supabase/flexible", () => ({
  asFlexibleClient: <T>(client: T) => client,
}));

import {
  type AdminClient,
  issueInvitationForMember,
} from "@/lib/admin/invitations";

function invitationOptions() {
  return {
    actorUserId: "operator-1",
    admin: { from: mocks.from } as unknown as AdminClient,
    emailVariant: "alumni" as const,
    expiresInDays: 14,
    invitationType: "bulk_csv" as const,
    maxUses: 1,
    member: {
      email: "Alumni@Example.Test",
      full_name: "Alumni Member",
      id: "member-1",
      jnuits_id: "20210001",
    },
    note: "Alumni onboarding batch",
  };
}

describe("issueInvitationForMember", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generateInvitationCode.mockReturnValue("claim-code");
    mocks.getInvitationExpiryIso.mockReturnValue("2026-08-01T00:00:00.000Z");
    mocks.hashInvitationCode.mockReturnValue("claim-code-hash");
    mocks.buildClaimProfileUrl.mockReturnValue("https://example.test/claim");
    mocks.buildAlumniInvitationEmail.mockReturnValue("<p>Alumni invitation</p>");
    mocks.buildMemberInvitationEmail.mockReturnValue("<p>Member invitation</p>");
    mocks.lookupMaybeSingle.mockResolvedValue({ data: null, error: null });
    mocks.memberInvitationSelect.mockReturnValue({ eq: mocks.lookupEq });
    mocks.lookupEq.mockReturnValue({ maybeSingle: mocks.lookupMaybeSingle });
    mocks.invitationInsertSingle.mockResolvedValue({
      data: { id: "invite-1" },
      error: null,
    });
    mocks.invitationInsertSelect.mockReturnValue({ single: mocks.invitationInsertSingle });
    mocks.invitationInsert.mockReturnValue({ select: mocks.invitationInsertSelect });
    mocks.invitationUpdateEq.mockResolvedValue({ error: null });
    mocks.invitationUpdate.mockReturnValue({ eq: mocks.invitationUpdateEq });
    mocks.deliveryInsert.mockResolvedValue({ error: null });
    mocks.from.mockImplementation((table: string) => {
      if (table === "member_invitations") {
        return {
          insert: mocks.invitationInsert,
          select: mocks.memberInvitationSelect,
          update: mocks.invitationUpdate,
        };
      }

      if (table === "invitation_email_deliveries") {
        return { insert: mocks.deliveryInsert };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("records a durable sent delivery for a bulk alumni invitation", async () => {
    mocks.sendEmail.mockResolvedValue({ messageId: "message-1", success: true });

    await expect(issueInvitationForMember(invitationOptions())).resolves.toMatchObject({
      deliveryStatus: "sent",
      invitationId: "invite-1",
    });

    expect(mocks.invitationInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        delivery_status: "pending",
        invitation_type: "bulk_csv",
        recipient_email_snapshot: "alumni@example.test",
        recipient_name_snapshot: "Alumni Member",
        send_attempts: 0,
      })
    );
    expect(mocks.sendEmail).toHaveBeenCalledWith({
      html: "<p>Alumni invitation</p>",
      idempotencyKey: "member-invitation/invite-1",
      subject: "Your JnUITS alumni portal invitation",
      to: "alumni@example.test",
    });
    expect(mocks.deliveryInsert).toHaveBeenCalledWith({
      created_by_user_id: "operator-1",
      error_message: null,
      invitation_id: "invite-1",
      provider_message_id: "message-1",
      recipient_email: "alumni@example.test",
      sent_at: expect.any(String),
      status: "sent",
    });
    expect(mocks.invitationUpdate).toHaveBeenCalledWith({
      delivery_status: "sent",
      last_sent_at: expect.any(String),
      send_attempts: 1,
    });
    expect(mocks.invitationUpdateEq).toHaveBeenCalledWith("id", "invite-1");
  });

  it("persists a failed provider response without losing the invitation record", async () => {
    mocks.sendEmail.mockResolvedValue({
      error: "Provider unavailable",
      success: false,
    });

    await expect(issueInvitationForMember(invitationOptions())).resolves.toMatchObject({
      deliveryError: "Provider unavailable",
      deliveryStatus: "failed",
      invitationId: "invite-1",
    });

    expect(mocks.deliveryInsert).toHaveBeenCalledWith({
      created_by_user_id: "operator-1",
      error_message: "Provider unavailable",
      invitation_id: "invite-1",
      provider_message_id: null,
      recipient_email: "alumni@example.test",
      sent_at: null,
      status: "failed",
    });
    expect(mocks.invitationUpdate).toHaveBeenCalledWith({
      delivery_status: "failed",
      last_sent_at: null,
      send_attempts: 1,
    });
  });
});