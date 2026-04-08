import Link from "next/link";
import { findCertificateById, normalizeCertificateId } from "@/lib/certificates/queries";

export default async function CertificatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const certificateId =
    typeof resolvedSearchParams.certificateId === "string"
      ? normalizeCertificateId(resolvedSearchParams.certificateId)
      : "";
  const certificate = certificateId ? await findCertificateById(certificateId) : null;

  return (
    <div className="shell py-12">
      <section className="glass-card grid gap-8 px-6 py-8 sm:px-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <span className="eyebrow">Certificate verification</span>
          <h1 className="section-title mt-4">
            Verify a single certificate or feed multiple IDs into the batch API.
          </h1>
          <p className="section-copy mt-4">
            The unified app keeps certificate verification public and direct. The
            data now lives in Supabase instead of the old Strapi proxy, and import
            reports are tracked separately for operator auditability.
          </p>

          <form className="mt-8 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
            <input
              name="certificateId"
              defaultValue={certificateId}
              placeholder="Enter a certificate ID"
            />
            <button className="primary-button" type="submit">
              Verify
            </button>
          </form>

          {certificateId ? (
            <div className="glass-card mt-8 p-5">
              {certificate ? (
                <div className="grid gap-3">
                  <p className="status-pill">Certificate found</p>
                  <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold">
                    {certificate.first_name} {certificate.last_name}
                  </h2>
                  <p className="text-sm text-[var(--muted)]">
                    {certificate.certificate_id} · {certificate.exam_or_event_name}
                  </p>
                  <p className="text-sm text-[var(--brand-ink)]">{certificate.details}</p>
                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={`/certificates/${certificate.certificate_id}`}
                      className="secondary-button"
                    >
                      Open certificate page
                    </Link>
                    <Link
                      href={`/api/certificates/view/${certificate.certificate_id}`}
                      className="secondary-button"
                    >
                      View JSON
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="grid gap-2">
                  <p className="status-pill">No match</p>
                  <p className="text-sm text-[var(--brand-ink)]">
                    No certificate matched <strong>{certificateId}</strong>.
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="route-grid content-start">
          <article className="route-tile">
            <h3>Single lookup</h3>
            <p>`/certificates/[certificateId]` shows the canonical public verification view.</p>
          </article>
          <article className="route-tile">
            <h3>Batch lookup</h3>
            <p>`POST /api/certificates/batch` accepts up to 200 IDs for reconciliation workflows.</p>
          </article>
          <article className="route-tile">
            <h3>Import evidence</h3>
            <p>Every import run is designed to land in staging plus a batch/report record.</p>
          </article>
        </div>
      </section>
    </div>
  );
}
