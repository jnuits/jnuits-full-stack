import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FlexibleSupabaseClient } from "@/lib/supabase/flexible";

const mocks = vi.hoisted(() => ({
  uploadGoogleDriveFile: vi.fn(),
}));

vi.mock("@/lib/integrations/google-drive", () => ({
  isGoogleDriveExportConfigured: () => true,
  uploadGoogleDriveFile: mocks.uploadGoogleDriveFile,
}));

import { RetentionWorkflowError, runRetentionAction } from "./operations";
import { signRetentionArchiveManifest, serializeRetentionArchiveManifest } from "./archive";
import { sha256 } from "@/lib/exports/tabular";

const ACTOR = "11111111-1111-4111-8111-111111111111";
const JOB_ID = "22222222-2222-4222-8222-222222222222";
const ATTEMPT_ID = "33333333-3333-4333-8333-333333333333";
const NOW = new Date("2026-07-26T00:00:00.000Z");
const BOUNDARY = "2023-07-26T00:00:00.000Z";
const PAGE_SIZE = 500;

type QueryResult = { data?: unknown; error?: unknown };
type Call = {
  filters: string[];
  op: "insert" | "select" | "update";
  payload?: unknown;
  table: string;
};
type Handler = (call: Call) => QueryResult;
type Chain = {
  eq: (column: string, value: unknown) => Chain;
  in: (column: string, value: unknown) => Chain;
  lte: (column: string, value: unknown) => Chain;
  maybeSingle: () => Promise<QueryResult>;
  or: (filter: string) => Chain;
  order: (column: string, options?: unknown) => Chain;
  range: (from: number, to: number) => Chain;
  select: (columns?: string) => Chain;
  single: () => Promise<QueryResult>;
  then: <T>(resolve: (value: QueryResult) => T) => Promise<T>;
};

/**
 * Minimal PostgREST-shaped double. It records the filters each statement built
 * so tests can assert on the boundary predicate and on the status guards that
 * protect every transition.
 */
function createAdmin(handler: Handler) {
  const calls: Call[] = [];

  function chainFor(call: Call): Chain {
    const settle = () => Promise.resolve({ error: null, ...handler(call) });
    const chain: Chain = {
      eq: (column, value) => { call.filters.push(`eq:${column}=${String(value)}`); return chain; },
      in: (column, value) => { call.filters.push(`in:${column}=${JSON.stringify(value)}`); return chain; },
      lte: (column, value) => { call.filters.push(`lte:${column}=${String(value)}`); return chain; },
      maybeSingle: settle,
      or: (filter) => { call.filters.push(`or:${filter}`); return chain; },
      order: () => chain,
      range: (from, to) => { call.filters.push(`range:${from}-${to}`); return chain; },
      select: (columns) => { if (columns) call.filters.push(`select:${columns}`); return chain; },
      single: settle,
      then: (resolve) => settle().then(resolve),
    };
    return chain;
  }

  function record(table: string, op: Call["op"], payload?: unknown) {
    const call: Call = { filters: [], op, payload, table };
    calls.push(call);
    return chainFor(call);
  }

  const rpc = vi.fn().mockImplementation(async (name: string, args: {p_payload: {stage: string}}) => {
    if (name !== "complete_admin_retention_operation") throw new Error(`Unexpected unverified RPC: ${name}`);
    const value = args.p_payload.stage === "archive_start" || args.p_payload.stage === "archive_failed" ? null
      : args.p_payload.stage === "discover" ? {success: true, boundary: BOUNDARY, created: 0, formCreated: 0, eventCreated: 0} : {success: true};
    return {data: {ok: true, value}, error: null};
  });
  const admin = {
    from: (table: string) => ({
      insert: (payload: unknown) => record(table, "insert", payload),
      select: (columns?: string) => record(table, "select").select(columns),
      update: (payload: unknown) => record(table, "update", payload),
    }),
    rpc,
  };

  return { admin: admin as unknown as FlexibleSupabaseClient, calls, rpc };
}

function filterFor(calls: Call[], table: string, prefix: string) {
  return calls
    .filter((call) => call.table === table)
    .flatMap((call) => call.filters)
    .find((filter) => filter.startsWith(prefix));
}

function pageReads(calls: Call[], table: string) {
  return calls.filter(
    (call) => call.table === table && call.filters.some((filter) => filter.startsWith("range:"))
  );
}

function completionStep(rpc: ReturnType<typeof vi.fn>, stage: string) {
  return rpc.mock.calls.map(([,args]) => args?.p_payload as Record<string, unknown>).find(payload => payload?.stage === stage);
}

