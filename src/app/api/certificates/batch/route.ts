import { NextRequest, NextResponse } from "next/server";
import { findCertificatesByIds, normalizeCertificateId } from "@/lib/certificates/queries";

function normalizeIds(input: unknown) {
  if (!Array.isArray(input)) {
    return [];
  }

  return Array.from(
    new Set(
      input
        .map((value) => (typeof value === "string" ? normalizeCertificateId(value) : ""))
        .filter(Boolean)
        .slice(0, 200)
    )
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const ids = normalizeIds(body?.ids);

  if (!ids.length) {
    return NextResponse.json(
      { message: "At least one certificate ID is required." },
      { status: 400 }
    );
  }

  const certificates = await findCertificatesByIds(ids);
  const byId = new Map(
    certificates.map((certificate) => [certificate.certificate_id, certificate])
  );

  const data = ids.map((certificateId) => ({
    certificateId,
    found: byId.has(certificateId),
    certificate: byId.get(certificateId) || null,
  }));

  return NextResponse.json({
    data,
    summary: {
      requested: ids.length,
      found: data.filter((item) => item.found).length,
      missing: data.filter((item) => !item.found).length,
    },
  });
}
