import { Suspense } from "react";

import { CertificateVerifyIsland } from "@/components/certificates/certificate-verify-island";

export default function CertificatesPage() {
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

          <Suspense fallback={null}>
            <CertificateVerifyIsland />
          </Suspense>
        </div>
      </section>
    </div>
  );
}
