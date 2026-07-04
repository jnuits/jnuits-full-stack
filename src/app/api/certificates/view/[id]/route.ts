import { NextRequest, NextResponse } from "next/server";
import {
  isValidCertificateId,
  normalizeCertificateId,
} from "@/lib/certificates/public-batch";
import { findCertificateById } from "@/lib/certificates/queries";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { withApiGuard } from "@/lib/security/with-api-guard";

async function handleGet(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await params;
  const certificateId = normalizeCertificateId(rawId);

  if (!isValidCertificateId(certificateId)) {
    return NextResponse.json(
      { message: "Enter a valid certificate ID." },
      { status: 400 }
    );
  }

  const certificate = await findCertificateById(certificateId).catch((error) => {
    console.error("Certificate view lookup failed", {
      certificateId,
      error,
    });
    return undefined;
  });

  if (certificate === undefined) {
    return NextResponse.json(
      { message: "Certificate lookup is temporarily unavailable." },
      { status: 503 }
    );
  }

  if (!certificate) {
    return NextResponse.json({ message: "Certificate not found." }, { status: 404 });
  }

  if (request.nextUrl.searchParams.get("download") === "1" && certificate.asset_url) {
    return NextResponse.redirect(certificate.asset_url);
  }

  return NextResponse.json({ data: certificate }, { status: 200 });
}

export const GET = withApiGuard(handleGet, {
  enforceSameOrigin: false,
  rateLimit: RATE_LIMITS.certificateView,
});
