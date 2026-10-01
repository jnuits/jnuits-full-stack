import { describe, expect, it, vi } from "vitest";

import { MAX_INTAKE_DATA_ROWS } from "./intake-contracts";
import {
  fetchPublicGoogleSheetSnapshot,
  GoogleSheetSnapshotError,
  parsePublicGoogleSheetUrl,
} from "./google-sheet";

const documentId = "test-sheet-document-123";
const sourceUrl = `https://docs.google.com/spreadsheets/d/${documentId}/edit?usp=sharing`;

function fetchMock(...responses: Response[]) {
  const mock = vi.fn();
  for (const response of responses) mock.mockResolvedValueOnce(response);
  return mock;
}

describe("public Google Sheet source URLs", () => {
  it.each([
    `http://docs.google.com/spreadsheets/d/${documentId}/edit`,
    `https://example.com/spreadsheets/d/${documentId}/edit`,
    `https://docs.google.com.evil.example/spreadsheets/d/${documentId}/edit`,
    `https://docs.google.com%2eevil.example/spreadsheets/d/${documentId}/edit`,
    `https://user:secret@docs.google.com/spreadsheets/d/${documentId}/edit`,
    `https://docs.google.com:444/spreadsheets/d/${documentId}/edit`,
    `https://docs.google.com/spreadsheets/u/0/d/${documentId}/edit`,
    `https://docs.google.com/spreadsheets/d/${documentId}/edit#section=private`,
  ])("rejects unsafe or unsupported URL %s", (input) => {
    expect(() => parsePublicGoogleSheetUrl(input)).toThrow(GoogleSheetSnapshotError);
  });

  it("accepts standard edit/share links and defaults to the first sheet", () => {
    expect(parsePublicGoogleSheetUrl(sourceUrl)).toEqual({
      documentId,
      gid: "0",
    });
  });

  it("accepts one explicit numeric gid from the query or standard hash", () => {
    expect(
      parsePublicGoogleSheetUrl(
        `https://docs.google.com/spreadsheets/d/${documentId}/view?gid=271828&usp=sharing`
      )
    ).toEqual({ documentId, gid: "271828" });
    expect(
      parsePublicGoogleSheetUrl(
        `https://docs.google.com/spreadsheets/d/${documentId}/edit#gid=314159`
      )
    ).toEqual({ documentId, gid: "314159" });
  });

  it("rejects duplicate, conflicting, and non-numeric gids", () => {
    expect(() =>
      parsePublicGoogleSheetUrl(`${sourceUrl}&gid=1&gid=2`)
    ).toThrow(GoogleSheetSnapshotError);
    expect(() =>
      parsePublicGoogleSheetUrl(
        `https://docs.google.com/spreadsheets/d/${documentId}/edit?gid=1#gid=2`
      )
    ).toThrow(GoogleSheetSnapshotError);
    expect(() =>
      parsePublicGoogleSheetUrl(
        `https://docs.google.com/spreadsheets/d/${documentId}/edit?gid=not-a-number`
      )
    ).toThrow(GoogleSheetSnapshotError);
  });
});

