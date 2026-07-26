import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  admin: { from: vi.fn() },
  requireAdminApiPermission: vi.fn(),
  uploadGoogleSheetSnapshot: vi.fn(),
}));

vi.mock("@/lib/admin/api-auth", () => ({
  requireAdminApiPermission: mocks.requireAdminApiPermission,
}));

vi.mock("@/lib/integrations/google-drive", () => ({
  uploadGoogleSheetSnapshot: mocks.uploadGoogleSheetSnapshot,
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

const FORM_ID = "11111111-1111-4111-8111-111111111111";
const ACTOR_ID = "22222222-2222-4222-8222-222222222222";
const VERSION_ID = "33333333-3333-4333-8333-333333333333";
const PAGE_SIZE = 500;

type Submission = Record<string, unknown>;

let submissionPages: Submission[][] = [];
let rangeCalls: Array<[number, number]> = [];
let submissionFilters: string[] = [];
let inserted: Record<string, Submission[]> = {};

function submission(index: number, answers: Record<string, unknown>): Submission {
  return {
    answers,
    confirmation_status: "confirmed",
    created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, index % 60)).toISOString(),
    form_submission_assets: [],
    form_version_id: VERSION_ID,
    id: `44444444-4444-4444-8444-${String(index).padStart(12, "0")}`,
    review_status: "approved",
    submitter_email: `member-${index}@example.test`,
  };
}

/** `count` approved submissions split into pages the route must walk. */
function pagesOf(count: number) {
  const rows = Array.from({ length: count }, (_unused, index) =>
    submission(index, { full_name: `Member ${index}` })
  );
  const pages: Submission[][] = [];

  for (let from = 0; from < rows.length; from += PAGE_SIZE) {
    pages.push(rows.slice(from, from + PAGE_SIZE));
  }
  // A final short page is what tells the route the scan is complete.
  if (rows.length % PAGE_SIZE === 0) pages.push([]);

  return pages;
}

function request(format = "csv") {
  return new NextRequest(
    `https://jnuits.example.test/api/admin/forms/${FORM_ID}/submissions/export?format=${format}`
  );
}

function params() {
  return { params: Promise.resolve({ formId: FORM_ID }) };
}

function insertedInto(table: string) {
  return inserted[table]?.[0];
}

function resetRecording() {
  rangeCalls = [];
  submissionFilters = [];
  inserted = {};
}

beforeEach(() => {
  vi.clearAllMocks();
  resetRecording();
  submissionPages = pagesOf(1);

  mocks.requireAdminApiPermission.mockResolvedValue({
    auth: { user: { id: ACTOR_ID } },
    response: null,
  });
  mocks.uploadGoogleSheetSnapshot.mockResolvedValue({
    id: "drive-sheet-id",
    reused: false,
    webViewLink: "https://drive.example.test/sheet",
  });

  const formQuery = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: { id: FORM_ID, title: "Membership" },
      error: null,
    }),
    select: vi.fn().mockReturnThis(),
  };

  const submissionsQuery = {
    eq: vi.fn((column: string, value: unknown) => {
      submissionFilters.push(`${column}=${String(value)}`);
      return submissionsQuery;
    }),
    order: vi.fn().mockReturnThis(),
    // Indexed by offset rather than a counter, so calling the route repeatedly
    // in one test does not walk off the end of the fixture.
    range: vi.fn((from: number, to: number) => {
      rangeCalls.push([from, to]);
      return Promise.resolve({ data: submissionPages[from / PAGE_SIZE] ?? [], error: null });
    }),
    select: vi.fn().mockReturnThis(),
  };

  mocks.admin.from.mockImplementation((table: string) => {
    if (table === "form_definitions") return formQuery;
    if (table === "form_submissions") return submissionsQuery;
    return {
      insert: vi.fn((payload: Submission) => {
        (inserted[table] ||= []).push(payload);
        return Promise.resolve({ error: null });
      }),
    };
  });
});

describe("form submission export", () => {
  it("exports only approved submissions and records the checked export", async () => {
    submissionPages = [[submission(0, { full_name: "=formula" })]];

    const response = await GET(request(), params());

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Export-Row-Count")).toBe("1");
    expect(response.headers.get("Content-Type")).toContain("text/csv");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.text()).resolves.toContain("'=formula");
    expect(insertedInto("form_export_jobs")).toBeDefined();
    expect(insertedInto("audit_events")).toBeDefined();
  });

  it("scopes every page to the form and to approved review status", async () => {
    await GET(request(), params());

    expect(submissionFilters).toContain(`form_definition_id=${FORM_ID}`);
    expect(submissionFilters).toContain("review_status=approved");
  });
});

