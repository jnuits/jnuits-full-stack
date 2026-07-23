import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  publicFrom: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mocks.from, rpc: mocks.rpc }),
}));
vi.mock("@/lib/supabase/public", () => ({
  createPublicClient: () => ({ from: mocks.publicFrom }),
}));

import { getAdminEventsDashboard, getPublicEventsPage } from "@/lib/content/events";

type QueryResult = {
  count?: number | null;
  data: unknown;
  error: { message: string } | null;
};

function makeQuery(result: QueryResult) {
  const query = {
    eq: vi.fn(),
    limit: vi.fn(),
    or: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    then: (
      onfulfilled?: (value: QueryResult) => unknown,
      onrejected?: (reason: unknown) => unknown
    ) => Promise.resolve(result).then(onfulfilled, onrejected),
  };

  query.eq.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  query.or.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.range.mockReturnValue(query);
  query.select.mockReturnValue(query);

  return query;
}

const eventRow = {
  body_markdown: "Network workshop agenda",
  capacity: 3,
  category: "workshop-training",
  cover_alt_text_override: null,
  cover_media_asset_id: null,
  created_at: "2026-01-01T00:00:00.000Z",
  created_by_user_id: null,
  cta_label: null,
  cta_url: null,
  delivery_mode: "offline",
  ends_at: "2099-01-02T10:00:00.000Z",
  id: "event-1",
  legacy_content_post_id: "legacy-event-1",
  location_label: "JnUITS Lab",
  location_mode: "venue",
  media_assets: null,
  online_url: null,
  published_at: "2026-01-01T00:00:00.000Z",
  registration_closes_at: null,
  registration_mode: "internal",
  registration_open: true,
  registration_url: null,
  slug: "network-workshop",
  source: "manual",
  source_metadata: {},
  starts_at: "2099-01-02T08:00:00.000Z",
  status: "published",
  summary: "A hands-on network workshop",
  timezone: "Asia/Dhaka",
  title: "Network workshop",
  updated_at: "2026-01-01T00:00:00.000Z",
  venue_address: null,
  venue_name: "JnUITS Lab",
};

