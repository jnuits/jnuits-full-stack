import "server-only";

import { createHash, createSign, randomUUID } from "node:crypto";

const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SHEETS_MIME = "application/vnd.google-apps.spreadsheet";
const GOOGLE_FOLDER_MIME = "application/vnd.google-apps.folder";
const MAX_RETRY_ATTEMPTS = 3;
const MAX_RETRY_AFTER_MS = 10_000;
const IDEMPOTENCY_PROPERTY = "jnuitsIdempotencyToken";

type GoogleDriveConfig = {
  exportsFolderId: string;
  privateKey: string;
  serviceAccountEmail: string;
  sharedDriveId: string;
};

export type GoogleSheetSnapshot = { id: string; reused?: boolean; webViewLink: null | string };
type RetryOptions = {
  fetchImpl?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
};

function envValue(name: string) { return process.env[name]?.trim() || ""; }
export function normalizeGooglePrivateKey(value: string) { return value.trim().replace(/\\n/g, "\n"); }

/**
 * Deterministic, bounded, injection-safe token for a logical upload. Hashing
 * keeps the value inside Drive's appProperties limits and guarantees the
 * character set is safe to embed in a Drive `q` expression.
 */
export function googleDriveIdempotencyToken(idempotencyKey: string) {
  return createHash("sha256").update(idempotencyKey).digest("hex").slice(0, 32);
}

function getGoogleDriveConfig(): GoogleDriveConfig | null {
  const serviceAccountEmail = envValue("GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL");
  const privateKey = normalizeGooglePrivateKey(envValue("GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY"));
  const sharedDriveId = envValue("GOOGLE_DRIVE_SHARED_DRIVE_ID");
  const exportsFolderId = envValue("GOOGLE_DRIVE_EXPORTS_FOLDER_ID");
  if (!serviceAccountEmail || !privateKey || !sharedDriveId || !exportsFolderId) return null;
  return { exportsFolderId, privateKey, serviceAccountEmail, sharedDriveId };
}

export function isGoogleDriveExportConfigured() { return getGoogleDriveConfig() !== null; }
function toBase64Url(value: Buffer | string) { return Buffer.from(value).toString("base64url"); }

function createServiceAccountAssertion(config: GoogleDriveConfig) {
  const now = Math.floor(Date.now() / 1_000);
  const header = toBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = toBase64Url(JSON.stringify({ aud: GOOGLE_TOKEN_URL, exp: now + 300, iat: now, iss: config.serviceAccountEmail, scope: GOOGLE_DRIVE_SCOPE }));
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned); signer.end();
  return `${unsigned}.${toBase64Url(signer.sign(config.privateKey))}`;
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
function retryableGoogleStatus(status: number) { return status === 429 || status === 500 || status === 502 || status === 503 || status === 504; }

function retryAfterDelay(response: Response) {
  const header = response.headers.get("retry-after");
  if (!header) return null;
  const seconds = Number(header.trim());
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.min(seconds * 1_000, MAX_RETRY_AFTER_MS);
}

export async function fetchGoogleWithRetry(input: string, init: RequestInit, options: RetryOptions = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const sleep = options.sleep || ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  let response: Response | null = null;
  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt += 1) {
    response = await fetchImpl(input, { ...init, signal: AbortSignal.timeout(10_000) });
    if (response.ok || !retryableGoogleStatus(response.status)) return response;
    if (attempt < MAX_RETRY_ATTEMPTS - 1) {
      await sleep(retryAfterDelay(response) ?? 250 * 2 ** attempt);
    }
  }
  return response!;
}

async function getAccessToken(config: GoogleDriveConfig) {
  const body = new URLSearchParams({ assertion: createServiceAccountAssertion(config), grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer" });
  const response = await fetchGoogleWithRetry(GOOGLE_TOKEN_URL, { body, headers: { "Content-Type": "application/x-www-form-urlencoded" }, method: "POST" });
  if (!response.ok) throw new Error("Google Drive authentication failed.");
  const payload = (await response.json()) as unknown;
  if (!isRecord(payload) || typeof payload.access_token !== "string") throw new Error("Google Drive did not return an access token.");
  return payload.access_token;
}

async function assertConfiguredSharedDriveFolder(config: GoogleDriveConfig, accessToken: string) {
  const response = await fetchGoogleWithRetry(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(config.exportsFolderId)}?supportsAllDrives=true&fields=id,driveId,mimeType`, { headers: { Authorization: `Bearer ${accessToken}` }, method: "GET" });
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok || !isRecord(payload) || payload.id !== config.exportsFolderId || payload.driveId !== config.sharedDriveId || payload.mimeType !== GOOGLE_FOLDER_MIME) {
    throw new Error("Google Drive export folder is outside the configured Shared Drive.");
  }
}

/**
 * Looks for a previously completed upload carrying the same idempotency token.
 * A hit means an earlier attempt already succeeded, so the caller must reuse it
 * rather than creating a duplicate archive.
 */
async function findExistingUpload(
  config: GoogleDriveConfig,
  accessToken: string,
  token: string
): Promise<GoogleSheetSnapshot | null> {
  const query = new URLSearchParams({
    corpora: "drive",
    driveId: config.sharedDriveId,
    fields: "files(id,webViewLink,driveId)",
    includeItemsFromAllDrives: "true",
    pageSize: "2",
    q: `appProperties has { key='${IDEMPOTENCY_PROPERTY}' and value='${token}' } and trashed = false`,
    supportsAllDrives: "true",
  });
  const response = await fetchGoogleWithRetry(
    `https://www.googleapis.com/drive/v3/files?${query.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` }, method: "GET" }
  );
  if (!response.ok) throw new Error("Google Drive could not be checked for an existing snapshot.");
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!isRecord(payload) || !Array.isArray(payload.files) || !payload.files.length) return null;

  const existing = payload.files[0] as unknown;
  if (!isRecord(existing) || typeof existing.id !== "string") return null;
  if (existing.driveId !== config.sharedDriveId) {
    throw new Error("Google Drive returned a snapshot outside the configured Shared Drive.");
  }
  return {
    id: existing.id,
    reused: true,
    webViewLink: typeof existing.webViewLink === "string" ? existing.webViewLink : null,
  };
}

