import { findCertificateById, normalizeCertificateId } from "@/lib/certificates/queries";
import {
  formatCertificateIssueDate,
  getCertificateDisplayName,
  getCertificateNarrative,
  getCertificateSubjectColumnLabel,
  getCertificateType,
} from "@/lib/certificates/presentation";

function VerificationStateIcon({ tone }: { tone: "missing" | "valid" }) {
  return (
    <span className="certificate-state__icon" data-tone={tone} aria-hidden="true">
      {tone === "valid" ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M5 12.5 9.5 17 19 7.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M7.5 7.5 16.5 16.5" strokeLinecap="round" />
          <path d="m16.5 7.5-9 9" strokeLinecap="round" />
        </svg>
      )}
    </span>
  );
}

export default async function CertificatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const rawCertificateQuery =
    typeof resolvedSearchParams.q === "string"
      ? resolvedSearchParams.q
      : typeof resolvedSearchParams.certificateId === "string"
        ? resolvedSearchParams.certificateId
        : "";
  const certificateId = rawCertificateQuery
    ? normalizeCertificateId(rawCertificateQuery)
    : "";
  const certificate = certificateId ? await findCertificateById(certificateId) : null;
  const certificateName = certificate ? getCertificateDisplayName(certificate) : "";
  const certificateType = certificate ? getCertificateType(certificate) : null;
  const certificateNarrative = certificate ? getCertificateNarrative(certificate) : "";
  const certificateSubjectLabel = certificate
    ? getCertificateSubjectColumnLabel(certificate)
    : "Program";

  return (
    <div className="shell py-12">
      <section className="glass-card px-6 py-8 sm:px-8">
        <div className="certificate-verify-stage">
          <div className="text-center">
            <span className="eyebrow">Certificate verification</span>
            <h1 className="section-title mt-4">Verify the authenticity of a JnUITS certificate</h1>
            <p className="section-copy mx-auto mt-4">
              Enter the certificate ID from a printed certificate or an old QR link.
              Legacy verification URLs continue to resolve here.
            </p>
          </div>

          <form className="certificate-search-form">
            <label className="sr-only" htmlFor="certificate-id-input">
              Certificate ID
            </label>
            <input
              id="certificate-id-input"
              name="q"
              defaultValue={certificateId}
              placeholder="Enter a certificate ID, e.g. 24007 or W25SPEAKUPPT065"
            />
            <button className="primary-button" type="submit">
              Verify
            </button>
          </form>

          {certificateId ? (
            certificate ? (
              <div className="certificate-result-card">
                <div className="certificate-state" data-tone="valid">
                  <VerificationStateIcon tone="valid" />
                  <div>
                    <p className="certificate-state__title">The certificate is valid.</p>
                    <p className="certificate-state__copy">
                      This verification record matches an issued JnUITS certificate.
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <span className="status-pill">Certificate found</span>
                  {certificateType ? (
                    <span className="detail-chip">{certificateType.label} certificate</span>
                  ) : null}
                </div>

                <h2 className="mt-5 font-[family-name:var(--font-heading)] text-[clamp(2.2rem,4vw,3.35rem)] font-semibold leading-[0.96] tracking-[-0.05em] uppercase">
                  {certificateName}
                </h2>
                <p className="mt-3 text-sm font-medium tracking-[0.01em] text-[var(--muted)]">
                  {certificate.certificate_id} · {certificate.exam_or_event_name}
                </p>
                <p className="certificate-summary mt-6">{certificateNarrative}</p>

                <dl className="certificate-table mt-8">
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
                    <dd>{certificateType?.label || "Course"}</dd>
                  </div>
                  <div className="certificate-table__row">
                    <dt>{certificateSubjectLabel}</dt>
                    <dd>{certificate.exam_or_event_name}</dd>
                  </div>
                  <div className="certificate-table__row">
                    <dt>Issued date</dt>
                    <dd>{formatCertificateIssueDate(certificate.issue_date)}</dd>
                  </div>
                </dl>

              </div>
            ) : (
              <div className="certificate-result-card">
                <div className="certificate-state" data-tone="missing">
                  <VerificationStateIcon tone="missing" />
                  <div>
                    <p className="certificate-state__title">Certificate not found</p>
                    <p className="certificate-state__copy">
                      No certificate matched <strong>{certificateId}</strong>.
                    </p>
                  </div>
                </div>

                <p className="certificate-missing-copy mt-6">
                  If you believe this is an error or if your certificate ID is valid but
                  not found in our database, please contact us at{" "}
                  <a href="mailto:info@jnuits.org.bd">info@jnuits.org.bd</a>.
                </p>
              </div>
            )
          ) : (
            <div className="certificate-help-grid">
              <article className="route-tile">
                <h3>Certificate type</h3>
                <p>
                  JnUITS currently verifies two public certificate categories:
                  <strong> Course</strong> and <strong>Event</strong>.
                </p>
              </article>
              <article className="route-tile">
                <h3>Legacy QR compatibility</h3>
                <p>
                  Older printed QR codes can keep pointing to
                  ` /certificates?q=[certificateId]` without breaking verification.
                </p>
              </article>
              <article className="route-tile">
                <h3>Need the full page?</h3>
                <p>
                  The verification detail route at ` /certificates/[certificateId]` still
                  exists, but the public search page is now the primary response surface.
                </p>
              </article>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
