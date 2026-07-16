import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
  loadPublishedFormByVersionId: vi.fn(),
  resolvePublishedEventForMutation: vi.fn(),
  rpc: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/content/events", () => ({
  resolvePublishedEventForMutation: mocks.resolvePublishedEventForMutation,
}));

vi.mock("@/lib/forms/repository", () => ({
  loadPublishedFormByVersionId: mocks.loadPublishedFormByVersionId,
}));

vi.mock("@/lib/notifications/email-builders", () => ({
  buildEventConfirmationEmail: vi.fn(() => "<p>Confirmation</p>"),
  buildEventWaitlistEmail: vi.fn(() => "<p>Waitlist</p>"),
}));

vi.mock("@/lib/notifications/send-email", () => ({ sendEmail: mocks.sendEmail }));
vi.mock("@/lib/security/with-api-guard", () => ({ withApiGuard: <T>(handler: T) => handler }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/supabase/flexible", () => ({ asFlexibleClient: <T>(client: T) => client }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { POST } from "./route";

describe("linked event registration form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createAdminClient.mockReturnValue({ rpc: mocks.rpc });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });
    mocks.resolvePublishedEventForMutation.mockResolvedValue({
      id: "event-1",
      legacyContentPostId: null,
      locationLabel: "JnUITS hall",
      registrationClosed: false,
      registrationFormVersionId: "00000000-0000-4000-8000-000000000001",
      registrationMode: "internal",
      registrationOpen: true,
      startsAt: "2026-08-15T10:00:00.000Z",
      title: "JnUITS Summit",
    });
    mocks.loadPublishedFormByVersionId.mockResolvedValue({
      applicationBehavior: {
        fieldMapping: { email: "email", fullName: "full_name", phone: "phone" },
      },
      definition: {
        fields: [
          { id: "full_name", label: "Full name", required: true, type: "text" },
          { id: "email", label: "Email", required: true, type: "email" },
          { id: "phone", label: "Phone", required: false, type: "telephone" },
          { id: "meal", label: "Meal", required: true, type: "select", options: [{ label: "Veg", value: "veg" }] },
        ],
        payment: { enabled: false },
      },
      id: "00000000-0000-4000-8000-000000000002",
      kind: "event_registration",
      slug: "summit-registration",
      title: "Summit registration",
      versionId: "00000000-0000-4000-8000-000000000001",
    });
    mocks.rpc.mockResolvedValue({
      data: [{ registration_code: "FORM123", result_status: "created" }],
      error: null,
    });
  });

  it("uses validated linked-form answers in the atomic event registration RPC", async () => {
    const response = await POST(
      new NextRequest("https://jnuits.org.bd/api/events/event-1/register", {
        body: JSON.stringify({
          answers: {
            email: "Attendee@Example.Test",
            full_name: "Event Attendee",
            meal: "veg",
            phone: "+8801700000000",
          },
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
      { params: Promise.resolve({ eventId: "event-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith(
      "register_for_event_with_form_atomic",
      expect.objectContaining({
        p_answers: {
          email: "attendee@example.test",
          full_name: "Event Attendee",
          meal: "veg",
          phone: "+8801700000000",
        },
        p_event_id: "event-1",
        p_form_definition_id: "00000000-0000-4000-8000-000000000002",
        p_form_version_id: "00000000-0000-4000-8000-000000000001",
        p_registrant_email: "attendee@example.test",
        p_registrant_name: "Event Attendee",
        p_registrant_phone: "+8801700000000",
      })
    );
  });
});
