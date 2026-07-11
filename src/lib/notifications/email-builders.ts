/**
 * Email HTML builders — pure string functions, no React/JSX.
 *
 * Rationale: `react-dom/server` cannot be safely bundled inside Next.js
 * "use server" actions (the bundler tries to include it in client/edge
 * chunks). Plain HTML string functions are faster, smaller, and have zero
 * bundler conflict.
 */

// ── Shared design tokens ───────────────────────────────────────────────────

const BG = "#F5F7FB";
const SURFACE = "#FFFFFF";
const SOFT = "#F8FAFF";
const BORDER = "#D9E1F2";
const TEXT = "#111735";
const MUTED = "#5F6B85";
const BLUE = "#2F55D4";
const DARK_BG = "#06070A";
const DARK_SURFACE = "#11131A";
const DARK_SOFT = "#171A24";
const DARK_BORDER = "#2B3142";
const DARK_TEXT = "#F4F7FF";
const DARK_MUTED = "#A7B0C2";
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
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>${esc(preview)}</title>
<style>
  @media (prefers-color-scheme: dark) {
    .email-bg { background:${DARK_BG} !important; }
    .email-shell { background:${DARK_SURFACE} !important; border-color:${DARK_BORDER} !important; }
    .email-soft { background:${DARK_SOFT} !important; border-color:${DARK_BORDER} !important; }
    .email-heading, .email-value, .email-code { color:${DARK_TEXT} !important; }
    .email-copy, .email-label, .email-footer { color:${DARK_MUTED} !important; }
    .email-footer-cell { background:${DARK_BG} !important; border-color:${DARK_BORDER} !important; }
  }
</style>
</head>
<body class="email-bg" style="margin:0;padding:0;background:${BG};font-family:${FONT};">
<span style="display:none;max-height:0;overflow:hidden;">${esc(preview)}</span>
<table class="email-bg" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <table class="email-shell" role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:${SURFACE};border:1px solid ${BORDER};border-radius:16px;overflow:hidden;">
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
          <td class="email-footer-cell" style="padding:20px 32px;border-top:1px solid ${BORDER};background:${BG};">
            <p class="email-footer" style="margin:0;font-size:11px;color:${MUTED};line-height:1.6;">
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
  return `<h1 class="email-heading" style="margin:0 0 16px;font-size:26px;font-weight:700;color:${TEXT};line-height:1.3;">${esc(text)}</h1>`;
}

function p(text: string, extra = ""): string {
  return `<p class="email-copy" style="margin:0 0 16px;font-size:15px;color:${MUTED};line-height:1.7;${extra}">${text}</p>`;
}

function card(rows: Array<[string, string]>): string {
  const inner = rows
    .map(
      ([label, value]) =>
        `<tr>
          <td style="padding:6px 0;">
            <p class="email-label" style="margin:0 0 2px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${MUTED};">${esc(label)}</p>
            <p class="email-value" style="margin:0;font-size:15px;color:${TEXT};">${esc(value)}</p>
          </td>
        </tr>`
    )
    .join("");
  return `<table class="email-soft" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${SOFT};border:1px solid ${BORDER};border-radius:12px;margin:0 0 20px;padding:0;">
    <tr><td style="padding:16px 20px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${inner}</table></td></tr>
  </table>`;
}