function eventPage(size: number) {
  return Array.from({ length: size }, (_unused, index) => ({
    ends_at: "2022-01-01T00:00:00.000Z",
    id: `event-${index}`,
    starts_at: "2022-01-01T00:00:00.000Z",
  }));
}

const oldSubmission = {
  answers: { full_name: "Old Person" },
  confirmation_status: "confirmed",
  created_at: "2022-01-01T00:00:00.000Z",
  form_submission_assets: [],
  form_version_id: "version-1",
  id: "submission-old",
  review_status: "approved",
  submitter_email: "old@example.test",
};

function formJobRow(status = "candidate") {
  const archive = status === "archived" ? signRetentionArchiveManifest({archivedAt: NOW.toISOString(), assetReferences: [], boundary: BOUNDARY,
    files: [{bytes: 1, id: "fictional-file", name: "archive.csv", sha256: "a".repeat(64)}], resourceId: "form-1", rowCount: 1, scope: "form"}) : null;
  return {
    created_at: "2021-01-01T00:00:00.000Z",
    form_definition_id: "form-1",
    id: JOB_ID,
    retention_eligible_at: "2025-01-01T00:00:00.000Z",
    status,
    ...(archive ? {archive_manifest: archive, manifest_checksum_sha256: sha256(Buffer.from(serializeRetentionArchiveManifest(archive)))} : {}),
  };
}

function archiveHandler(options: {
  jobStatus?: string;
  submissionError?: unknown;
  transitionRows?: unknown[];
} = {}): Handler {
  return (call) => {
    if (call.table === "form_archive_jobs" && call.op === "select") {
      return { data: formJobRow(options.jobStatus) };
    }
    if (call.table === "form_archive_jobs" && call.op === "update") {
      return { data: options.transitionRows ?? [{ id: JOB_ID }] };
    }
    if (call.table === "form_submissions") {
      return options.submissionError
        ? { data: null, error: options.submissionError }
        : { data: [oldSubmission] };
    }
    return { data: [] };
  };
}

function archiveForm(admin: FlexibleSupabaseClient) {
  return runRetentionAction(admin, {
    action: "archive",
    actorUserId: ACTOR,
    jobId: JOB_ID,
    scope: "form",
  }, ATTEMPT_ID);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  process.env.RETENTION_MANIFEST_SIGNING_SECRET = "test-only-retention-secret";
  mocks.uploadGoogleDriveFile.mockImplementation(({ filename }: { filename: string }) =>
    Promise.resolve({ id: `drive-${filename}`, reused: false, webViewLink: null })
  );
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.RETENTION_MANIFEST_SIGNING_SECRET;
});

describe("retention archive boundary", () => {
  it("refuses a workflow without a reserved operation before reads, writes, or uploads", async () => {
    const { admin, calls } = createAdmin(archiveHandler());
    // @ts-expect-error A legacy caller must also fail closed at runtime.
    await expect(runRetentionAction(admin, { action: "archive", actorUserId: ACTOR, jobId: JOB_ID, scope: "form" })).rejects.toThrow(/reserved|verification/i);
    expect(calls).toEqual([]);
    expect(mocks.uploadGoogleDriveFile).not.toHaveBeenCalled();
  });
  it("selects only rows at or before the three-year boundary", async () => {
    const { admin, calls } = createAdmin(archiveHandler());

    const result = await archiveForm(admin);

    expect(result).toMatchObject({ boundary: BOUNDARY, success: true });
    expect(filterFor(calls, "form_submissions", "lte:created_at")).toBe(`lte:created_at=${BOUNDARY}`);
    expect(filterFor(calls, "form_submissions", "eq:form_definition_id")).toBe("eq:form_definition_id=form-1");
  });

  it("seals the boundary into the signed manifest so purge cannot widen it", async () => {
    const { admin, rpc } = createAdmin(archiveHandler());

    await archiveForm(admin);

    const completion = completionStep(rpc, "archive_complete");
    const manifest = (completion?.bundle as {manifest: {manifest: {boundary: string; schemaVersion: number}}}).manifest.manifest;
    expect(manifest.boundary).toBe(BOUNDARY);
    expect(manifest.schemaVersion).toBe(2);
    expect(completion?.intent).toEqual({jobId: JOB_ID, scope: "form"});
  });

  it("content-addresses every archive data upload", async () => {
    const { admin } = createAdmin(archiveHandler());

    await archiveForm(admin);

    const keys = mocks.uploadGoogleDriveFile.mock.calls
      .slice(0, 3)
      .map((call) => call[0].idempotencyKey);
    expect(keys).toHaveLength(3);
    for (const key of keys) {
      expect(key).toMatch(/:[a-f0-9]{64}$/);
    }
  });

  it("refuses to archive a job that has not reached its boundary", async () => {
    const { admin, calls } = createAdmin((call) =>
      call.table === "form_archive_jobs" && call.op === "select"
        ? { data: { ...formJobRow(), retention_eligible_at: "2030-01-01T00:00:00.000Z" } }
        : { data: [] }
    );

    await expect(archiveForm(admin)).rejects.toThrow(
      "has not reached its three-year retention boundary"
    );
    expect(calls.some((call) => call.op === "update")).toBe(false);
    expect(mocks.uploadGoogleDriveFile).not.toHaveBeenCalled();
  });
});