function withIdempotency(metadata: Record<string, unknown>, token: null | string) {
  if (!token) return metadata;
  const appProperties = isRecord(metadata.appProperties) ? metadata.appProperties : {};
  return { ...metadata, appProperties: { ...appProperties, [IDEMPOTENCY_PROPERTY]: token } };
}

function createMultipartBody(boundary: string, metadata: Record<string, unknown>, csv: string) {
  return Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: text/csv; charset=UTF-8\r\n\r\n${csv}\r\n--${boundary}--\r\n`, "utf8");
}

function createBinaryMultipartBody(boundary: string, metadata: Record<string, unknown>, data: Buffer, mimeType: string) {
  const prefix = Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`, "utf8");
  return Buffer.concat([prefix, data, Buffer.from(`\r\n--${boundary}--\r\n`, "utf8")]);
}

async function uploadMultipart(config: GoogleDriveConfig, accessToken: string, boundary: string, body: Buffer) {
  const requestBody: Uint8Array<ArrayBuffer> = Uint8Array.from(body);
  return fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink,name,mimeType,driveId", {
    body: requestBody,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    method: "POST",
    signal: AbortSignal.timeout(10_000),
  });
}

async function uploadMultipartWithRecovery({
  accessToken,
  body,
  boundary,
  config,
  failureMessage,
  token,
}: {
  accessToken: string;
  body: Buffer;
  boundary: string;
  config: GoogleDriveConfig;
  failureMessage: string;
  token: null | string;
}) {
  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt += 1) {
    let response: null | Response = null;
    try {
      response = await uploadMultipart(config, accessToken, boundary, body);
    } catch {
      // A network failure is ambiguous: Drive may have completed the upload.
    }

    if (response?.ok) {
      return readSnapshot(await response.json(), config, failureMessage);
    }
    if (response && !retryableGoogleStatus(response.status)) {
      throw new Error(failureMessage);
    }

    if (!token) {
      throw new Error(failureMessage);
    }

    await new Promise<void>((resolve) =>
      setTimeout(resolve, 250 * 2 ** attempt)
    );
    const existing = await findExistingUpload(config, accessToken, token);
    if (existing) return existing;

    if (attempt === MAX_RETRY_ATTEMPTS - 1) {
      throw new Error(failureMessage);
    }
  }

  throw new Error(failureMessage);
}

async function prepareUpload(idempotencyKey?: string) {
  const config = getGoogleDriveConfig();
  if (!config) throw new Error("Google Shared Drive export is not configured.");
  const accessToken = await getAccessToken(config);
  await assertConfiguredSharedDriveFolder(config, accessToken);
  const token = idempotencyKey ? googleDriveIdempotencyToken(idempotencyKey) : null;
  const existing = token ? await findExistingUpload(config, accessToken, token) : null;
  return { accessToken, config, existing, token };
}

function readSnapshot(payload: unknown, config: GoogleDriveConfig, failureMessage: string): GoogleSheetSnapshot {
  if (!isRecord(payload) || typeof payload.id !== "string" || payload.driveId !== config.sharedDriveId) {
    throw new Error(failureMessage);
  }
  return {
    id: payload.id,
    reused: false,
    webViewLink: typeof payload.webViewLink === "string" ? payload.webViewLink : null,
  };
}

export async function uploadGoogleSheetSnapshot({ csv, filename, idempotencyKey }: {
  csv: string;
  filename: string;
  idempotencyKey?: string;
}): Promise<GoogleSheetSnapshot> {
  const { accessToken, config, existing, token } = await prepareUpload(idempotencyKey);
  if (existing) return existing;

  const boundary = `jnuits-${randomUUID()}`;
  const body = createMultipartBody(
    boundary,
    withIdempotency({ appProperties: { jnuitsExport: "true" }, mimeType: GOOGLE_SHEETS_MIME, name: filename, parents: [config.exportsFolderId] }, token),
    csv
  );
  return uploadMultipartWithRecovery({
    accessToken,
    body,
    boundary,
    config,
    failureMessage: "Google Sheet snapshot upload failed.",
    token,
  });
}

export async function uploadGoogleDriveFile({ data, filename, idempotencyKey, mimeType }: {
  data: Buffer;
  filename: string;
  idempotencyKey?: string;
  mimeType: string;
}): Promise<GoogleSheetSnapshot> {
  const { accessToken, config, existing, token } = await prepareUpload(idempotencyKey);
  if (existing) return existing;

  const boundary = `jnuits-${randomUUID()}`;
  const body = createBinaryMultipartBody(
    boundary,
    withIdempotency({ appProperties: { jnuitsArchive: "true" }, name: filename, parents: [config.exportsFolderId] }, token),
    data,
    mimeType
  );
  return uploadMultipartWithRecovery({
    accessToken,
    body,
    boundary,
    config,
    failureMessage: "Google Drive archive upload failed.",
    token,
  });
}
