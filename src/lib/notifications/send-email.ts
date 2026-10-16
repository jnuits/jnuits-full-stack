import "server-only";
import { logServerError } from "@/lib/errors/api-error";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Server-only key override for a separately managed provider integration. */
  providerApiKey?: string;
  timeoutMs?: number;
  replyTo?: string;
  idempotencyKey?: string;
  /** Verification emails may not expose echoed provider bodies or credentials. */
  redactProviderErrors?: boolean;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  failureKind?: "configuration" | "rejected" | "rate_limited" | "uncertain";
  httpStatus?: number;
}

function summarizeResendError(status: number, body: unknown) {
  if (!body || typeof body !== "object") {
    return `Resend error ${status}`;
  }

  const payload = body as {
    error?: { message?: unknown; name?: unknown };
    message?: unknown;
    name?: unknown;
  };
  const message =
    typeof payload.message === "string"
      ? payload.message
      : typeof payload.error?.message === "string"
        ? payload.error.message
        : "";
  const name =
    typeof payload.name === "string"
      ? payload.name
      : typeof payload.error?.name === "string"
        ? payload.error.name
        : "";

  return [name || `Resend error ${status}`, message].filter(Boolean).join(": ");
}

/**
 * Sends a transactional email via Resend.
 * NEVER throws — returns { success: false } so notification failures never
 * break the admin action that triggered them.
 */
export async function sendEmail(
  options: SendEmailOptions
): Promise<SendEmailResult> {
  const apiKey = options.providerApiKey ?? process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const replyTo = process.env.RESEND_REPLY_TO || from;

  if (!apiKey || !from) {
    logServerError("sendEmail: Resend is not configured", {
      hasApiKey: Boolean(apiKey),
      hasFrom: Boolean(from),
    });
    return { success: false, error: "Email delivery not configured.", failureKind: "configuration" };
  }

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };

    if (options.idempotencyKey) {
      headers["Idempotency-Key"] = options.idempotencyKey;
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers,
      ...(options.timeoutMs ? { signal: AbortSignal.timeout(options.timeoutMs) } : {}),
      body: JSON.stringify({
        from,
        to: [options.to],
        reply_to: options.replyTo ?? replyTo,
        subject: options.subject,
        html: options.html,
        ...(options.text ? { text: options.text } : {}),
      }),
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => null);
      logServerError("sendEmail: Resend returned non-OK", options.redactProviderErrors ? { status: res.status } : {
        status: res.status,
        body: errorBody,
        to: options.to,
        subject: options.subject,
      });
      // Timeouts, conflicts and server errors may follow an accepted send.
      // Durable callers must keep the original payload/key and retry window.
      const failureKind = res.status === 429 ? "rate_limited"
        : res.status >= 500 || res.status === 408 || res.status === 409 ? "uncertain" : "rejected";
      return { success: false, failureKind, httpStatus: res.status,
        error: options.redactProviderErrors ? "Email delivery failed." : summarizeResendError(res.status, errorBody) };
    }

    const body = await res.json().catch(() => null);
    if (typeof body?.id !== "string" || !body.id.trim()) {
      return { success: false, failureKind: "uncertain", error: "Email acceptance could not be confirmed." };
    }
    return { success: true, messageId: body.id };
  } catch (err) {
    logServerError("sendEmail: fetch failed", options.redactProviderErrors ? { kind: "transport_error" } : err);
    return { success: false, failureKind: "uncertain", error: "Network error sending email." };
  }
}
