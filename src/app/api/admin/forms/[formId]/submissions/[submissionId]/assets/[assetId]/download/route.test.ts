import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildSignedCloudinaryFormAssetUrl: vi.fn(),
  loadVerifiedCloudinaryFormAsset: vi.fn(),
  requireAdminApiPermission: vi.fn(),
}));

vi.mock("@/lib/admin/api-auth", () => ({
  requireAdminApiPermission: mocks.requireAdminApiPermission,
}));
vi.mock("@/lib/forms/cloudinary-assets", () => ({
  buildSignedCloudinaryFormAssetUrl: mocks.buildSignedCloudinaryFormAssetUrl,
  loadVerifiedCloudinaryFormAsset: mocks.loadVerifiedCloudinaryFormAsset,
}));
vi.mock("@/lib/security/with-api-guard", () => ({ withApiGuard: <T>(handler: T) => handler }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => adminDouble }));
vi.mock("@/lib/supabase/flexible", () => ({ asFlexibleClient: <T>(client: T) => client }));

import { GET } from "./route";

const ACTOR_ID = "11111111-1111-4111-8111-111111111111";
const FORM_ID = "22222222-2222-4222-8222-222222222222";
const SUBMISSION_ID = "33333333-3333-4333-8333-333333333333";
const ASSET_ID = "44444444-4444-4444-8444-444444444444";
const VERSION_ID = "55555555-5555-4555-8555-555555555555";
const SIGNED_URL =
  "https://res.cloudinary.com/demo/raw/authenticated/s--secret-signature--/v1/private/object.pdf";

type Call = { filters: string[]; op: "insert" | "select"; payload?: unknown; table: string };

let calls: Call[] = [];
let submissionRow: unknown = null;
let assetRow: unknown = null;
let assetError: unknown = null;
let auditError: unknown = null;

function chain(call: Call, settle: () => Promise<unknown>) {
  const api = {
    eq(column: string, value: unknown) {
      call.filters.push(`eq:${column}=${String(value)}`);
      return api;
    },
    maybeSingle: settle,
    select(columns?: string) {
      if (columns) call.filters.push("select");
      return api;
    },
    then: (resolve: (value: unknown) => unknown) => settle().then(resolve),
  };
  return api;
}

const adminDouble = {
  from(table: string) {
    return {
      insert(payload: unknown) {
        const call: Call = { filters: [], op: "insert", payload, table };
        calls.push(call);
        return chain(call, () => Promise.resolve({ error: auditError }));
      },
      select(columns?: string) {
        const call: Call = { filters: [], op: "select", table };
        calls.push(call);
        return chain(call, () =>
          Promise.resolve(
            table === "form_submissions"
              ? { data: submissionRow, error: null }
              : { data: assetRow, error: assetError }
          )
        ).select(columns);
      },
    };
  },
};

function request() {
  return new NextRequest("https://jnuits.example.test/api/admin/forms/download");
}

function params(overrides: Record<string, string> = {}) {
  return {
    params: Promise.resolve({
      assetId: ASSET_ID,
      formId: FORM_ID,
      submissionId: SUBMISSION_ID,
      ...overrides,
    }),
  };
}

function tableCall(table: string) {
  return calls.find((call) => call.table === table);
}

