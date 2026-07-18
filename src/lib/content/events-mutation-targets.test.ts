import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mocks.from }),
}));

import {
  resolveEventForAdminMutation,
  resolvePublishedEventForMutation,
} from "@/lib/content/events";

function makeQuery(data: unknown) {
  const query = {
    eq: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
    or: vi.fn(),
    select: vi.fn(),
  };

  query.eq.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  query.or.mockReturnValue(query);
  query.select.mockReturnValue(query);

  return query;
}

const registrationEventRow = {
  ends_at: "2026-12-01T12:00:00.000Z",
  id: "event-1",
  legacy_content_post_id: "legacy-event-1",
  location_label: "JnUITS Lab",
  location_mode: "in_person",
  online_url: null,
  registration_closes_at: "2026-11-30T12:00:00.000Z",
  registration_mode: "internal",
  registration_open: true,
  starts_at: "2026-12-01T10:00:00.000Z",
  status: "published",
  title: "Scale-safe registration",
  venue_address: null,
  venue_name: "JnUITS Lab",
};

describe("event mutation targets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves registration commands without loading event registrations", async () => {
    const eventQuery = makeQuery(registrationEventRow);
    mocks.from.mockImplementation((table: string) => {
      if (table === "events") {
        return eventQuery;
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(resolvePublishedEventForMutation("scale-safe-registration")).resolves.toEqual({
      id: "event-1",
      legacyContentPostId: "legacy-event-1",
      locationLabel: "JnUITS Lab",
      registrationFormVersionId: null,
      registrationClosed: false,
      registrationMode: "internal",
      registrationOpen: true,
      startsAt: "2026-12-01T10:00:00.000Z",
      title: "Scale-safe registration",
    });

    expect(eventQuery.select).toHaveBeenCalledWith(
      "id, legacy_content_post_id, title, starts_at, ends_at, location_label, location_mode, online_url, venue_address, venue_name, registration_mode, registration_open, registration_closes_at"
    );
    expect(mocks.from).toHaveBeenCalledTimes(2);
  });

  it("resolves check-in commands with only canonical and legacy event identifiers", async () => {
    const eventQuery = makeQuery({
      id: "event-2",
      legacy_content_post_id: "legacy-event-2",
    });
    mocks.from.mockImplementation((table: string) => {
      if (table === "events") {
        return eventQuery;
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(resolveEventForAdminMutation("event-2")).resolves.toEqual({
      id: "event-2",
      legacyContentPostId: "legacy-event-2",
    });

    expect(eventQuery.select).toHaveBeenCalledWith("id, legacy_content_post_id");
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });
});
