import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { brandProfile } from "@/lib/branding";
import { sendEmail } from "@/lib/notifications/send-email";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { withApiGuard } from "@/lib/security/with-api-guard";

const contactCategories = [
  "general",
  "membership",
  "certificate",
  "events",
  "media",
  "partnership",
] as const;

type ContactCategory = (typeof contactCategories)[number];

const categoryLabels: Record<ContactCategory, string> = {
  certificate: "Certificate verification",
  events: "Events and programs",
  general: "General inquiry",
  media: "Media and public relations",
  membership: "Membership and alumni",
  partnership: "Partnership and sponsorship",
};

const contactSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  category: z.enum(contactCategories).default("general"),
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(10).max(3000),
  website: z.string().trim().max(200).optional().or(z.literal("")),
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
      category: formData.get("category") || undefined,
      subject: formData.get("subject"),
      message: formData.get("message"),
      website: formData.get("website"),
    },
  };
}

function buildContactRedirect(
  request: NextRequest,
  key: "message" | "error",
  value: string
) {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = "/contact";
  redirectUrl.search = "";
  redirectUrl.searchParams.set(key, value);
  return NextResponse.redirect(redirectUrl);
}

async function handleContactSubmit(request: NextRequest): Promise<NextResponse> {
  const parsedPayload = await parsePayload(request);
  const parsed = contactSchema.safeParse(parsedPayload.data);

  if (!parsed.success) {
    const message =
      parsed.error.flatten().formErrors[0] ||
      "Please review the submitted contact form.";

    return parsedPayload.isFormPost
      ? buildContactRedirect(request, "error", message)
      : NextResponse.json({ message }, { status: 400 });
  }

  // Honeypot — silently treat filled website field as success to fool bots
  if (parsed.data.website && parsed.data.website.length > 0) {
    return parsedPayload.isFormPost
      ? buildContactRedirect(request, "message", "Thanks. Your message was received.")
      : NextResponse.json({ success: true }, { status: 200 });
  }

  const replyTo = process.env.RESEND_REPLY_TO || parsed.data.email;

  const safeMessage = escapeHtml(parsed.data.message).replace(/\n/g, "<br />");
  const safeName = escapeHtml(parsed.data.name);
  const safeEmail = escapeHtml(parsed.data.email);
  const safeCategory = escapeHtml(categoryLabels[parsed.data.category]);
  const safeSubject = escapeHtml(parsed.data.subject);
  const safeSource = escapeHtml(
    request.headers.get("referer")?.slice(0, 240) || "Public contact page"
  );

  const delivery = await sendEmail({
    to: brandProfile.email,
    replyTo,
    subject: `[JnUITS Contact] ${parsed.data.subject}`,
    html: `
        <h2>New JnUITS contact message</h2>
        <p><strong>Name:</strong> ${safeName}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Category:</strong> ${safeCategory}</p>
        <p><strong>Subject:</strong> ${safeSubject}</p>
        <p><strong>Source:</strong> ${safeSource}</p>
        <p><strong>Message:</strong></p>
        <p>${safeMessage}</p>
      `,
  });

  if (!delivery.success) {
    const isMissingConfig = delivery.error === "Email delivery not configured.";
    const message = isMissingConfig
      ? "Contact delivery is not configured yet."
      : "Unable to send your message right now. Please try again or contact us directly.";

    return parsedPayload.isFormPost
      ? buildContactRedirect(request, "error", message)
      : NextResponse.json({ message }, { status: isMissingConfig ? 503 : 502 });
  }

  return parsedPayload.isFormPost
    ? buildContactRedirect(request, "message", "Your message has been sent.")
    : NextResponse.json({ success: true }, { status: 200 });
}

export const POST = withApiGuard(handleContactSubmit, {
  rateLimit: RATE_LIMITS.contactSubmit,
});
