import type { CertificateRecord } from "@/lib/certificates/queries";

export const CERTIFICATE_TYPE_OPTIONS = [
  { label: "Course", value: "course" },
  { label: "Event", value: "event" },
] as const;

const issueDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

function ensureSentence(value: string) {
  const text = value.trim();

  if (!text) {
    return "";
  }

  return /[.!?]$/.test(text) ? text : `${text}.`;
}

export function getCertificateDisplayName(certificate: CertificateRecord) {
  return [certificate.first_name, certificate.last_name].filter(Boolean).join(" ").trim();
}

export function getCertificateType(certificate: CertificateRecord) {
  const normalized = String(certificate.exam_or_event || "").trim().toLowerCase();

  if (normalized === "event") {
    return CERTIFICATE_TYPE_OPTIONS[1];
  }

  return CERTIFICATE_TYPE_OPTIONS[0];
}

export function getCertificateSubjectColumnLabel(certificate: CertificateRecord) {
  return getCertificateType(certificate).label;
}

export function formatCertificateIssueDate(value: string) {
  const parsed = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return issueDateFormatter.format(parsed);
}

export function getCertificateNarrative(certificate: CertificateRecord) {
  const displayName = getCertificateDisplayName(certificate).toUpperCase();
  return ensureSentence(`${displayName} ${certificate.details}`);
}
