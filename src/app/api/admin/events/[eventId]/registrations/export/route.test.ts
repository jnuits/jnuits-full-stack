import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  admin: { from: vi.fn() },
  hasPermission: vi.fn(),
  requireAdminApiPermission: vi.fn(),
  resolveEventForAdminMutation: vi.fn(),
}));

vi.mock("@/lib/admin/api-auth", () => ({
  requireAdminApiPermission: mocks.requireAdminApiPermission,
}));

vi.mock("@/lib/auth/session", () => ({
  hasPermission: mocks.hasPermission,
}));

vi.mock("@/lib/content/events", () => ({
  resolveEventForAdminMutation: mocks.resolveEventForAdminMutation,
}));

vi.mock("@/lib/integrations/google-drive", () => ({
  uploadGoogleSheetSnapshot: vi.fn(),
}));

vi.mock("@/lib/security/with-api-guard", () => ({
  withApiGuard: <T>(handler: T) => handler,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mocks.admin,
}));

vi.mock("@/lib/supabase/flexible", () => ({
  asFlexibleClient: <T>(client: T) => client,
}));

import { GET } from "./route";

const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const ACTOR_ID = "22222222-2222-4222-8222-222222222222";
const PAGE_SIZE = 500;

let failAtOffset: number | null;
let inserted: Record<string, Record<string, unknown>[]>;
let rangeCalls: Array<[number, number]>;
let totalRows: number;

function registration(index: number) {
  return {
    cancelled_at: null,
    checked_in_at: null,
    created_at: "2026-09-01T00:00:00.000Z",
    form_submissions: null,
    promoted_at: null,
    registration_code: `REG-${String(index).padStart(6, "0")}`,
    registration_status: "confirmed",
    registrant_email: `member-${index}@example.test`,
    registrant_name: `Member ${index}`,
    registrant_phone: null,
    waitlisted_at: null,
  };
}

function request() {
  return new NextRequest(
    `https://jnuits.example.test/api/admin/events/${EVENT_ID}/registrations/export?format=csv`,
  );
}

function registrationQuery() {
  const query = {
    count: totalRows,
    eq: vi.fn().mockReturnThis(),
    error: null,
    is: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn((from: number, to: number) => {
      rangeCalls.push([from, to]);
      if (from === failAtOffset) {
        return Promise.resolve({ data: null, error: { message: "database unavailable" } });
      }
      const length = Math.min(to - from + 1, Math.max(totalRows - from, 0));
      return Promise.resolve({
        data: Array.from({ length }, (_unused, offset) => registration(from + offset)),
        error: null,
      });
    }),
    select: vi.fn().mockReturnThis(),
  };
  return query;
}

beforeEach(() => {
  vi.clearAllMocks();
  failAtOffset = null;
  inserted = {};
  rangeCalls = [];
  totalRows = 1;

  mocks.requireAdminApiPermission.mockResolvedValue({
    auth: { user: { id: ACTOR_ID } },
    response: null,
  });
  mocks.hasPermission.mockResolvedValue(true);
  mocks.resolveEventForAdminMutation.mockResolvedValue({
    id: EVENT_ID,
    legacyContentPostId: null,
  });
  mocks.admin.from.mockImplementation((table: string) => {
    if (table === "event_registrations") return registrationQuery();
    return {
      insert: vi.fn((payload: Record<string, unknown>) => {
        (inserted[table] ||= []).push(payload);
        return Promise.resolve({ error: null });
      }),
    };
  });
});

describe("event registration CSV export", () => {
  it("records evidence before returning a complete CSV", async () => {
    const response = await GET(request(), {
      params: Promise.resolve({ eventId: EVENT_ID }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/csv");
    expect(response.headers.get("X-Export-Checksum")).toMatch(/^[a-f0-9]{64}$/);
    expect(response.headers.get("X-Export-Row-Count")).toBe("1");
    await expect(response.text()).resolves.toContain("Member 0");
    expect(inserted.event_export_jobs).toHaveLength(1);
    expect(inserted.audit_events).toHaveLength(1);
  });

  it("returns an error before exposing a file when a later page fails", async () => {
    totalRows = PAGE_SIZE + 1;
    failAtOffset = PAGE_SIZE;

    const response = await GET(request(), {
      params: Promise.resolve({ eventId: EVENT_ID }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Event registrations could not be exported.",
    });
    expect(rangeCalls).toEqual([
      [0, PAGE_SIZE - 1],
      [PAGE_SIZE, PAGE_SIZE],
    ]);
    expect(inserted.event_export_jobs).toBeUndefined();
    expect(inserted.audit_events).toBeUndefined();
  });
});