describe("retention transition safety", () => {
  it("uses the exact reserved completion boundary instead of parallel service status/audit writes", async () => {
    const { admin, calls, rpc } = createAdmin(archiveHandler());
    await archiveForm(admin);
    expect(calls.filter(call => call.op !== "select")).toEqual([]);
    expect(rpc).toHaveBeenCalledWith("complete_admin_retention_operation", expect.objectContaining({p_attempt_id: ATTEMPT_ID,
      p_payload: expect.objectContaining({intent: {jobId: JOB_ID, scope: "form"}, stage: "archive_start", boundary: BOUNDARY})}));
    expect(rpc).toHaveBeenCalledWith("complete_admin_retention_operation", expect.objectContaining({p_attempt_id: ATTEMPT_ID,
      p_payload: expect.objectContaining({intent: {jobId: JOB_ID, scope: "form"}, stage: "archive_complete", boundary: BOUNDARY})}));
  });
  it("never reports success when the verified completion response is malformed", async () => {
    const { admin, rpc } = createAdmin(archiveHandler());
    rpc.mockResolvedValue({data: {success:true}, error:null});
    await expect(archiveForm(admin)).rejects.toThrow(/verification|confirmed/i);
    expect(mocks.uploadGoogleDriveFile).not.toHaveBeenCalled();
  });
  it("treats a rejected database compare-and-set as a lost race instead of success", async () => {
    const { admin, rpc } = createAdmin(archiveHandler());
    rpc.mockResolvedValueOnce({data: null, error: {code: "40001"}});

    const error = await archiveForm(admin).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(RetentionWorkflowError);
    expect((error as RetentionWorkflowError).status).toBe(409);
    expect(mocks.uploadGoogleDriveFile).not.toHaveBeenCalled();
  });

  it("guards the failure path so a terminal job is never demoted", async () => {
    const { admin, rpc } = createAdmin(
      archiveHandler({ submissionError: { message: "boom" } })
    );

    await expect(archiveForm(admin)).rejects.toThrow("Form archive rows could not be loaded.");

    expect(completionStep(rpc, "archive_failed")?.intent).toEqual({jobId: JOB_ID, scope: "form"});
  });

  it("refuses purge approval when the archived row moved underneath it", async () => {
    const { admin, rpc } = createAdmin((call) => {
      if (call.table === "form_archive_jobs" && call.op === "select") {
        return { data: formJobRow("archived") };
      }
      return { data: [] };
    });
    rpc.mockResolvedValueOnce({data: null, error: {code: "40001"}});

    const error = await runRetentionAction(admin, {
      action: "approve_purge",
      actorUserId: ACTOR,
      jobId: JOB_ID,
      scope: "form",
    }, ATTEMPT_ID).catch((thrown: unknown) => thrown);

    expect((error as RetentionWorkflowError).status).toBe(409);
    expect(completionStep(rpc, "approve_purge")?.intent).toEqual({jobId: JOB_ID, scope: "form"});
  });
});

