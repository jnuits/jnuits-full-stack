import Link from "next/link";
import { notFound } from "next/navigation";
import { findCertificateById, normalizeCertificateId } from "@/lib/certificates/queries";
import {
  formatCertificateIssueDate,
  getCertificateDisplayName,
  getCertificateNarrative,
  getCertificateSubjectColumnLabel,
  getCertificateType,
} from "@/lib/certificates/presentation";

function VerificationStateIcon() {
  return (
    <span className="certificate-state__icon" data-tone="valid" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
        <path d="M5 12.5 9.5 17 19 7.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export default async function CertificateDetailsPage({
  params,
}: {
  params: Promise<{ certificateId: string }>;
}) {
  const { certificateId: rawCertificateId } = await params;
  const certificateId = normalizeCertificateId(rawCertificateId);
  const certificate = await findCertificateById(certificateId);

  if (!certificate) {
    notFound();
  }

  const certificateName = getCertificateDisplayName(certificate);
  const certificateType = getCertificateType(certificate);
  const certificateNarrative = getCertificateNarrative(certificate);
  const certificateSubjectLabel = getCertificateSubjectColumnLabel(certificate);

  return (
    <div className="shell py-12">
      <section className="glass-card px-6 py-8 sm:px-8">
        <div className="certificate-verify-stage">
          <div className="certificate-state" data-tone="valid">
            <VerificationStateIcon />
            <div>
              <p className="certificate-state__title">Verified certificate</p>
              <p className="certificate-state__copy">
                This record matches the certificate issued by JnUITS.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="eyebrow">Certificate details</span>
            <span className="detail-chip">{certificateType.label} certificate</span>
          </div>

          <div>
            <h1 className="section-title mt-4 uppercase">{certificateName}</h1>
            <p className="mt-4 text-sm font-medium tracking-[0.01em] text-[var(--muted)]">
              {certificate.certificate_id} · {certificate.exam_or_event_name}
            </p>
            <p className="certificate-summary mt-6">{certificateNarrative}</p>
          </div>

          <dl className="certificate-table">
            <div className="certificate-table__row">
              <dt>Name</dt>
              <dd>{certificateName}</dd>
            </div>
            <div className="certificate-table__row">
              <dt>Certificate ID</dt>
              <dd>{certificate.certificate_id}</dd>
            </div>
            <div className="certificate-table__row">
              <dt>Type</dt>
              <dd>{certificateType.label}</dd>
            </div>
            <div className="certificate-table__row">
              <dt>{certificateSubjectLabel}</dt>
              <dd>{certificate.exam_or_event_name}</dd>
            </div>
            <div className="certificate-table__row">
              <dt>Issued date</dt>
              <dd>{formatCertificateIssueDate(certificate.issue_date)}</dd>
            </div>
            <div className="certificate-table__row">
              <dt>Verification text</dt>
              <dd>{certificate.details}</dd>
            </div>
          </dl>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={`/certificates?q=${certificate.certificate_id}`} className="secondary-button">
            Open public verification
          </Link>
          {certificate.asset_url ? (
            <Link
              href={`/api/certificates/view/${certificate.certificate_id}?download=1`}
              className="primary-button"
            >
              Download asset
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  );
}