beforeEach(() => {
  vi.clearAllMocks();
  calls = [];
  auditError = null;
  assetError = null;
  submissionRow = { form_version_id: VERSION_ID, id: SUBMISSION_ID };
  assetRow = {
    bytes: 1024,
    cloudinary_asset_id: "a".repeat(32),
    cloudinary_folder: `jnuits/private/forms/${FORM_ID}`,
    cloudinary_public_id: "66666666-6666-4666-8666-666666666666.pdf",
    cloudinary_version: "1234567890",
    content_type: "application/pdf",
    field_id: "identity_document",
    form_submission_id: SUBMISSION_ID,
    id: ASSET_ID,
    sha256: "b".repeat(64),
  };
  mocks.requireAdminApiPermission.mockResolvedValue({ auth: { user: { id: ACTOR_ID } } });
  mocks.loadVerifiedCloudinaryFormAsset.mockResolvedValue({});
  mocks.buildSignedCloudinaryFormAssetUrl.mockReturnValue(SIGNED_URL);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("file-bytes", { status: 200 }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("private form upload download proxy", () => {
  it("requires the form review permission", async () => {
    const response = await GET(request(), params());

    expect(response.status).toBe(200);
    expect(mocks.requireAdminApiPermission).toHaveBeenCalledWith(
      "admin.forms.review",
      expect.objectContaining({
        forbiddenMessage: expect.stringContaining("authorized administrators"),
      })
    );
  });

  it("short-circuits a denied request before any lookup, verification, or fetch", async () => {
    mocks.requireAdminApiPermission.mockResolvedValue({
      response: NextResponse.json({ error: "Forbidden." }, { status: 403 }),
    });

    const response = await GET(request(), params());

    expect(response.status).toBe(403);
    expect(calls).toHaveLength(0);
    expect(mocks.loadVerifiedCloudinaryFormAsset).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns 404 for malformed identifiers without touching the database", async () => {
    for (const overrides of [
      { formId: "not-a-uuid" },
      { submissionId: "not-a-uuid" },
      { assetId: "not-a-uuid" },
    ]) {
      calls = [];
      const response = await GET(request(), params(overrides));

      expect(response.status).toBe(404);
      expect(calls).toHaveLength(0);
    }
  });

  it("scopes the submission to the requested form", async () => {
    await GET(request(), params());

    expect(tableCall("form_submissions")?.filters).toEqual(
      expect.arrayContaining([`eq:id=${SUBMISSION_ID}`, `eq:form_definition_id=${FORM_ID}`])
    );
  });

  it("returns 404 when the submission does not belong to the form", async () => {
    submissionRow = null;

    const response = await GET(request(), params());

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Upload not found." });
    expect(mocks.loadVerifiedCloudinaryFormAsset).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("scopes the asset to the submission and returns an indistinguishable 404 otherwise", async () => {
    await GET(request(), params());
    expect(tableCall("form_submission_assets")?.filters).toEqual(
      expect.arrayContaining([`eq:id=${ASSET_ID}`, `eq:form_submission_id=${SUBMISSION_ID}`])
    );

    assetRow = null;
    const missing = await GET(request(), params());
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "Upload not found." });

    assetRow = {};
    assetError = { message: "boom" };
    const failed = await GET(request(), params());
    expect(failed.status).toBe(404);
    expect(await failed.json()).toEqual({ error: "Upload not found." });
  });

  it("verifies the asset against the form and the submission's own version before fetching bytes", async () => {
    await GET(request(), params());

    expect(mocks.loadVerifiedCloudinaryFormAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        cloudinaryAssetId: "a".repeat(32),
        contentType: "application/pdf",
        resourceType: "raw",
        sha256: "b".repeat(64),
      }),
      { expectedFormDefinitionId: FORM_ID, expectedFormVersionId: VERSION_ID }
    );
    expect(
      mocks.loadVerifiedCloudinaryFormAsset.mock.invocationCallOrder[0]
    ).toBeLessThan((fetch as unknown as { mock: { invocationCallOrder: number[] } }).mock.invocationCallOrder[0]);
  });

  it("delivers as a non-cacheable attachment and audits the download", async () => {
    const response = await GET(request(), params());

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe(
      `attachment; filename="form-upload-${ASSET_ID}.pdf"`
    );

    const audit = tableCall("audit_events");
    expect(audit?.payload).toMatchObject({
      action: "form.upload_downloaded",
      actor_user_id: ACTOR_ID,
      entity_id: ASSET_ID,
      entity_type: "form_submission_asset",
    });
  });

  it("never returns the file when the audit record cannot be written", async () => {
    auditError = { message: "audit unavailable" };

    const response = await GET(request(), params());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "The download audit record could not be saved.",
    });
  });

  it("fails closed without leaking the signed delivery URL", async () => {
    mocks.loadVerifiedCloudinaryFormAsset.mockRejectedValue(new Error(SIGNED_URL));

    const response = await GET(request(), params());
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(body).toContain("temporarily unavailable");
    expect(body).not.toContain(SIGNED_URL);
    expect(body).not.toContain("s--");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fails closed when the provider rejects the signed request", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("denied", { status: 401 })));

    const response = await GET(request(), params());

    expect(response.status).toBe(503);
    expect(tableCall("audit_events")).toBeUndefined();
  });
});