function codeBlock(value: string, actionUrl?: string): string {
  const code = `<code class="email-code" style="font-size:22px;font-weight:700;letter-spacing:.25em;color:${BLUE};font-family:monospace;">${esc(value)}</code>`;
  return `<div class="email-soft" style="background:${SOFT};border:1px solid ${BORDER};border-radius:12px;padding:14px 20px;margin:8px 0 20px;text-align:center;">
    ${
      actionUrl
        ? `<a href="${esc(actionUrl)}" style="display:block;text-decoration:none;">${code}</a>`
        : code
    }
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

function fallbackLink(href: string): string {
  return p(
    `If the button does not open, copy and paste this link into your browser:<br/><a href="${esc(href)}" style="color:${BLUE};text-decoration:none;word-break:break-all;">${esc(href)}</a>`,
    "font-size:13px;margin:0 0 16px;"
  );
}

function orderedSteps(items: string[]): string {
  const listItems = items
    .map(
      (item) =>
        `<li style="margin:0 0 8px;padding:0;color:${MUTED};font-size:14px;line-height:1.6;">${item}</li>`
    )
    .join("");

  return `<ol class="email-copy" style="margin:0 0 18px;padding:0 0 0 20px;color:${MUTED};">${listItems}</ol>`;
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
  applicantEmail?: string;
  claimUrl?: string;
  jnuitsId: string;
  invitationCode: string;
  invitationExpiresAt: string;
}

export function buildMembershipApprovedEmail(props: MembershipApprovedEmailProps): string {
  const {
    applicantEmail,
    applicantName,
    claimUrl = "https://jnuits.org.bd/register",
    jnuitsId,
    invitationCode,
    invitationExpiresAt,
  } = props;
  const expiryDate = new Date(invitationExpiresAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const content = [
    h1("Membership approved"),
    p(
      `Congratulations, ${esc(applicantName)}! Your membership application has been reviewed and <strong class="email-value" style="color:${TEXT};">approved</strong>. You are now registered as a JnUITS member.`
    ),
    card(
      [
        ["Your JnUITS ID", jnuitsId],
        applicantEmail ? ["Email", applicantEmail] : null,
        ["Invite expires", expiryDate],
      ].filter((row): row is [string, string] => Boolean(row))
    ),
    p("Open the registration page and enter the invitation details manually. For security, the form will not prefill fields from this email."),
    `<p class="email-label" style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${MUTED};">Your claim code</p>`,
    codeBlock(invitationCode),
    orderedSteps([
      `Enter your JnUITS ID: <strong class="email-value" style="color:${TEXT};">${esc(jnuitsId)}</strong>.`,
      applicantEmail
        ? `Enter this email address: <strong class="email-value" style="color:${TEXT};">${esc(applicantEmail)}</strong>.`
        : "Enter the email address used for your approved application.",
      "Enter the claim code above and choose a password of at least 12 characters.",
      "Submit the form. If the claim succeeds, your portal account is created immediately; you do not need to wait for a second confirmation email.",
    ]),
    p(
      "Keep this email open while completing the form. The code is valid only until the expiry date above.",
      "font-size:13px;"
    ),
    button("Claim member profile", claimUrl),
    fallbackLink(claimUrl),
    hr(),
    p(
      `Having trouble? ${link("Contact JnUITS support", "https://jnuits.org.bd/contact")} and include your JnUITS ID.`,
      "font-size:13px;margin:0;"
    ),
  ].join("");
  return wrap(`Congratulations ${applicantName}, your JnUITS membership has been approved.`, content);
}

// ──────────────────────────────────────────────────────────────────────────

export interface MemberInvitationEmailProps {
  claimUrl?: string;
  invitationCode: string;
  invitationExpiresAt: string;
  jnuitsId: string;
  memberEmail?: string;
  memberName: string;
}

