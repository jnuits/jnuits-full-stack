import "server-only";
import { logServerError } from "@/lib/errors/api-error";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
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

  if (!apiKey || !from) {
    logServerError("sendEmail: Resend is not configured", {
      hasApiKey: Boolean(apiKey),
      hasFrom: Boolean(from),
    });
    return { success: false, error: "Email delivery not configured." };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [options.to],
        reply_to: options.replyTo ?? from,
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
      return { success: false, error: `Resend error ${res.status}` };
    }

    const body = await res.json().catch(() => null);
    return { success: true, messageId: body?.id };
  } catch (err) {
    logServerError("sendEmail: fetch failed", err);
    return { success: false, error: "Network error sending email." };
  }
}