describe("public Google Sheet snapshots", () => {
  it("downloads CSV through the internally constructed export URL and returns sanitized provenance", async () => {
    const body = "Full Name,JnUITS ID\nMember One,JNUITS-2026001\n";
    const mock = fetchMock(
      new Response(body, { headers: { "content-type": "text/csv; charset=utf-8" } })
    );

    const snapshot = await fetchPublicGoogleSheetSnapshot(
      parsePublicGoogleSheetUrl(`${sourceUrl}&gid=42`),
      { fetchImpl: mock as unknown as typeof fetch, now: () => new Date("2026-09-30T04:00:00.000Z") }
    );

    expect(mock).toHaveBeenCalledWith(
      `https://docs.google.com/spreadsheets/d/${documentId}/export?format=csv&gid=42`,
      expect.objectContaining({ redirect: "manual", signal: expect.any(AbortSignal) })
    );
    expect(snapshot).toEqual({
      bytes: Buffer.from(body),
      contentType: "text/csv; charset=utf-8",
      documentId,
      fetchedAt: "2026-09-30T04:00:00.000Z",
      sha256: "8442b15006d4dd12b5b7d2f54b01149a479f0b747c99dddf09f9475b6645fa17",
      sheetId: "42",
    });
    expect(JSON.stringify(snapshot)).not.toContain(sourceUrl);
  });

  it.each([403, 404, 500])("returns a safe unavailable error for HTTP %s", async (status) => {
    const mock = fetchMock(new Response("private details", { status }));

    await expect(
      fetchPublicGoogleSheetSnapshot(parsePublicGoogleSheetUrl(sourceUrl), {
        fetchImpl: mock as unknown as typeof fetch,
      })
    ).rejects.toMatchObject({ code: "sheet_unavailable" });
    await expect(
      fetchPublicGoogleSheetSnapshot(parsePublicGoogleSheetUrl(sourceUrl), {
        fetchImpl: fetchMock(new Response("another secret", { status })) as unknown as typeof fetch,
      })
    ).rejects.not.toThrow(/private details|another secret/i);
  });

  it("aborts a stalled request after the configured timeout", async () => {
    const mock = vi.fn(
      () => new Promise<Response>(() => undefined)
    );

    await expect(
      fetchPublicGoogleSheetSnapshot(parsePublicGoogleSheetUrl(sourceUrl), {
        fetchImpl: mock as unknown as typeof fetch,
        timeoutMs: 5,
      })
    ).rejects.toMatchObject({ code: "request_timeout" });
  });

  it("rejects non-CSV responses", async () => {
    const mock = fetchMock(
      new Response("<html>sign in</html>", {
        headers: { "content-type": "text/html; charset=utf-8" },
      })
    );

    await expect(
      fetchPublicGoogleSheetSnapshot(parsePublicGoogleSheetUrl(sourceUrl), {
        fetchImpl: mock as unknown as typeof fetch,
      })
    ).rejects.toMatchObject({ code: "invalid_content_type" });
  });

  it("stops while streaming when the response exceeds the byte limit", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.enqueue(new Uint8Array([4, 5, 6]));
        controller.close();
      },
    });
    const mock = fetchMock(
      new Response(body, { headers: { "content-type": "text/csv" } })
    );

    await expect(
      fetchPublicGoogleSheetSnapshot(parsePublicGoogleSheetUrl(sourceUrl), {
        fetchImpl: mock as unknown as typeof fetch,
        maxBytes: 5,
      })
    ).rejects.toMatchObject({ code: "source_too_large" });
  });

  it("enforces the existing maximum data-row count", async () => {
    const rows = Array.from(
      { length: MAX_INTAKE_DATA_ROWS + 1 },
      (_, index) => `Member ${index},JNUITS-${String(index).padStart(7, "0")}`
    );
    const mock = fetchMock(
      new Response(["Full Name,JnUITS ID", ...rows].join("\n"), {
        headers: { "content-type": "text/csv" },
      })
    );

    await expect(
      fetchPublicGoogleSheetSnapshot(parsePublicGoogleSheetUrl(sourceUrl), {
        fetchImpl: mock as unknown as typeof fetch,
      })
    ).rejects.toMatchObject({ code: "too_many_rows" });
  });

  it("follows a bounded redirect chain only across allowlisted Google hosts", async () => {
    const redirected = "https://doc-01-sheets.googleusercontent.com/export/result";
    const mock = fetchMock(
      new Response(null, { headers: { location: redirected }, status: 302 }),
      new Response("Full Name,JnUITS ID\nMember One,JNUITS-2026001", {
        headers: { "content-type": "text/csv" },
      })
    );

    await expect(
      fetchPublicGoogleSheetSnapshot(parsePublicGoogleSheetUrl(sourceUrl), {
        fetchImpl: mock as unknown as typeof fetch,
      })
    ).resolves.toMatchObject({ documentId, sheetId: "0" });
    expect(mock).toHaveBeenNthCalledWith(
      2,
      redirected,
      expect.objectContaining({ redirect: "manual" })
    );
  });

  it("rejects redirect loops", async () => {
    const exportUrl = `https://docs.google.com/spreadsheets/d/${documentId}/export?format=csv&gid=0`;
    const mock = fetchMock(
      new Response(null, { headers: { location: exportUrl }, status: 302 })
    );

    await expect(
      fetchPublicGoogleSheetSnapshot(parsePublicGoogleSheetUrl(sourceUrl), {
        fetchImpl: mock as unknown as typeof fetch,
      })
    ).rejects.toMatchObject({ code: "redirect_loop" });
  });

  it("rejects redirects to non-allowlisted hosts", async () => {
    const mock = fetchMock(
      new Response(null, {
        headers: { location: "https://attacker.example/export.csv" },
        status: 302,
      })
    );

    await expect(
      fetchPublicGoogleSheetSnapshot(parsePublicGoogleSheetUrl(sourceUrl), {
        fetchImpl: mock as unknown as typeof fetch,
      })
    ).rejects.toMatchObject({ code: "unsafe_redirect" });
  });

  it.each([
    'Full name,Email\n"private-marker"unexpected,sample@example.com',
    'private-marker,private-marker\nSample,Value',
  ])("does not echo remotely fetched cells or headings in parse failures", async (csv) => {
    const mock = fetchMock(new Response(csv, { headers: { "content-type": "text/csv" } }));
    const error = await fetchPublicGoogleSheetSnapshot(parsePublicGoogleSheetUrl(sourceUrl), {
      fetchImpl: mock as unknown as typeof fetch,
    }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).not.toContain("private-marker");
    expect((error as Error).message).toMatch(/CSV.*(headings|quotes)/i);
  });
});
