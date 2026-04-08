import Link from "next/link";
import { notFound } from "next/navigation";
import { findCertificateById, normalizeCertificateId } from "@/lib/certificates/queries";

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

  return (
    <div className="shell py-12">
      <section className="glass-card px-6 py-8 sm:px-8">
        <span className="eyebrow">Verified certificate</span>
        <h1 className="section-title mt-4">
          {certificate.first_name} {certificate.last_name}
        </h1>
        <p className="section-copy mt-4">
          {certificate.certificate_id} · {certificate.exam_or_event_name}
        </p>

        <dl className="route-grid mt-8">
          <div className="route-tile">
            <dt>Exam or event</dt>
            <dd>{certificate.exam_or_event}</dd>
          </div>
          <div className="route-tile">
            <dt>Issued on</dt>
            <dd>{certificate.issue_date}</dd>
          </div>
          <div className="route-tile">
            <dt>Details</dt>
            <dd>{certificate.details}</dd>
          </div>
        </dl>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={`/api/certificates/view/${certificate.certificate_id}`}
            className="secondary-button"
          >
            JSON endpoint
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
