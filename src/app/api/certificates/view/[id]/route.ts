import { NextRequest, NextResponse } from "next/server";
import { findCertificateById, normalizeCertificateId } from "@/lib/certificates/queries";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await params;
  const certificateId = normalizeCertificateId(rawId);

  if (!certificateId) {
    return NextResponse.json(
      { message: "Certificate ID is required." },
      { status: 400 }
    );
  }

  const certificate = await findCertificateById(certificateId);

  if (!certificate) {
    return NextResponse.json({ message: "Certificate not found." }, { status: 404 });
  }

  if (request.nextUrl.searchParams.get("download") === "1" && certificate.asset_url) {
    return NextResponse.redirect(certificate.asset_url);
  }

  return NextResponse.json({ data: certificate }, { status: 200 });
}