export function buildMemberInvitationEmail(props: MemberInvitationEmailProps): string {
  const {
    claimUrl = "https://jnuits.org.bd/register",
    invitationCode,
    invitationExpiresAt,
    jnuitsId,
    memberEmail,
    memberName,
  } = props;
  const expiryDate = new Date(invitationExpiresAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const content = [
    h1("Claim your JnUITS member account"),
    p(
      `Hi ${esc(memberName)}, an admin has invited you to claim your JnUITS member portal account. Your member ID will stay fixed for current and future alumni access.`
    ),
    card(
      [
        ["JnUITS ID", jnuitsId],
        memberEmail ? ["Email", memberEmail] : null,
        ["Invite expires", expiryDate],
      ].filter((row): row is [string, string] => Boolean(row))
    ),
    p("Open the registration page and enter the invitation details manually. For security, the form will not prefill fields from this email."),
    `<p class="email-label" style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${MUTED};">Claim code</p>`,
    codeBlock(invitationCode),
    orderedSteps([
      `Enter your JnUITS ID: <strong class="email-value" style="color:${TEXT};">${esc(jnuitsId)}</strong>.`,
      memberEmail
        ? `Enter this email address: <strong class="email-value" style="color:${TEXT};">${esc(memberEmail)}</strong>.`
        : "Enter the email address that received this invitation.",
      "Enter the claim code above and choose a password of at least 12 characters.",
      "Submit the form. If the claim succeeds, your portal account is created immediately; you do not need to wait for a second confirmation email.",
    ]),
    p("Keep this email open while completing the form. The code is valid only until the expiry date above.", "font-size:13px;"),
    button("Claim member profile", claimUrl),
    fallbackLink(claimUrl),
    hr(),
    p(
      `If this invitation looks unexpected or you need help, ${link("contact JnUITS support", "https://jnuits.org.bd/contact")} and include your JnUITS ID.`,
      "font-size:13px;margin:0;"
    ),
  ].join("");

  return wrap(`You have been invited to claim ${jnuitsId}.`, content);
}

export interface AlumniInvitationEmailProps {
  alumniName: string;
  alumniEmail?: string;
  claimUrl?: string;
  invitationCode: string;
  invitationExpiresAt: string;
  jnuitsId: string;
}

export function buildAlumniInvitationEmail(props: AlumniInvitationEmailProps): string {
  const {
    alumniEmail,
    alumniName,
    claimUrl = "https://jnuits.org.bd/register",
    invitationCode,
    invitationExpiresAt,
    jnuitsId,
  } = props;
  const expiryDate = new Date(invitationExpiresAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const content = [
    h1("Join the JnUITS alumni portal"),
    p(
      `Hi ${esc(alumniName)}, you have been invited to join the JnUITS alumni portal directly. Your permanent member ID remains <strong class="email-value" style="color:${TEXT};">${esc(jnuitsId)}</strong>.`
    ),
    card(
      [
        ["JnUITS ID", jnuitsId],
        alumniEmail ? ["Email", alumniEmail] : null,
        ["Invite expires", expiryDate],
      ].filter((row): row is [string, string] => Boolean(row))
    ),
    p("Open the registration page and enter the invitation details manually. For security, the form will not prefill fields from this email."),
    `<p class="email-label" style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${MUTED};">Claim code</p>`,
    codeBlock(invitationCode),
    orderedSteps([
      `Enter your JnUITS ID: <strong class="email-value" style="color:${TEXT};">${esc(jnuitsId)}</strong>.`,
      alumniEmail
        ? `Enter this email address: <strong class="email-value" style="color:${TEXT};">${esc(alumniEmail)}</strong>.`
        : "Enter the email address that received this invitation.",
      "Enter the claim code above and choose a password of at least 12 characters.",
      "Submit the form. If the claim succeeds, your alumni portal account is created immediately; you do not need to wait for a second confirmation email.",
    ]),
    p("Keep this email open while completing the form. The code is valid only until the expiry date above.", "font-size:13px;"),
    button("Claim alumni profile", claimUrl),
    fallbackLink(claimUrl),
    hr(),
    p(
      `Need help? ${link("Contact JnUITS support", "https://jnuits.org.bd/contact")} and include your JnUITS ID.`,
      "font-size:13px;margin:0;"
    ),
  ].join("");

  return wrap(`Your JnUITS alumni portal invitation for ${jnuitsId}.`, content);
}

export interface AlumniConversionDecisionEmailProps {
  approved: boolean;
  memberName: string;
  reviewNote?: null | string;
}

export function buildAlumniConversionDecisionEmail(
  props: AlumniConversionDecisionEmailProps
): string {
  const { approved, memberName, reviewNote } = props;
  const noteBlock = reviewNote
    ? card([["Review note", reviewNote]])
    : "";
  const content = approved
    ? [
        h1("Alumni access approved"),
        p(
          `Hi ${esc(memberName)}, your alumni conversion request has been approved. Your profile is active again with alumni portal access.`
        ),
        noteBlock,
        button("Open alumni portal", "https://jnuits.org.bd/portal"),
        hr(),
        p("Your JnUITS ID remains unchanged.", "font-size:13px;margin:0;"),
      ].join("")
    : [
        h1("Alumni request reviewed"),
        p(
          `Hi ${esc(memberName)}, your alumni conversion request was reviewed but could not be approved at this time.`
        ),
        noteBlock,
        button("View portal", "https://jnuits.org.bd/portal"),
        hr(),
        p(
          `Questions about this decision? ${link("Contact JnUITS", "https://jnuits.org.bd/contact")}.`,
          "font-size:13px;margin:0;"
        ),
      ].join("");

  return wrap(
    approved
      ? "Your JnUITS alumni access has been approved."
      : "Your JnUITS alumni request has been reviewed.",
    content
  );
}

export interface DeletionRequestStatusEmailProps {
  approved: boolean;
  memberName: string;
  reviewNote?: null | string;
}

export function buildDeletionRequestStatusEmail(
  props: DeletionRequestStatusEmailProps
): string {
  const { approved, memberName, reviewNote } = props;
  const noteBlock = reviewNote
    ? card([["Review note", reviewNote]])
    : "";
  const content = approved
    ? [
        h1("Profile deletion approved"),
        p(
          `Hi ${esc(memberName)}, your JnUITS profile deletion request has been approved. Your public profile data has been deactivated while audit history is preserved for security and compliance.`
        ),
        noteBlock,
        hr(),
        p(
          `If you believe this was a mistake, please ${link("contact JnUITS", "https://jnuits.org.bd/contact")} immediately.`,
          "font-size:13px;margin:0;"
        ),
      ].join("")
    : [
        h1("Profile deletion request reviewed"),
        p(
          `Hi ${esc(memberName)}, your JnUITS profile deletion request was reviewed and was not approved at this time.`
        ),
        noteBlock,
        button("Open portal", "https://jnuits.org.bd/portal"),
        hr(),
        p(
          `Questions about this decision? ${link("Contact JnUITS", "https://jnuits.org.bd/contact")}.`,
          "font-size:13px;margin:0;"
        ),
      ].join("");

  return wrap(
    approved
      ? "Your JnUITS profile deletion request has been approved."
      : "Your JnUITS profile deletion request has been reviewed.",
    content
  );
}

export interface BulkOperationSummaryEmailProps {
  committedRows: number;
  errorRows: number;
  operationId: string;
  operationType: string;
  operatorName: string;
  totalRows: number;
}

export function buildBulkOperationSummaryEmail(
  props: BulkOperationSummaryEmailProps
): string {
  const {
    committedRows,
    errorRows,
    operationId,
    operationType,
    operatorName,
    totalRows,
  } = props;
  const content = [
    h1("Bulk operation completed"),
    p(`Hi ${esc(operatorName)}, a JnUITS bulk membership operation has completed.`),
    card([
      ["Operation", operationType.replaceAll("_", " ")],
      ["Operation ID", operationId],
      ["Total rows", String(totalRows)],
      ["Committed rows", String(committedRows)],
      ["Error rows", String(errorRows)],
    ]),
    button("Review bulk operations", "https://jnuits.org.bd/admin/bulk-operations"),
    hr(),
    p(
      "This is an operational summary for admin audit and reconciliation.",
      "font-size:13px;margin:0;"
    ),
  ].join("");

  return wrap(`Bulk operation ${operationType} committed ${committedRows} rows.`, content);
}

export interface SupportTicketUpdateEmailProps {
  actionLabel: string;
  ticketStatus: string;
  ticketSubject: string;
  ticketUrl: string;
}

/**
 * Deliberately omits reply contents: email is a notification channel, not a
 * second copy of a private support conversation.
 */
export function buildSupportTicketUpdateEmail(
  props: SupportTicketUpdateEmailProps
): string {
  const content = [
    h1("Support ticket updated"),
    p("There is a new update on a JnUITS support ticket you are participating in."),
    card([
      ["Ticket", props.ticketSubject],
      ["Current status", props.ticketStatus.replaceAll("_", " ")],
    ]),
    p("Open the secure ticket workspace to read the update and respond if needed."),
    button("Open support ticket", props.ticketUrl),
    fallbackLink(props.ticketUrl),
    hr(),
    p(
      `You received this because ticket updates are enabled in your JnUITS notification settings. ${esc(props.actionLabel)}.`,
      "font-size:13px;margin:0;"
    ),
  ].join("");

  return wrap(`Support ticket updated: ${props.ticketSubject}`, content);
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
  facebook_url: "Facebook URL",
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
    button("View your profile", "https://jnuits.org.bd/portal/profile"),
    hr(),
    p(
      `Need to make another change? ${link("Visit your profile editor", "https://jnuits.org.bd/portal/profile/edit")}.`,
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
    button("Submit a new request", "https://jnuits.org.bd/portal/profile/edit"),
    hr(),
    p(
      `Have questions? ${link("Contact us", "https://jnuits.org.bd/contact")}.`,
      "font-size:13px;margin:0;"
    ),
  ].join("");
  return wrap("An update on your JnUITS profile change request.", content);
}

export interface WorkplaceRequestDecisionEmailProps {
  approved: boolean;
  memberName: string;
  reviewNote?: null | string;
  updatedFields?: string[];
}

export function buildWorkplaceRequestDecisionEmail(
  props: WorkplaceRequestDecisionEmailProps
): string {
  const { approved, memberName, reviewNote, updatedFields = [] } = props;
  const noteBlock = reviewNote ? card([["Review note", reviewNote]]) : "";
  const fieldsBlock =
    updatedFields.length > 0
      ? card([["Updated fields", updatedFields.join(", ")]])
      : "";
  const content = [
    h1(approved ? "Workplace update approved" : "Workplace update reviewed"),
    p(
      approved
        ? `Hi ${esc(memberName)}, your workplace update request has been reviewed and approved. Your member profile now reflects the approved workplace details.`
        : `Hi ${esc(memberName)}, your workplace update request has been reviewed. We were unable to approve the requested changes at this time.`
    ),
    fieldsBlock,
    noteBlock,
    button("Open profile editor", "https://jnuits.org.bd/portal/profile/edit"),
    hr(),
    p(
      `Questions about this decision? ${link("Contact JnUITS", "https://jnuits.org.bd/contact")}.`,
      "font-size:13px;margin:0;"
    ),
  ].join("");

  return wrap(
    approved
      ? "Your JnUITS workplace update has been approved."
      : "Your JnUITS workplace update has been reviewed.",
    content
  );
}

export interface WorkplaceAdminCorrectionEmailProps {
  memberName: string;
  note?: null | string;
}

export function buildWorkplaceAdminCorrectionEmail(
  props: WorkplaceAdminCorrectionEmailProps
): string {
  const noteBlock = props.note ? card([["Admin note", props.note]]) : "";
  const content = [
    h1("Workplace profile updated"),
    p(
      `Hi ${esc(props.memberName)}, an admin updated your JnUITS workplace profile to keep the directory accurate.`
    ),
    noteBlock,
    button("View your profile", "https://jnuits.org.bd/portal/profile"),
    hr(),
    p(
      `If this looks wrong, ${link("submit a new workplace request", "https://jnuits.org.bd/portal/profile/edit")}.`,
      "font-size:13px;margin:0;"
    ),
  ].join("");

  return wrap("Your JnUITS workplace profile was updated.", content);
}

export interface WorkplaceRequestReceivedEmailProps {
  memberName: string;
}

export function buildWorkplaceRequestReceivedEmail(
  props: WorkplaceRequestReceivedEmailProps
): string {
  const content = [
    h1("Workplace request received"),
    p(
      `Hi ${esc(props.memberName)}, we received your workplace update request. An admin will review it before it appears in member-facing surfaces.`
    ),
    button("Open profile editor", "https://jnuits.org.bd/portal/profile/edit"),
  ].join("");

  return wrap("We received your JnUITS workplace update request.", content);
}

// ──────────────────────────────────────────────────────────────────────────

export interface EmailChangeVerificationEmailProps {
  actionLink: string;
  memberName: string;
  newEmail: string;
  oldEmail: string;
  step: "current" | "new";
}

export function buildEmailChangeVerificationEmail(
  props: EmailChangeVerificationEmailProps
): string {
  const { actionLink, memberName, newEmail, oldEmail, step } = props;
  const isCurrentStep = step === "current";
  const content = [
    h1(isCurrentStep ? "Confirm your current email" : "Confirm your new email"),
    p(
      `Hi ${esc(memberName)}, your JnUITS email change request was approved. To complete the change from <strong style="color:${TEXT};">${esc(oldEmail)}</strong> to <strong style="color:${TEXT};">${esc(newEmail)}</strong>, please verify this ${isCurrentStep ? "current" : "new"} email address.`
    ),
    button("Verify email change", actionLink),
    hr(),
    p(
      "If you did not request this change, ignore this email and contact JnUITS support.",
      "font-size:13px;margin:0;"
    ),
  ].join("");

  return wrap("Verify your JnUITS email change request.", content);
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

export interface AdminInvitationEmailProps {
  actionLink: string;
  adminRoleLabel: string;
  expiresInDays: number;
  recipientEmail: string;
  recipientName: string;
}

export function buildAdminInvitationEmail(props: AdminInvitationEmailProps): string {
  const content = [
    h1("Admin workspace invitation"),
    p(
      `Hi ${esc(props.recipientName)}, you have been invited to the JnUITS operator workspace as <strong class="email-value" style="color:${TEXT};">${esc(props.adminRoleLabel)}</strong>.`,
    ),
    card([
      ["Admin role", props.adminRoleLabel],
      ["Invited email", props.recipientEmail],
      ["Expires", `${props.expiresInDays} days from issue`],
    ]),
    orderedSteps([
      "Open the invitation link using the email address shown above.",
      "Set or confirm your Supabase account session. If you already use this email on JnUITS, sign in with that same account when prompted.",
      "Accept the admin invitation, then complete MFA setup before entering the workspace.",
    ]),
    button("Accept admin invitation", props.actionLink),
    fallbackLink(props.actionLink),
    hr(),
    p(
      `If this invitation was unexpected, ignore this email or ${link("contact JnUITS support", "https://jnuits.org.bd/contact")}.`,
      "font-size:13px;margin:0;",
    ),
  ].join("");

  return wrap("You have been invited to the JnUITS admin workspace.", content);
}