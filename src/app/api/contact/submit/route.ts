import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { brandProfile } from "@/lib/branding";
import { sendEmail } from "@/lib/notifications/send-email";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { withApiGuard } from "@/lib/security/with-api-guard";

const contactCategories = [
  "general",
  "membership_registration",
  "event_collaboration",
  "sponsorship_partnership",
  "certificate_verification",
  "media_press",
  "technical_support",
  "workshop_training",
  "job_internship_posting",
  "feedback_suggestions",
] as const;

type ContactCategory = (typeof contactCategories)[number];

const categoryLabels: Record<ContactCategory, string> = {
  certificate_verification: "Certificate Verification",
  event_collaboration: "Event Collaboration",
  feedback_suggestions: "Feedback & Suggestions",
  general: "General Inquiry",
  job_internship_posting: "Job & Internship Posting",
  media_press: "Media & Press",
  membership_registration: "Membership & Registration",
  sponsorship_partnership: "Sponsorship & Partnership",
  technical_support: "Technical Support",
  workshop_training: "Workshop & Training",
};

const senderTypes = [
  "jnu_student",
  "jnuits_member",
  "jnu_faculty_staff",
  "student_other_university",
  "university_organisation",
  "tech_company",
  "edtech_company",
  "ngo_nonprofit",
  "media_press",
  "other",
] as const;

type SenderType = (typeof senderTypes)[number];

const senderTypeLabels: Record<SenderType, string> = {
  edtech_company: "EdTech Company",
  jnu_faculty_staff: "JnU Faculty / Staff",
  jnu_student: "JnU Student",
  jnuits_member: "JnUITS Member",
  media_press: "Media / Press",
  ngo_nonprofit: "NGO / Non-profit",
  other: "Other",
  student_other_university: "Student from Another University",
  tech_company: "Tech Company",
  university_organisation: "University Organisation",
};

const contactSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  additional_info: z.string().trim().max(1200).optional().or(z.literal("")),
  category: z.enum(contactCategories).default("general"),
  cf_turnstile_token: z.string().trim().max(4096).optional().or(z.literal("")),
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(10).max(3000),
  phone_whatsapp: z.string().trim().max(40).optional().or(z.literal("")),
  sender_type: z.enum(senderTypes),
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
      additional_info: formData.get("additional_info"),
      category: formData.get("category") || undefined,
      cf_turnstile_token: formData.get("cf_turnstile_token"),
      subject: formData.get("subject"),
      message: formData.get("message"),
      phone_whatsapp: formData.get("phone_whatsapp"),
      sender_type: formData.get("sender_type"),
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

  // TODO: Verify cf_turnstile_token against
  // https://challenges.cloudflare.com/turnstile/v0/siteverify
  // using TURNSTILE_SECRET_KEY (server-side env var, never public)

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
  const safeAdditionalInfo = parsed.data.additional_info
    ? escapeHtml(parsed.data.additional_info).replace(/\n/g, "<br />")
    : "";
  const safeCategory = escapeHtml(categoryLabels[parsed.data.category]);
  const safePhoneWhatsapp = parsed.data.phone_whatsapp
    ? escapeHtml(parsed.data.phone_whatsapp)
    : "Not provided";
  const safeSenderType = escapeHtml(senderTypeLabels[parsed.data.sender_type]);
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
        <p><strong>Sender type:</strong> ${safeSenderType}</p>
        <p><strong>Phone / WhatsApp:</strong> ${safePhoneWhatsapp}</p>
        <p><strong>Category:</strong> ${safeCategory}</p>
        <p><strong>Subject:</strong> ${safeSubject}</p>
        <p><strong>Source:</strong> ${safeSource}</p>
        <p><strong>Message:</strong></p>
        <p>${safeMessage}</p>
        ${
          safeAdditionalInfo
            ? `<p><strong>Additional information:</strong></p><p>${safeAdditionalInfo}</p>`
            : ""
        }
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
