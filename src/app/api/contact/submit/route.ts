import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const contactSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(10).max(3000),
  website: z.string().trim().max(0).optional().or(z.literal("")),
});

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function parsePayload(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return {
      isFormPost: false,
      data: await request.json().catch(() => null),
    };
  }

  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return {
      isFormPost: true,
      data: null,
    };
  }

  return {
    isFormPost: true,
    data: {
      name: formData.get("name"),
      email: formData.get("email"),
      subject: formData.get("subject"),
      message: formData.get("message"),
      website: formData.get("website"),
    },
  };
}

function buildContactRedirect(request: NextRequest, key: "message" | "error", value: string) {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = "/contact";
  redirectUrl.search = "";
  redirectUrl.searchParams.set(key, value);
  return NextResponse.redirect(redirectUrl);
}

export async function POST(request: NextRequest) {
  const parsedPayload = await parsePayload(request);
  const parsed = contactSchema.safeParse(parsedPayload.data);

  if (!parsed.success) {
    const message =
      parsed.error.flatten().formErrors[0] || "Please review the submitted contact form.";

    return parsedPayload.isFormPost
      ? buildContactRedirect(request, "error", message)
      : NextResponse.json({ message }, { status: 400 });
  }

  if (parsed.data.website && parsed.data.website.length > 0) {
    return parsedPayload.isFormPost
      ? buildContactRedirect(request, "message", "Thanks. Your message was received.")
      : NextResponse.json({ success: true }, { status: 200 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const replyTo = process.env.RESEND_REPLY_TO || parsed.data.email;

  if (!apiKey || !from) {
    const message = "Contact delivery is not configured yet.";
    return parsedPayload.isFormPost
      ? buildContactRedirect(request, "error", message)
      : NextResponse.json({ message }, { status: 503 });
  }

  const safeMessage = escapeHtml(parsed.data.message).replace(/\n/g, "<br />");
  const safeName = escapeHtml(parsed.data.name);
  const safeEmail = escapeHtml(parsed.data.email);
  const safeSubject = escapeHtml(parsed.data.subject);

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: ["info@jnuits.org.bd"],
      reply_to: replyTo,
      subject: `[JnUITS Contact] ${parsed.data.subject}`,
      html: `
        <h2>New JnUITS contact message</h2>
        <p><strong>Name:</strong> ${safeName}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Subject:</strong> ${safeSubject}</p>
        <p><strong>Message:</strong></p>
        <p>${safeMessage}</p>
      `,
    }),
  });

  if (!resendResponse.ok) {
    const errorPayload = (await resendResponse.json().catch(() => null)) as
      | { message?: string; error?: string }
      | null;
    const message =
      errorPayload?.message || errorPayload?.error || "Failed to send contact message.";

    return parsedPayload.isFormPost
      ? buildContactRedirect(request, "error", message)
      : NextResponse.json({ message }, { status: 502 });
  }

  return parsedPayload.isFormPost
    ? buildContactRedirect(request, "message", "Your message has been sent.")
    : NextResponse.json({ success: true }, { status: 200 });
}
