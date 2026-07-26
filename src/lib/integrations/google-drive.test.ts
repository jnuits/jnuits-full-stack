import { generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchGoogleWithRetry,
  googleDriveIdempotencyToken,
  normalizeGooglePrivateKey,
  uploadGoogleDriveFile,
} from "./google-drive";

const SHARED_DRIVE_ID = "shared-drive-id";
const FOLDER_ID = "exports-folder-id";
const UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";
const originalEnv = process.env;

// Generated per run so no credential material is ever committed.
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = privateKey.export({ format: "pem", type: "pkcs8" }).toString();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" }, status });
}

type StubOptions = { existingFiles?: unknown[] };

function stubGoogle(options: StubOptions = {}) {
  const seen: string[] = [];
  const fetchStub = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    seen.push(url);
    if (url.startsWith("https://oauth2.googleapis.com/token")) {
      return json({ access_token: "test-access-token" });
    }
    if (url.includes(`/drive/v3/files/${FOLDER_ID}`)) {
      return json({ driveId: SHARED_DRIVE_ID, id: FOLDER_ID, mimeType: "application/vnd.google-apps.folder" });
    }
    if (url.startsWith("https://www.googleapis.com/drive/v3/files?")) {
      return json({ files: options.existingFiles ?? [] });
    }
    if (url.startsWith(UPLOAD_URL)) {
      return json({ driveId: SHARED_DRIVE_ID, id: "newly-uploaded-file", webViewLink: "https://drive.example.test/new" });
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal("fetch", fetchStub);
  return { fetchStub, seen };
}

beforeEach(() => {
  process.env = {
    ...originalEnv,
    GOOGLE_DRIVE_EXPORTS_FOLDER_ID: FOLDER_ID,
    GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL: "service@example.test",
    GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY: pem,
    GOOGLE_DRIVE_SHARED_DRIVE_ID: SHARED_DRIVE_ID,
  };
});

afterEach(() => {
  process.env = originalEnv;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Google Shared Drive integration", () => {
  it("normalizes escaped multiline keys without logging or exposing them", () => {
    expect(normalizeGooglePrivateKey("  line-1\\nline-2  ")).toBe("line-1\nline-2");
  });

  it("derives a bounded, injection-safe idempotency token", () => {
    const token = googleDriveIdempotencyToken("form:job-1:resource-1:archive.csv");
    expect(token).toMatch(/^[a-f0-9]{32}$/);
    expect(googleDriveIdempotencyToken("form:job-1:resource-1:archive.csv")).toBe(token);
    expect(googleDriveIdempotencyToken("form:job-2:resource-1:archive.csv")).not.toBe(token);
    expect(googleDriveIdempotencyToken("' or trashed = false and '")).toMatch(/^[a-f0-9]{32}$/);
  });

  it("retries rate limits with bounded exponential backoff", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response("quota", { status: 429 }))
      .mockResolvedValueOnce(new Response("temporary", { status: 503 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const sleep = vi.fn().mockResolvedValue(undefined);

    const response = await fetchGoogleWithRetry("https://google.example.test", { method: "POST" }, { fetchImpl, sleep });

    expect(response.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 250);
    expect(sleep).toHaveBeenNthCalledWith(2, 500);
  });

  it("honours a bounded Retry-After header when Google supplies one", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response("quota", { headers: { "Retry-After": "2" }, status: 429 }))
      .mockResolvedValueOnce(new Response("quota", { headers: { "Retry-After": "9999" }, status: 429 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const sleep = vi.fn().mockResolvedValue(undefined);

    await fetchGoogleWithRetry("https://google.example.test", { method: "GET" }, { fetchImpl, sleep });

    expect(sleep).toHaveBeenNthCalledWith(1, 2_000);
    expect(sleep).toHaveBeenNthCalledWith(2, 10_000);
  });

  it("does not retry permanent authorization failures", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("forbidden", { status: 403 }));
    const sleep = vi.fn();

    const response = await fetchGoogleWithRetry("https://google.example.test", { method: "POST" }, { fetchImpl, sleep });

    expect(response.status).toBe(403);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("stops after three retryable failures", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 }));
    const sleep = vi.fn().mockResolvedValue(undefined);

    const response = await fetchGoogleWithRetry("https://google.example.test", { method: "GET" }, { fetchImpl, sleep });

    expect(response.status).toBe(503);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("uploads once when no previous attempt is found", async () => {
    const { seen } = stubGoogle();

    const snapshot = await uploadGoogleDriveFile({
      data: Buffer.from("row", "utf8"),
      filename: "archive.csv",
      idempotencyKey: "form:job-1:form-1:archive.csv",
      mimeType: "text/csv",
    });

    expect(snapshot).toMatchObject({ id: "newly-uploaded-file", reused: false });
    expect(seen.filter((url) => url.startsWith(UPLOAD_URL))).toHaveLength(1);
  });

  it("looks up the token before retrying an ambiguous multipart upload", async () => {
    vi.useFakeTimers();
    let lookups = 0;
    let uploads = 0;
    const fetchStub = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("https://oauth2.googleapis.com/token")) {
        return json({ access_token: "test-access-token" });
      }
      if (url.includes(`/drive/v3/files/${FOLDER_ID}`)) {
        return json({
          driveId: SHARED_DRIVE_ID,
          id: FOLDER_ID,
          mimeType: "application/vnd.google-apps.folder",
        });
      }
      if (url.startsWith("https://www.googleapis.com/drive/v3/files?")) {
        lookups += 1;
        return json({
          files:
            lookups === 1
              ? []
              : [{ driveId: SHARED_DRIVE_ID, id: "completed-despite-503" }],
        });
      }
      if (url.startsWith(UPLOAD_URL)) {
        uploads += 1;
        return json({ error: "temporary" }, 503);
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchStub);

    const pending = uploadGoogleDriveFile({
      data: Buffer.from("row", "utf8"),
      filename: "archive.csv",
      idempotencyKey: "form:job-1:form-1:archive.csv",
      mimeType: "text/csv",
    });
    await vi.advanceTimersByTimeAsync(250);
    const snapshot = await pending;

    expect(snapshot).toMatchObject({
      id: "completed-despite-503",
      reused: true,
    });
    expect(uploads).toBe(1);
    expect(lookups).toBe(2);
  });

  it("reuses the existing file on replay and issues no upload", async () => {
    const { seen } = stubGoogle({
      existingFiles: [{ driveId: SHARED_DRIVE_ID, id: "already-archived", webViewLink: "https://drive.example.test/existing" }],
    });

    const snapshot = await uploadGoogleDriveFile({
      data: Buffer.from("row", "utf8"),
      filename: "archive.csv",
      idempotencyKey: "form:job-1:form-1:archive.csv",
      mimeType: "text/csv",
    });

    expect(snapshot).toEqual({
      id: "already-archived",
      reused: true,
      webViewLink: "https://drive.example.test/existing",
    });
    expect(seen.some((url) => url.startsWith(UPLOAD_URL))).toBe(false);
  });

  it("searches only the configured Shared Drive for the idempotency token", async () => {
    const { seen } = stubGoogle();

    await uploadGoogleDriveFile({
      data: Buffer.from("row", "utf8"),
      filename: "archive.csv",
      idempotencyKey: "form:job-1:form-1:archive.csv",
      mimeType: "text/csv",
    });

    const lookup = seen.find((url) => url.startsWith("https://www.googleapis.com/drive/v3/files?"));
    expect(lookup).toContain(`driveId=${SHARED_DRIVE_ID}`);
    expect(lookup).toContain("corpora=drive");
    expect(lookup).toContain(googleDriveIdempotencyToken("form:job-1:form-1:archive.csv"));
  });

  it("rejects a matching file that lives outside the configured Shared Drive", async () => {
    stubGoogle({ existingFiles: [{ driveId: "someone-elses-drive", id: "foreign-file" }] });

    await expect(uploadGoogleDriveFile({
      data: Buffer.from("row", "utf8"),
      filename: "archive.csv",
      idempotencyKey: "form:job-1:form-1:archive.csv",
      mimeType: "text/csv",
    })).rejects.toThrow("outside the configured Shared Drive");
  });
});
