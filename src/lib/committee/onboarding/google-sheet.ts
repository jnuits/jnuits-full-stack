import "server-only";

import { createHash } from "node:crypto";

import {
  IntakeParseError,
  MAX_INTAKE_BYTES,
} from "./intake-contracts";
import { parseDelimitedIntake } from "./parse-delimited";

const GOOGLE_SHEETS_HOST = "docs.google.com";
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_REDIRECTS = 3;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const CSV_CONTENT_TYPES = new Set(["application/csv", "text/csv"]);

export type PublicGoogleSheetSource = {
  documentId: string;
  gid: string;
};

export type PublicGoogleSheetSnapshot = {
  bytes: Buffer;
  contentType: string;
  documentId: string;
  fetchedAt: string;
  sha256: string;
  sheetId: string;
};

export type GoogleSheetSnapshotErrorCode =
  | "invalid_content_type"
  | "invalid_redirect"
  | "invalid_url"
  | "redirect_loop"
  | "request_timeout"
  | "sheet_unavailable"
  | "too_many_redirects"
  | "unsafe_redirect";

export class GoogleSheetSnapshotError extends Error {
  readonly code: GoogleSheetSnapshotErrorCode;

  constructor(code: GoogleSheetSnapshotErrorCode, message: string) {
    super(message);
    this.name = "GoogleSheetSnapshotError";
    this.code = code;
  }
}

type FetchPublicGoogleSheetSnapshotOptions = {
  fetchImpl?: typeof fetch;
  maxBytes?: number;
  maxRedirects?: number;
  now?: () => Date;
  timeoutMs?: number;
};

function invalidSourceUrl(): never {
  throw new GoogleSheetSnapshotError(
    "invalid_url",
    "Enter a valid public Google Sheet link from docs.google.com."
  );
}

function parseNumericGid(value: string | null): string | null {
  if (value === null) return null;
  if (!/^\d{1,20}$/.test(value)) invalidSourceUrl();
  return value;
}

