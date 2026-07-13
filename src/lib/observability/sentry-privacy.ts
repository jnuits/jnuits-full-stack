import type {
  Breadcrumb,
  ErrorEvent,
  Event,
  SpanJSON,
  TransactionEvent,
} from "@sentry/core";

const REDACTED = "[REDACTED]";
const REDACTED_EMAIL = "[REDACTED_EMAIL]";
const PRIVATE_BREADCRUMB_CATEGORIES = new Set([
  "console",
  "fetch",
  "navigation",
  "xhr",
]);
const SENSITIVE_KEY_PATTERN =
  /address|authorization|captcha|cookie|credential|email|full[_-]?name|ip(?:[_-]?address)?|name|otp|pass(?:word|code)?|phone|query|secret|session|token|user(name)?/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /(?:\+?\d[\d\s().-]*){9,}\d/g;

type MutableRecord = Record<string, unknown>;

function isRecord(value: unknown): value is MutableRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function redactText(value: string) {
  return value
    .replace(EMAIL_PATTERN, REDACTED_EMAIL)
    .replace(PHONE_PATTERN, REDACTED);
}

function stripUrlDetails(value: string) {
  try {
    const url = new URL(value);

    url.hash = "";
    url.search = "";
    return url.toString();
  } catch {
    return value.split(/[?#]/, 1)[0] || "";
  }
}

function scrubValue(value: unknown): unknown {
  if (typeof value === "string") {
    return redactText(value);
  }

  if (Array.isArray(value)) {
    return value.map(scrubValue);
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        return [key, REDACTED];
      }

      if (key === "url" && typeof entry === "string") {
        return [key, stripUrlDetails(entry)];
      }

      return [key, scrubValue(entry)];
    })
  );
}

function cloneEvent<T extends Event>(event: T): MutableRecord | null {
  try {
    return JSON.parse(JSON.stringify(event)) as MutableRecord;
  } catch {
    return null;
  }
}

function scrubStoredBreadcrumb(breadcrumb: Breadcrumb) {
  const scrubbed = scrubValue(breadcrumb) as MutableRecord;

  delete scrubbed.message;
  return scrubbed as Breadcrumb;
}

function scrubRequest(value: unknown) {
  const request = isRecord(value) ? value : null;

  if (!request) {
    return undefined;
  }

  const sanitized: MutableRecord = {};

  if (typeof request.method === "string") {
    sanitized.method = request.method;
  }

  if (typeof request.url === "string") {
    sanitized.url = stripUrlDetails(request.url);
  }

  return sanitized;
}

function scrubUser(value: unknown) {
  const user = isRecord(value) ? value : null;

  if (!user || typeof user.id !== "string") {
    return undefined;
  }

  return { id: user.id };
}

export function scrubSentryBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (PRIVATE_BREADCRUMB_CATEGORIES.has(breadcrumb.category || "")) {
    return null;
  }

  return scrubStoredBreadcrumb(breadcrumb);
}

export function scrubSentrySpan<T extends SpanJSON>(span: T): T {
  return scrubValue(span) as T;
}

export function scrubSentryEvent<T extends Event>(event: T): T | null {
  const scrubbed = cloneEvent(event);

  if (!scrubbed) {
    return null;
  }

  scrubbed.request = scrubRequest(scrubbed.request);
  scrubbed.user = scrubUser(scrubbed.user);
  scrubbed.breadcrumbs = Array.isArray(scrubbed.breadcrumbs)
    ? scrubbed.breadcrumbs
        .map((breadcrumb) => scrubSentryBreadcrumb(breadcrumb as Breadcrumb))
        .filter((breadcrumb): breadcrumb is Breadcrumb => Boolean(breadcrumb))
    : scrubbed.breadcrumbs;
  scrubbed.contexts = scrubValue(scrubbed.contexts);
  scrubbed.exception = scrubValue(scrubbed.exception);
  scrubbed.extra = scrubValue(scrubbed.extra);
  scrubbed.fingerprint = scrubValue(scrubbed.fingerprint);
  scrubbed.logentry = scrubValue(scrubbed.logentry);
  scrubbed.message =
    typeof scrubbed.message === "string" ? redactText(scrubbed.message) : scrubbed.message;
  scrubbed.spans = Array.isArray(scrubbed.spans)
    ? scrubbed.spans.map((span) => scrubSentrySpan(span as SpanJSON))
    : scrubbed.spans;
  scrubbed.tags = scrubValue(scrubbed.tags);
  scrubbed.transaction =
    typeof scrubbed.transaction === "string"
      ? redactText(scrubbed.transaction)
      : scrubbed.transaction;

  return scrubbed as T;
}

export function getSentryPrivacyOptions() {
  return {
    beforeBreadcrumb: scrubSentryBreadcrumb,
    beforeSend: (event: ErrorEvent) => scrubSentryEvent(event),
    beforeSendSpan: (span: SpanJSON) => scrubSentrySpan(span),
    beforeSendTransaction: (event: TransactionEvent) => scrubSentryEvent(event),
    dataCollection: {
      cookies: false,
      frameContextLines: 0,
      genAI: { inputs: false, outputs: false },
      httpBodies: [],
      httpHeaders: { request: false, response: false },
      queryParams: false,
      stackFrameVariables: false,
      userInfo: false,
    },
    enableLogs: false,
    includeLocalVariables: false,
  };
}
