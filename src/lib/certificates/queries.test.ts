import { beforeEach, describe, expect, it, vi } from "vitest";

type QueryError = { code?: string; message?: string };
type QueryResult = { data: unknown; error: QueryError | null };

const createPublicClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/public", () => ({
  createPublicClient: createPublicClientMock,
}));

function makePublicClient(responses: Record<string, QueryResult[]>) {
  const fromCalls: string[] = [];

  return {
    client: {
      from: vi.fn((table: string) => {
        fromCalls.push(table);
        const response = responses[table]?.shift() ?? {
          data: null,
          error: null,
        };

        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => response),
            })),
            in: vi.fn(async () => response),
          })),
        };
      }),
    },
    fromCalls,
  };
}

async function importQueries() {
  vi.resetModules();
  const queries = await import("@/lib/certificates/queries");
  queries.resetPublicCertificateViewCacheForTests();
  return queries;
}

describe("public certificate queries", () => {
  beforeEach(() => {
    createPublicClientMock.mockReset();
  });

  it("uses the public certificate view when it is available", async () => {
    const certificate = {
      asset_url: "https://example.test/cert.pdf",
      certificate_id: "CERT-1",
      details: "Completed",
      exam_or_event: "Event",
      exam_or_event_name: "Workshop",
      full_name: "Ayesha Rahman",
      issue_date: "2026-01-02",
    };
    const supabase = makePublicClient({
      public_certificates: [{ data: certificate, error: null }],
    });
    createPublicClientMock.mockReturnValue(supabase.client);
    const { findCertificateById } = await importQueries();

    await expect(findCertificateById(" cert-1 ")).resolves.toEqual(certificate);
    expect(supabase.fromCalls).toEqual(["public_certificates"]);
  });

  it("falls back to certificates and caches a missing view briefly", async () => {
    const missingView = {
      code: "PGRST205",
      message:
        "Could not find the table 'public.public_certificates' in the schema cache",
    };
    const fallbackCertificate = {
      asset_url: null,
      certificate_id: "CERT-2",
      details: "Completed",
      exam_or_event: "Exam",
      exam_or_event_name: "Final",
      full_name: "Nadia Islam",
      issue_date: "2026-02-01",
    };
    const supabase = makePublicClient({
      public_certificates: [{ data: null, error: missingView }],
      certificates: [
        { data: fallbackCertificate, error: null },
        { data: fallbackCertificate, error: null },
      ],
    });
    createPublicClientMock.mockReturnValue(supabase.client);
    const { findCertificateById } = await importQueries();

    await expect(findCertificateById("cert-2")).resolves.toEqual(fallbackCertificate);
    await expect(findCertificateById("cert-2")).resolves.toEqual(fallbackCertificate);
    expect(supabase.fromCalls).toEqual([
      "public_certificates",
      "certificates",
      "certificates",
    ]);
  });

  it("does not fall back on non-view errors", async () => {
    const supabase = makePublicClient({
      public_certificates: [
        {
          data: null,
          error: { code: "PGRST301", message: "permission denied" },
        },
      ],
    });
    createPublicClientMock.mockReturnValue(supabase.client);
    const { findCertificateById } = await importQueries();

    await expect(findCertificateById("cert-3")).rejects.toMatchObject({
      code: "PGRST301",
    });
    expect(supabase.fromCalls).toEqual(["public_certificates"]);
  });

  it("uses the public view for batch lookups", async () => {
    const certificate = {
      asset_url: null,
      certificate_id: "CERT-4",
      details: "Completed",
      exam_or_event: "Event",
      exam_or_event_name: "Workshop",
      full_name: "Rafi Ahmed",
      issue_date: "2026-03-01",
    };
    const supabase = makePublicClient({
      public_certificates: [{ data: [certificate], error: null }],
    });
    createPublicClientMock.mockReturnValue(supabase.client);
    const { findCertificatesByIds } = await importQueries();

    await expect(findCertificatesByIds(["cert-4", "CERT-4"])).resolves.toEqual([
      certificate,
    ]);
    expect(supabase.fromCalls).toEqual(["public_certificates"]);
  });
});