export function parsePublicGoogleSheetUrl(input: string): PublicGoogleSheetSource {
  const candidate = input.trim();
  if (!candidate || candidate.length > 2_048) invalidSourceUrl();

  const authority = /^https:\/\/([^/?#]+)(?:[/?#]|$)/i.exec(candidate)?.[1];
  if (!authority || authority.toLocaleLowerCase("en-US") !== GOOGLE_SHEETS_HOST) {
    invalidSourceUrl();
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    invalidSourceUrl();
  }

  if (
    url.protocol !== "https:" ||
    url.hostname !== GOOGLE_SHEETS_HOST ||
    url.username ||
    url.password ||
    url.port
  ) {
    invalidSourceUrl();
  }

  const pathMatch = /^\/spreadsheets\/d\/([A-Za-z0-9_-]{10,200})(?:\/(?:edit|preview|view))?\/?$/.exec(
    url.pathname
  );
  if (!pathMatch) invalidSourceUrl();

  const queryGids = url.searchParams.getAll("gid");
  if (queryGids.length > 1) invalidSourceUrl();
  const queryGid = parseNumericGid(queryGids[0] ?? null);

  let hashGid: string | null = null;
  if (url.hash) {
    const hashMatch = /^#gid=(\d{1,20})$/.exec(url.hash);
    if (!hashMatch) invalidSourceUrl();
    hashGid = hashMatch[1];
  }
  if (queryGid && hashGid && queryGid !== hashGid) invalidSourceUrl();

  return {
    documentId: pathMatch[1],
    gid: queryGid ?? hashGid ?? "0",
  };
}

function exportUrl(source: PublicGoogleSheetSource) {
  const url = new URL(
    `https://${GOOGLE_SHEETS_HOST}/spreadsheets/d/${encodeURIComponent(source.documentId)}/export`
  );
  url.searchParams.set("format", "csv");
  url.searchParams.set("gid", source.gid);
  return url;
}

function hasExplicitAbsolutePort(input: string) {
  const authority = /^https:\/\/([^/?#]+)/i.exec(input)?.[1];
  if (!authority) return false;
  const withoutCredentials = authority.includes("@")
    ? authority.slice(authority.lastIndexOf("@") + 1)
    : authority;
  return /:\d+$/.test(withoutCredentials);
}

function isAllowedFetchUrl(url: URL, rawLocation?: string) {
  const hostname = url.hostname.toLocaleLowerCase("en-US");
  const hostAllowed =
    hostname === GOOGLE_SHEETS_HOST || hostname.endsWith(".googleusercontent.com");
  return (
    url.protocol === "https:" &&
    hostAllowed &&
    !url.username &&
    !url.password &&
    !url.port &&
    !url.hash &&
    !(rawLocation && hasExplicitAbsolutePort(rawLocation))
  );
}

function assertWithinByteLimit(actualBytes: number, maximumBytes: number) {
  if (actualBytes > maximumBytes) {
    throw new IntakeParseError(
      "source_too_large",
      `The source is larger than ${maximumBytes} bytes.`,
      { actualBytes, maximumBytes }
    );
  }
}

async function readBoundedResponse(response: Response, maximumBytes: number) {
  const contentLength = response.headers.get("content-length");
  if (contentLength && /^\d+$/.test(contentLength)) {
    assertWithinByteLimit(Number(contentLength), maximumBytes);
  }

  if (!response.body) return Buffer.alloc(0);

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      totalBytes += value.byteLength;
      if (totalBytes > maximumBytes) {
        await reader.cancel().catch(() => undefined);
        assertWithinByteLimit(totalBytes, maximumBytes);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), totalBytes);
}

async function downloadSnapshot(
  source: PublicGoogleSheetSource,
  options: Required<
    Pick<
      FetchPublicGoogleSheetSnapshotOptions,
      "fetchImpl" | "maxBytes" | "maxRedirects" | "now"
    >
  > & { signal: AbortSignal }
): Promise<PublicGoogleSheetSnapshot> {
  let currentUrl = exportUrl(source);
  const visited = new Set<string>();
  let redirectCount = 0;

  while (true) {
    if (!isAllowedFetchUrl(currentUrl)) {
      throw new GoogleSheetSnapshotError(
        "unsafe_redirect",
        "Google returned an unsafe redirect while exporting this sheet."
      );
    }
    if (visited.has(currentUrl.href)) {
      throw new GoogleSheetSnapshotError(
        "redirect_loop",
        "Google returned a redirect loop while exporting this sheet."
      );
    }
    visited.add(currentUrl.href);

    const response = await options.fetchImpl(currentUrl.href, {
      headers: { accept: "text/csv" },
      redirect: "manual",
      signal: options.signal,
    });

    if (REDIRECT_STATUSES.has(response.status)) {
      if (redirectCount >= options.maxRedirects) {
        throw new GoogleSheetSnapshotError(
          "too_many_redirects",
          "Google returned too many redirects while exporting this sheet."
        );
      }
      const location = response.headers.get("location");
      if (!location) {
        throw new GoogleSheetSnapshotError(
          "invalid_redirect",
          "Google returned an invalid redirect while exporting this sheet."
        );
      }
      let redirected: URL;
      try {
        redirected = new URL(location, currentUrl);
      } catch {
        throw new GoogleSheetSnapshotError(
          "invalid_redirect",
          "Google returned an invalid redirect while exporting this sheet."
        );
      }
      if (!isAllowedFetchUrl(redirected, location)) {
        throw new GoogleSheetSnapshotError(
          "unsafe_redirect",
          "Google returned an unsafe redirect while exporting this sheet."
        );
      }
      if (visited.has(redirected.href)) {
        throw new GoogleSheetSnapshotError(
          "redirect_loop",
          "Google returned a redirect loop while exporting this sheet."
        );
      }
      currentUrl = redirected;
      redirectCount += 1;
      continue;
    }

    if (!response.ok) {
      throw new GoogleSheetSnapshotError(
        "sheet_unavailable",
        "The Google Sheet could not be downloaded. Make it available to anyone with the link and try again."
      );
    }

    const contentType = response.headers.get("content-type")?.trim() ?? "";
    const mediaType = contentType.split(";", 1)[0]?.trim().toLocaleLowerCase("en-US");
    if (!mediaType || !CSV_CONTENT_TYPES.has(mediaType)) {
      throw new GoogleSheetSnapshotError(
        "invalid_content_type",
        "Google did not return a CSV export. Check the link and sharing settings."
      );
    }

    const bytes = await readBoundedResponse(response, options.maxBytes);
    parseDelimitedIntake(bytes);

    return {
      bytes,
      contentType,
      documentId: source.documentId,
      fetchedAt: options.now().toISOString(),
      sha256: createHash("sha256").update(bytes).digest("hex"),
      sheetId: source.gid,
    };
  }
}

export async function fetchPublicGoogleSheetSnapshot(
  source: PublicGoogleSheetSource,
  options: FetchPublicGoogleSheetSnapshotOptions = {}
): Promise<PublicGoogleSheetSnapshot> {
  const controller = new AbortController();
  const timeoutMs = Math.max(1, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const maximumBytes = Math.min(
    MAX_INTAKE_BYTES,
    Math.max(1, options.maxBytes ?? MAX_INTAKE_BYTES)
  );
  const maxRedirects = Math.max(
    0,
    Math.min(10, options.maxRedirects ?? DEFAULT_MAX_REDIRECTS)
  );
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const operation = downloadSnapshot(source, {
      fetchImpl: options.fetchImpl ?? fetch,
      maxBytes: maximumBytes,
      maxRedirects,
      now: options.now ?? (() => new Date()),
      signal: controller.signal,
    });
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(
          new GoogleSheetSnapshotError(
            "request_timeout",
            "Google Sheet export timed out. Try again."
          )
        );
      }, timeoutMs);
    });
    return await Promise.race([operation, timeout]);
  } catch (error) {
    if (error instanceof GoogleSheetSnapshotError) {
      throw error;
    }
    if (error instanceof IntakeParseError) {
      const limitMessage = error.code === "too_many_rows"
        ? "The Google Sheet CSV has too many rows. Split it into smaller imports."
        : error.code === "source_too_large"
          ? "The Google Sheet CSV is larger than 2 MB. Split it into smaller imports."
          : "The Google Sheet CSV could not be parsed. Check for blank or duplicate headings, unmatched quotes, and inconsistent row widths.";
      // Remote parser messages/details can contain private cells or headings.
      throw new IntakeParseError(error.code, limitMessage);
    }
    if (controller.signal.aborted) {
      throw new GoogleSheetSnapshotError(
        "request_timeout",
        "Google Sheet export timed out. Try again."
      );
    }
    throw new GoogleSheetSnapshotError(
      "sheet_unavailable",
      "The Google Sheet could not be downloaded. Make it available to anyone with the link and try again."
    );
  } finally {
    if (timer) clearTimeout(timer);
  }
}
