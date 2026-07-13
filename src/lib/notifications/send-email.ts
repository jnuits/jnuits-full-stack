import "server-only";
import { logServerError } from "@/lib/errors/api-error";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  idempotencyKey?: string;
}

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
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
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const replyTo = process.env.RESEND_REPLY_TO || from;

  if (!apiKey || !from) {
    logServerError("sendEmail: Resend is not configured", {
      hasApiKey: Boolean(apiKey),
      hasFrom: Boolean(from),
    });
    return { success: false, error: "Email delivery not configured." };
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
      body: JSON.stringify({
        from,
        to: [options.to],
        reply_to: options.replyTo ?? replyTo,
        subject: options.subject,
        html: options.html,
      }),
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => null);
      logServerError("sendEmail: Resend returned non-OK", {
        status: res.status,
        body: errorBody,
        to: options.to,
        subject: options.subject,
      });
      return { success: false, error: summarizeResendError(res.status, errorBody) };
    }

    const body = await res.json().catch(() => null);
    return { success: true, messageId: body?.id };
  } catch (err) {
    logServerError("sendEmail: fetch failed", err);
    return { success: false, error: "Network error sending email." };
  }
}
