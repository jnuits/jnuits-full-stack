import "server-only";

import { createSign, randomUUID } from "node:crypto";

const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SHEETS_MIME = "application/vnd.google-apps.spreadsheet";
const GOOGLE_FOLDER_MIME = "application/vnd.google-apps.folder";
const MAX_RETRY_ATTEMPTS = 3;

type GoogleDriveConfig = {
  exportsFolderId: string;
  privateKey: string;
  serviceAccountEmail: string;
  sharedDriveId: string;
};

export type GoogleSheetSnapshot = { id: string; webViewLink: null | string };
type RetryOptions = {
  fetchImpl?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
};

function envValue(name: string) {
  return process.env[name]?.trim() || "";
}

export function normalizeGooglePrivateKey(value: string) {
  return value.trim().replace(/\\n/g, "\n");
}

function getGoogleDriveConfig(): GoogleDriveConfig | null {
  const serviceAccountEmail = envValue("GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL");
  const privateKey = normalizeGooglePrivateKey(envValue("GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY"));
  const sharedDriveId = envValue("GOOGLE_DRIVE_SHARED_DRIVE_ID");
  const exportsFolderId = envValue("GOOGLE_DRIVE_EXPORTS_FOLDER_ID");
  if (!serviceAccountEmail || !privateKey || !sharedDriveId || !exportsFolderId) return null;
  return { exportsFolderId, privateKey, serviceAccountEmail, sharedDriveId };
}

export function isGoogleDriveExportConfigured() {
  return getGoogleDriveConfig() !== null;
}

function toBase64Url(value: Buffer | string) {
  return Buffer.from(value).toString("base64url");
}

function createServiceAccountAssertion(config: GoogleDriveConfig) {
  const now = Math.floor(Date.now() / 1_000);
  const header = toBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = toBase64Url(JSON.stringify({
    aud: GOOGLE_TOKEN_URL,
    exp: now + 300,
    iat: now,
    iss: config.serviceAccountEmail,
    scope: GOOGLE_DRIVE_SCOPE,
  }));
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${toBase64Url(signer.sign(config.privateKey))}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function retryableGoogleStatus(status: number) {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

export async function fetchGoogleWithRetry(
  input: string,
  init: RequestInit,
  options: RetryOptions = {},
) {
  const fetchImpl = options.fetchImpl || fetch;
  const sleep = options.sleep || ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  let response: Response | null = null;

  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt += 1) {
    response = await fetchImpl(input, { ...init, signal: AbortSignal.timeout(10_000) });
    if (response.ok || !retryableGoogleStatus(response.status)) return response;
    if (attempt < MAX_RETRY_ATTEMPTS - 1) await sleep(250 * 2 ** attempt);
  }
  return response!;
}

async function getAccessToken(config: GoogleDriveConfig) {
  const body = new URLSearchParams({
    assertion: createServiceAccountAssertion(config),
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
  });
  const response = await fetchGoogleWithRetry(GOOGLE_TOKEN_URL, {
    body,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
  if (!response.ok) throw new Error("Google Drive authentication failed.");
  const payload = (await response.json()) as unknown;
  if (!isRecord(payload) || typeof payload.access_token !== "string") {
    throw new Error("Google Drive did not return an access token.");
  }
  return payload.access_token;
}

async function assertConfiguredSharedDriveFolder(config: GoogleDriveConfig, accessToken: string) {
  const response = await fetchGoogleWithRetry(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(config.exportsFolderId)}?supportsAllDrives=true&fields=id,driveId,mimeType`,
    { headers: { Authorization: `Bearer ${accessToken}` }, method: "GET" },
  );
  const payload = (await response.json().catch(() => null)) as unknown;
  if (
    !response.ok ||
    !isRecord(payload) ||
    payload.id !== config.exportsFolderId ||
    payload.driveId !== config.sharedDriveId ||
    payload.mimeType !== GOOGLE_FOLDER_MIME
  ) {
    throw new Error("Google Drive export folder is outside the configured Shared Drive.");
  }
}

function createMultipartBody(boundary: string, metadata: Record<string, unknown>, csv: string) {
  return Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: text/csv; charset=UTF-8\r\n\r\n${csv}\r\n--${boundary}--\r\n`,
    "utf8",
  );
}

async function uploadMultipart(
  config: GoogleDriveConfig,
  accessToken: string,
  boundary: string,
  body: Buffer,
) {
  await assertConfiguredSharedDriveFolder(config, accessToken);
  return fetchGoogleWithRetry(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink,name,mimeType,driveId",
    {
      body,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      method: "POST",
    },
  );
}

export async function uploadGoogleSheetSnapshot({ csv, filename }: { csv: string; filename: string }): Promise<GoogleSheetSnapshot> {
  const config = getGoogleDriveConfig();
  if (!config) throw new Error("Google Shared Drive export is not configured.");
  const accessToken = await getAccessToken(config);
  const boundary = `jnuits-${randomUUID()}`;
  const body = createMultipartBody(boundary, {
    appProperties: { jnuitsExport: "true" },
    mimeType: GOOGLE_SHEETS_MIME,
    name: filename,
    parents: [config.exportsFolderId],
  }, csv);
  const response = await uploadMultipart(config, accessToken, boundary, body);
  if (!response.ok) throw new Error("Google Sheet snapshot upload failed.");
  const payload = (await response.json()) as unknown;
  if (!isRecord(payload) || typeof payload.id !== "string" || payload.driveId !== config.sharedDriveId) {
    throw new Error("Google Drive did not return a Shared Drive snapshot identifier.");
  }
  return { id: payload.id, webViewLink: typeof payload.webViewLink === "string" ? payload.webViewLink : null };
}

function createBinaryMultipartBody(boundary: string, metadata: Record<string, unknown>, data: Buffer, mimeType: string) {
  const prefix = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
    "utf8",
  );
  return Buffer.concat([prefix, data, Buffer.from(`\r\n--${boundary}--\r\n`, "utf8")]);
}

export async function uploadGoogleDriveFile({ data, filename, mimeType }: { data: Buffer; filename: string; mimeType: string }): Promise<GoogleSheetSnapshot> {
  const config = getGoogleDriveConfig();
  if (!config) throw new Error("Google Shared Drive export is not configured.");
  const accessToken = await getAccessToken(config);
  const boundary = `jnuits-${randomUUID()}`;
  const body = createBinaryMultipartBody(boundary, {
    appProperties: { jnuitsArchive: "true" },
    name: filename,
    parents: [config.exportsFolderId],
  }, data, mimeType);
  const response = await uploadMultipart(config, accessToken, boundary, body);
  if (!response.ok) throw new Error("Google Drive archive upload failed.");
  const payload = (await response.json()) as unknown;
  if (!isRecord(payload) || typeof payload.id !== "string" || payload.driveId !== config.sharedDriveId) {
    throw new Error("Google Drive did not return a Shared Drive archive identifier.");
  }
  return { id: payload.id, webViewLink: typeof payload.webViewLink === "string" ? payload.webViewLink : null };
}