describe("retention partial provider failure and recovery", () => {
  it("leaves a half-uploaded archive in failed, never archived", async () => {
    const { admin, calls, rpc } = createAdmin(archiveHandler());
    // The bundle uploads CSV, JSON and XLSX together; one provider failure must
    // take the whole archive down rather than record a partial success.
    mocks.uploadGoogleDriveFile.mockImplementation(({ filename }: { filename: string }) =>
      filename.endsWith(".xlsx")
        ? Promise.reject(new Error("Google Drive archive upload failed."))
        : Promise.resolve({ id: `drive-${filename}`, reused: false, webViewLink: null })
    );

    await expect(archiveForm(admin)).rejects.toThrow("Google Drive archive upload failed.");

    expect(completionStep(rpc, "archive_failed")?.intent).toEqual({jobId: JOB_ID, scope: "form"});
    expect(completionStep(rpc, "archive_complete")).toBeUndefined();
    expect(calls.filter(call => call.op !== "select")).toEqual([]);
  });

  it("cannot approve purge for a job left failed by a partial archive", async () => {
    const { admin, calls, rpc } = createAdmin(archiveHandler({ jobStatus: "failed" }));

    const error = await runRetentionAction(admin, {
      action: "approve_purge",
      actorUserId: ACTOR,
      jobId: JOB_ID,
      scope: "form",
    }, ATTEMPT_ID).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(RetentionWorkflowError);
    expect((error as RetentionWorkflowError).status).toBe(409);
    expect((error as RetentionWorkflowError).message).toContain("Archive must complete");
    expect(rpc).not.toHaveBeenCalled();
    expect(calls.some((call) => call.op === "update")).toBe(false);
  });

  it("cannot purge a job left failed by a partial archive", async () => {
    const { admin, rpc } = createAdmin(archiveHandler({ jobStatus: "failed" }));

    const error = await runRetentionAction(admin, {
      action: "purge",
      actorUserId: ACTOR,
      jobId: JOB_ID,
      scope: "form",
    }, ATTEMPT_ID).catch((thrown: unknown) => thrown);

    expect((error as RetentionWorkflowError).status).toBe(409);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("resumes a failed archive by reusing the files that already landed", async () => {
    const { admin, rpc } = createAdmin(archiveHandler({ jobStatus: "failed" }));
    // Deterministic keys mean the previous attempt's CSV and JSON are found and
    // reused; only the XLSX that never completed is uploaded again.
    mocks.uploadGoogleDriveFile.mockImplementation(({ filename }: { filename: string }) =>
      Promise.resolve({
        id: `drive-${filename}`,
        reused: filename.endsWith(".csv") || filename.endsWith(".json"),
        webViewLink: null,
      })
    );

    const result = await archiveForm(admin);

    expect(result).toMatchObject({ reusedFiles: 2, success: true });
    expect(completionStep(rpc, "archive_complete")?.reusedFiles).toBe(2);
    expect(completionStep(rpc, "archive_start")?.intent).toEqual({jobId: JOB_ID, scope: "form"});
  });

  it("records the reuse count in the archive audit rather than hiding the retry", async () => {
    const { admin, rpc } = createAdmin(archiveHandler({ jobStatus: "failed" }));
    mocks.uploadGoogleDriveFile.mockImplementation(({ filename }: { filename: string }) =>
      Promise.resolve({
        id: `drive-${filename}`,
        reused: !filename.endsWith("-manifest.json"),
        webViewLink: null,
      })
    );

    await archiveForm(admin);

    // Three data files reused; the manifest is always fresh because it embeds
    // its own archive timestamp.
    expect(completionStep(rpc, "archive_complete")?.reusedFiles).toBe(3);
  });
});

describe("retention discovery", () => {
  it("scans for candidates on the same calendar boundary", async () => {
    const { admin, calls } = createAdmin((call) => {
      if (call.table === "form_submissions") {
        return { data: [{ created_at: "2021-06-01T00:00:00.000Z", form_definition_id: "form-1" }] };
      }
      return { data: [] };
    });

    const result = await runRetentionAction(admin, { action: "discover", actorUserId: ACTOR }, ATTEMPT_ID);

    expect(result).toMatchObject({ boundary: BOUNDARY, success: true });
    expect(filterFor(calls, "form_submissions", "lte:created_at")).toBe(`lte:created_at=${BOUNDARY}`);

    const eventWindow = filterFor(calls, "events", "or:");
    expect(eventWindow).toContain(`ends_at.lte.${BOUNDARY}`);
    expect(eventWindow).toContain(`starts_at.lte.${BOUNDARY}`);
  });

  it("pages event discovery instead of stopping after one range", async () => {
    let eventReads = 0;
    const { admin, calls } = createAdmin((call) => {
      if (call.table === "events") {
        eventReads += 1;
        // A full page must trigger another read; a short page ends the scan.
        return { data: eventReads === 1 ? eventPage(PAGE_SIZE) : eventPage(2) };
      }
      return { data: [] };
    });

    const result = await runRetentionAction(admin, { action: "discover", actorUserId: ACTOR }, ATTEMPT_ID);

    expect(result).toMatchObject({ success: true });
    const reads = pageReads(calls, "events");
    expect(reads).toHaveLength(2);
    expect(reads[0].filters).toContain("range:0-499");
    expect(reads[1].filters).toContain("range:500-999");
  });

  it("fails loudly rather than discovering a partial candidate set", async () => {
    const { admin } = createAdmin((call) =>
      call.table === "events" ? { data: eventPage(PAGE_SIZE) } : { data: [] }
    );

    const error = await runRetentionAction(admin, {
      action: "discover",
      actorUserId: ACTOR,
    }, ATTEMPT_ID).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(RetentionWorkflowError);
    expect((error as RetentionWorkflowError).status).toBe(409);
    expect((error as RetentionWorkflowError).message).toContain("10,000-row safety limit");
  });
});
