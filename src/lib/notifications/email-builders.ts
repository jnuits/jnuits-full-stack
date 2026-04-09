/**
 * Email HTML builders — pure string functions, no React/JSX.
 *
 * Rationale: `react-dom/server` cannot be safely bundled inside Next.js
 * "use server" actions (the bundler tries to include it in client/edge
 * chunks). Plain HTML string functions are faster, smaller, and have zero
 * bundler conflict.
 */

// ── Shared design tokens ───────────────────────────────────────────────────

const BG = "#050506";
const SURFACE = "#0A0A0B";
const BORDER = "#1E1E22";
const TEXT = "#F2F2F3";
const MUTED = "#8A8A95";
const BLUE = "#005BFF";
const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function wrap(preview: string, content: string): string {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html lang="en">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="dark" />
<title>${esc(preview)}</title>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:${FONT};">
<span style="display:none;max-height:0;overflow:hidden;">${esc(preview)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:${SURFACE};border:1px solid ${BORDER};border-radius:16px;overflow:hidden;">
        <!-- Header -->
        <tr>
          <td style="padding:28px 32px 0;border-bottom:1px solid ${BORDER};">
            <p style="margin:0 0 16px;font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${BLUE};">JnUITS</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:28px 32px;">
            ${content}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid ${BORDER};background:${BG};">
            <p style="margin:0;font-size:11px;color:${MUTED};line-height:1.6;">
              Jagannath University IT Society &bull; Jagannath University, Dhaka &bull; Bangladesh<br/>
              <a href="https://jnuits.org.bd" style="color:${BLUE};text-decoration:none;">jnuits.org.bd</a>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function h1(text: string): string {
  return `<h1 style="margin:0 0 16px;font-size:26px;font-weight:700;color:${TEXT};line-height:1.3;">${esc(text)}</h1>`;
}

function p(text: string, extra = ""): string {
  return `<p style="margin:0 0 16px;font-size:15px;color:${MUTED};line-height:1.7;${extra}">${text}</p>`;
}

function card(rows: Array<[string, string]>): string {
  const inner = rows
    .map(
      ([label, value]) =>
        `<tr>
          <td style="padding:6px 0;">
            <p style="margin:0 0 2px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${MUTED};">${esc(label)}</p>
            <p style="margin:0;font-size:15px;color:${TEXT};">${esc(value)}</p>
          </td>
        </tr>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};border:1px solid ${BORDER};border-radius:12px;margin:0 0 20px;padding:0;">
    <tr><td style="padding:16px 20px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${inner}</table></td></tr>
  </table>`;
}

function codeBlock(value: string): string {
  return `<div style="background:${BG};border:1px solid ${BORDER};border-radius:12px;padding:14px 20px;margin:8px 0 20px;text-align:center;">
    <code style="font-size:22px;font-weight:700;letter-spacing:.25em;color:${BLUE};font-family:monospace;">${esc(value)}</code>
  </div>`;
}

function button(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
    <tr>
      <td style="border-radius:10px;background:${BLUE};">
        <a href="${esc(href)}" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;color:#fff;text-decoration:none;border-radius:10px;">${esc(label)}</a>
      </td>
    </tr>
  </table>`;
}

function link(label: string, href: string): string {
  return `<a href="${esc(href)}" style="color:${BLUE};text-decoration:none;">${esc(label)}</a>`;
}

function hr(): string {
  return `<hr style="border:none;border-top:1px solid ${BORDER};margin:20px 0;" />`;
}

// ── Email builders ─────────────────────────────────────────────────────────

export interface MembershipReceivedEmailProps {
  applicantName: string;
  applicantEmail: string;
}

export function buildMembershipReceivedEmail(props: MembershipReceivedEmailProps): string {
  const { applicantName, applicantEmail } = props;
  const content = [
    h1("Application received"),
    p(
      `Hi ${esc(applicantName)}, thank you for applying to join the Jagannath University IT Society. We&rsquo;ve received your application and our review team will process it within <strong style="color:${TEXT};">3&ndash;5 business days</strong>.`
    ),
    card([
      ["Application for", applicantName],
      ["Submitted from", applicantEmail],
    ]),
    p("You&rsquo;ll receive another email when a decision has been made. In the meantime, you can check your application status at any time:"),
    button("Check application status", "https://jnuits.org.bd/membership-form"),
    hr(),
    p(
      `If you didn&rsquo;t submit this application, please ${link("contact us", "https://jnuits.org.bd/contact")} immediately.`,
      "font-size:13px;margin:0;"
    ),
  ].join("");
  return wrap(`We've received your JnUITS membership application, ${applicantName}.`, content);
}

// ──────────────────────────────────────────────────────────────────────────

export interface MembershipApprovedEmailProps {
  applicantName: string;
  jnuitsId: string;
  invitationCode: string;
  invitationExpiresAt: string;
}

export function buildMembershipApprovedEmail(props: MembershipApprovedEmailProps): string {
  const { applicantName, jnuitsId, invitationCode, invitationExpiresAt } = props;
  const expiryDate = new Date(invitationExpiresAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const content = [
    h1("🎉 Membership approved"),
    p(
      `Congratulations, ${esc(applicantName)}! Your membership application has been reviewed and <strong style="color:${TEXT};">approved</strong>. You are now registered as a JnUITS member.`
    ),
    card([["Your JnUITS ID", jnuitsId]]),
    p("Use the claim code below to create your member portal account. This code is unique to you &mdash; don&rsquo;t share it."),
    `<p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${MUTED};">Your claim code</p>`,
    codeBlock(invitationCode),
    p(
      `This code expires on <strong style="color:${TEXT};">${esc(expiryDate)}</strong>. Use it to sign up at the link below.`,
      "font-size:13px;"
    ),
    button("Claim your member account", "https://jnuits.org.bd/claim"),
    hr(),
    p(
      `Having trouble? Reply to this email or ${link("contact us", "https://jnuits.org.bd/contact")}.`,
      "font-size:13px;margin:0;"
    ),
  ].join("");
  return wrap(`Congratulations ${applicantName} — your JnUITS membership has been approved!`, content);
}

// ──────────────────────────────────────────────────────────────────────────

export interface MembershipRejectedEmailProps {
  applicantName: string;
  reviewNote?: string | null;
}

export function buildMembershipRejectedEmail(props: MembershipRejectedEmailProps): string {
  const { applicantName, reviewNote } = props;
  const noteBlock = reviewNote
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};border:1px solid ${BORDER};border-left:3px solid ${MUTED};border-radius:12px;margin:0 0 20px;">
        <tr><td style="padding:16px 20px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${MUTED};">Reviewer note</p>
          <p style="margin:0;font-size:15px;color:${TEXT};">${esc(reviewNote)}</p>
        </td></tr>
      </table>`
    : "";
  const content = [
    h1("Application decision"),
    p(
      `Hi ${esc(applicantName)}, thank you for your interest in joining JnUITS. After careful review, we were unable to approve your membership application at this time.`
    ),
    noteBlock,
    p("If you believe this decision was made in error, or if your circumstances have changed, you&rsquo;re welcome to reapply in a future intake period or reach out to us directly."),
    button("Get in touch", "https://jnuits.org.bd/contact"),
    hr(),
    p("We appreciate your interest in JnUITS and hope to welcome you in the future.", "font-size:13px;margin:0;"),
  ].join("");
  return wrap("An update on your JnUITS membership application.", content);
}

// ──────────────────────────────────────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  full_name: "Full name",
  phone: "Phone number",
  linkedin_url: "LinkedIn URL",
  website_url: "Website URL",
  current_organization: "Current organization",
  designation: "Job title / designation",
  work_location: "Work location",
  professional_visibility: "Profile visibility",
};

export interface ProfileChangeApprovedEmailProps {
  memberName: string;
  changedFields: string[];
  reviewNote?: string | null;
}

export function buildProfileChangeApprovedEmail(props: ProfileChangeApprovedEmailProps): string {
  const { memberName, changedFields, reviewNote } = props;
  const fieldList = changedFields
    .map((f) => `<li style="color:${TEXT};font-size:14px;line-height:1.8;">${esc(FIELD_LABELS[f] ?? f)}</li>`)
    .join("");
  const noteBlock = reviewNote
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};border:1px solid ${BORDER};border-radius:12px;margin:0 0 20px;">
        <tr><td style="padding:14px 18px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${MUTED};">Note from our team</p>
          <p style="margin:0;font-size:15px;color:${TEXT};">${esc(reviewNote)}</p>
        </td></tr>
      </table>`
    : "";
  const content = [
    h1("Profile update approved"),
    p(`Hi ${esc(memberName)}, your profile change request has been reviewed and approved. The following fields have been updated on your member profile:`),
    `<ul style="margin:0 0 20px;padding:0 0 0 20px;color:${MUTED};">${fieldList}</ul>`,
    noteBlock,
    button("View your profile", "https://jnuits.org.bd/profile"),
    hr(),
    p(
      `Need to make another change? ${link("Visit your profile editor", "https://jnuits.org.bd/profile/edit")}.`,
      "font-size:13px;margin:0;"
    ),
  ].join("");
  return wrap("Your JnUITS profile update has been approved.", content);
}

// ──────────────────────────────────────────────────────────────────────────

export interface ProfileChangeRejectedEmailProps {
  memberName: string;
  reviewNote?: string | null;
}

export function buildProfileChangeRejectedEmail(props: ProfileChangeRejectedEmailProps): string {
  const { memberName, reviewNote } = props;
  const noteBlock = reviewNote
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};border:1px solid ${BORDER};border-left:3px solid ${MUTED};border-radius:12px;margin:0 0 20px;">
        <tr><td style="padding:16px 20px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${MUTED};">Reason</p>
          <p style="margin:0;font-size:15px;color:${TEXT};">${esc(reviewNote)}</p>
        </td></tr>
      </table>`
    : "";
  const content = [
    h1("Profile update decision"),
    p(`Hi ${esc(memberName)}, your recent profile change request has been reviewed. Unfortunately, we were unable to approve the requested changes at this time.`),
    noteBlock,
    p("If you believe there&rsquo;s been an error or would like to submit a revised request, you can do so from your profile editor at any time."),
    button("Submit a new request", "https://jnuits.org.bd/profile/edit"),
    hr(),
    p(
      `Have questions? ${link("Contact us", "https://jnuits.org.bd/contact")}.`,
      "font-size:13px;margin:0;"
    ),
  ].join("");
  return wrap("An update on your JnUITS profile change request.", content);
}

// ──────────────────────────────────────────────────────────────────────────

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export interface EventConfirmationEmailProps {
  registrantName: string;
  eventTitle: string;
  eventStart: string;
  eventLocation: string;
  registrationCode: string;
}

export function buildEventConfirmationEmail(props: EventConfirmationEmailProps): string {
  const { registrantName, eventTitle, eventStart, eventLocation, registrationCode } = props;
  const formattedDate = DATE_FMT.format(new Date(eventStart));
  const content = [
    h1("Registration confirmed"),
    p(`Hi ${esc(registrantName)}, you&rsquo;re all set! Your registration for <strong style="color:${TEXT};">${esc(eventTitle)}</strong> has been confirmed.`),
    card([
      ["Event", eventTitle],
      ["Date & time", formattedDate],
      ["Location", eventLocation],
    ]),
    p("Present this code at the entry point for check-in. Keep it safe &mdash; it&rsquo;s unique to you."),
    `<p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${MUTED};">Your check-in code</p>`,
    codeBlock(registrationCode),
    button("View event details", "https://jnuits.org.bd/events"),
    hr(),
    p(
      `Can&rsquo;t attend? Please ${link("let us know", "https://jnuits.org.bd/contact")} so we can free up your spot.`,
      "font-size:13px;margin:0;"
    ),
  ].join("");
  return wrap(`You're registered for ${eventTitle}. Your check-in code: ${registrationCode}`, content);
}