describe("export paging at scale", () => {
  it("walks every page for 1,000 approved submissions", async () => {
    submissionPages = pagesOf(1_000);

    const response = await GET(request(), params());
    const csv = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Export-Row-Count")).toBe("1000");

    // Two full pages plus the short page that ends the scan.
    expect(rangeCalls).toEqual([
      [0, 499],
      [500, 999],
      [1_000, 1_499],
    ]);

    // First, boundary, and last rows all survive into the file.
    expect(csv).toContain("Member 0");
    expect(csv).toContain("Member 499");
    expect(csv).toContain("Member 500");
    expect(csv).toContain("Member 999");
    expect(csv.trimEnd().split("\r\n")).toHaveLength(1_001);
  });

  it("checksums the full export rather than the first page", async () => {
    submissionPages = pagesOf(1_000);
    const large = await GET(request(), params());
    const largeChecksum = large.headers.get("X-Export-Checksum");

    resetRecording();
    submissionPages = pagesOf(500);
    const small = await GET(request(), params());

    expect(largeChecksum).toMatch(/^[a-f0-9]{64}$/);
    expect(small.headers.get("X-Export-Checksum")).not.toBe(largeChecksum);
    expect(insertedInto("form_export_jobs")?.row_count).toBe(500);
  });

  it("refuses to emit a silently truncated export", async () => {
    // Every page comes back full, so the scan can never complete.
    const fullPage = pagesOf(500)[0];
    submissionPages = Array.from({ length: 25 }, () => fullPage);

    const response = await GET(request(), params());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Approved form submissions could not be exported.",
    });
    expect(inserted["form_export_jobs"]).toBeUndefined();
  });
});

describe("spreadsheet formula protection", () => {
  it.each([
    ["equals", "=SUM(A1:A9)"],
    ["plus", "+1+1"],
    ["minus", "-1-1"],
    ["at", "@SUM(A1)"],
    ["tab", "\t=cmd"],
    ["carriage return", "\r=cmd"],
    ["leading whitespace", "   =cmd"],
  ])("neutralises a %s prefix", async (_label, dangerous) => {
    submissionPages = [[submission(0, { full_name: dangerous })]];

    const csv = await (await GET(request(), params())).text();

    expect(csv).toContain(`'${dangerous}`);
  });

  it("leaves ordinary values untouched", async () => {
    submissionPages = [[submission(0, { full_name: "Redwan Ahmed", note: "1 - 2" })]];

    const csv = await (await GET(request(), params())).text();

    expect(csv).toContain("Redwan Ahmed");
    expect(csv).not.toContain("'Redwan");
  });
});

describe("Unicode preservation", () => {
  it("round-trips Bangla answers and keeps the BOM for spreadsheet readers", async () => {
    submissionPages = [
      [submission(0, { department: "কম্পিউটার সায়েন্স", full_name: "মোঃ রেদওয়ান আহমেদ" })],
    ];

    const response = await GET(request(), params());
    const bytes = new Uint8Array(await response.arrayBuffer());
    const csv = new TextDecoder().decode(bytes);

    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(csv).toContain("মোঃ রেদওয়ান আহমেদ");
    expect(csv).toContain("কম্পিউটার সায়েন্স");
  });
});

describe("Google Sheet snapshot idempotency", () => {
  it("sends a content-addressed key so a repeat reuses one Drive file", async () => {
    await GET(request("google-sheet"), params());

    const [call] = mocks.uploadGoogleSheetSnapshot.mock.calls;
    expect(call[0].idempotencyKey).toMatch(
      new RegExp(`^form-export:${FORM_ID}:google-sheet:[a-f0-9]{64}$`)
    );
  });

  it("reuses the key for identical data and changes it when rows change", async () => {
    submissionPages = pagesOf(3);
    await GET(request("google-sheet"), params());
    await GET(request("google-sheet"), params());

    submissionPages = pagesOf(4);
    await GET(request("google-sheet"), params());

    const [first, repeat, changed] = mocks.uploadGoogleSheetSnapshot.mock.calls.map(
      (call) => call[0].idempotencyKey
    );

    expect(repeat).toBe(first);
    expect(changed).not.toBe(first);
  });

  it("records a reused snapshot honestly in the audit metadata", async () => {
    mocks.uploadGoogleSheetSnapshot.mockResolvedValue({
      id: "drive-sheet-id",
      reused: true,
      webViewLink: "https://drive.example.test/sheet",
    });

    const response = await GET(request("google-sheet"), params());

    expect(response.status).toBe(200);
    expect(insertedInto("audit_events")?.metadata).toMatchObject({
      destination: "google_sheet",
      format: "google-sheet",
      google_drive_file_id: "drive-sheet-id",
      reused_snapshot: true,
    });
  });
});

describe("export audit evidence", () => {
  it("records actor, format, filter, row count, and checksum", async () => {
    submissionPages = pagesOf(7);

    const response = await GET(request(), params());
    const checksum = response.headers.get("X-Export-Checksum");

    expect(insertedInto("form_export_jobs")).toMatchObject({
      checksum_sha256: checksum,
      destination: "download",
      filter_metadata: { review_status: "approved", schema_version: 1 },
      form_definition_id: FORM_ID,
      format: "csv",
      requested_by_user_id: ACTOR_ID,
      row_count: 7,
      status: "completed",
    });
    expect(insertedInto("audit_events")).toMatchObject({
      action: "form.submissions_exported",
      actor_user_id: ACTOR_ID,
      entity_id: FORM_ID,
      entity_type: "form_definition",
    });
  });

  it("never returns the file when the export job cannot be recorded", async () => {
    mocks.admin.from.mockImplementation((table: string) => {
      if (table === "form_definitions") {
        return {
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: FORM_ID, title: "Membership" }, error: null }),
          select: vi.fn().mockReturnThis(),
        };
      }
      if (table === "form_submissions") {
        return {
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: vi.fn().mockResolvedValue({ data: [submission(0, { full_name: "Member" })], error: null }),
          select: vi.fn().mockReturnThis(),
        };
      }
      return { insert: vi.fn().mockResolvedValue({ error: { message: "ledger unavailable" } }) };
    });

    const response = await GET(request(), params());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "The export audit record could not be saved.",
    });
  });
});