describe("event query bounds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("pages the admin queue in the database and obtains registration counts from one aggregate RPC", async () => {
    const totalQuery = makeQuery({ count: 25, data: null, error: null });
    const draftQuery = makeQuery({ count: 4, data: null, error: null });
    const pastQuery = makeQuery({ count: 7, data: null, error: null });
    const upcomingQuery = makeQuery({ count: 18, data: null, error: null });
    const pageQuery = makeQuery({
      count: 25,
      data: [eventRow],
      error: null,
    });
    const queries = [
      totalQuery,
      draftQuery,
      pastQuery,
      upcomingQuery,
      pageQuery,
    ];

    mocks.from.mockImplementation((table: string) => {
      if (table !== "events") {
        throw new Error(`Unexpected table: ${table}`);
      }

      const query = queries.shift();

      if (!query) {
        throw new Error("Unexpected extra events query");
      }

      return query;
    });
    mocks.rpc.mockResolvedValue({
      data: [{ event_id: "event-1", registration_count: 3 }],
      error: null,
    });

    await expect(
      getAdminEventsDashboard({
        category: "workshop-training",
        page: 2,
        query: "network",
        status: "published",
        timeframe: "upcoming",
      })
    ).resolves.toMatchObject({
      items: [{ id: "event-1", registrationState: "full" }],
      metrics: { drafts: 4, past: 7, total: 25, upcoming: 18 },
      page: 2,
      totalItems: 25,
      totalPages: 3,
    });

    expect(pageQuery.select).toHaveBeenCalledWith(
      expect.any(String),
      { count: "exact" }
    );
    expect(pageQuery.order).toHaveBeenNthCalledWith(1, "starts_at", {
      ascending: false,
    });
    expect(pageQuery.order).toHaveBeenNthCalledWith(2, "id", {
      ascending: false,
    });
    expect(pageQuery.range).toHaveBeenCalledWith(12, 23);
    expect(pageQuery.eq).toHaveBeenCalledWith("status", "published");
    expect(pageQuery.eq).toHaveBeenCalledWith("category", "workshop-training");
    expect(pageQuery.or).toHaveBeenCalled();
    expect(totalQuery.select).toHaveBeenCalledWith("id", {
      count: "exact",
      head: true,
    });
    expect(mocks.rpc).toHaveBeenCalledWith("get_event_registration_counts", {
      p_event_ids: ["event-1"],
    });
    expect(mocks.from).toHaveBeenCalledTimes(5);
  });
  it("fails closed when the registration aggregate cannot be read", async () => {
    const queries = [
      makeQuery({ count: 1, data: null, error: null }),
      makeQuery({ count: 0, data: null, error: null }),
      makeQuery({ count: 0, data: null, error: null }),
      makeQuery({ count: 1, data: null, error: null }),
      makeQuery({ count: 1, data: [eventRow], error: null }),
    ];

    mocks.from.mockImplementation((table: string) => {
      if (table !== "events") {
        throw new Error(`Unexpected table: ${table}`);
      }

      const query = queries.shift();

      if (!query) {
        throw new Error("Unexpected extra events query");
      }

      return query;
    });
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "aggregate unavailable" },
    });

    await expect(getAdminEventsDashboard()).rejects.toThrow(
      "Event registration count lookup failed: aggregate unavailable"
    );
  });

  it("stably orders and paginates the public archive without loading registration rows", async () => {
    const categoryQuery = makeQuery({
      data: [{ category: "workshop-training" }],
      error: null,
    });
    const categoryCountsQuery = makeQuery({
      data: [{ category: "workshop-training" }],
      error: null,
    });
    const featuredQuery = makeQuery({ data: eventRow, error: null });
    const pageQuery = makeQuery({
      count: 25,
      data: [eventRow],
      error: null,
    });
    const queries = [
      categoryQuery,
      categoryCountsQuery,
      featuredQuery,
      pageQuery,
    ];

    mocks.publicFrom.mockImplementation((table: string) => {
      if (table !== "events") {
        throw new Error(`Unexpected table: ${table}`);
      }

      const query = queries.shift();

      if (!query) {
        throw new Error("Unexpected extra events query");
      }

      return query;
    });
    mocks.rpc.mockResolvedValue({
      data: [{ event_id: "event-1", registration_count: 3 }],
      error: null,
    });

    await expect(getPublicEventsPage({ page: 2 })).resolves.toMatchObject({
      items: [{ id: "event-1", registrationState: "full" }],
      page: 2,
      totalItems: 25,
      totalPages: 3,
      view: "upcoming",
    });

    expect(featuredQuery.order).toHaveBeenNthCalledWith(1, "starts_at", {
      ascending: true,
    });
    expect(featuredQuery.order).toHaveBeenNthCalledWith(2, "id", {
      ascending: true,
    });
    expect(featuredQuery.limit).toHaveBeenCalledWith(1);
    expect(pageQuery.order).toHaveBeenNthCalledWith(1, "starts_at", {
      ascending: true,
    });
    expect(pageQuery.order).toHaveBeenNthCalledWith(2, "id", {
      ascending: true,
    });
    expect(pageQuery.range).toHaveBeenCalledWith(12, 23);
    expect(mocks.publicFrom).toHaveBeenCalledTimes(4);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("renders an empty public archive when the content backend is unavailable", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const unavailableQuery = makeQuery({
      data: null,
      error: { message: "backend unavailable" },
    });

    mocks.publicFrom.mockReturnValue(unavailableQuery);

    try {
      await expect(
        getPublicEventsPage({ page: 4, view: "past" })
      ).resolves.toEqual({
        categories: [],
        categoryCounts: [],
        featuredEvent: null,
        items: [],
        page: 1,
        totalItems: 0,
        totalPages: 1,
        view: "past",
      });

      expect(consoleError).toHaveBeenCalledWith(
        "Public event archive unavailable: Featured event lookup failed: backend unavailable"
      );
      expect(mocks.rpc).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });
});
