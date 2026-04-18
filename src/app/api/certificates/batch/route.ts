import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { findCertificatesByIds, normalizeCertificateId } from "@/lib/certificates/queries";
import { withApiGuard } from "@/lib/security/with-api-guard";

const batchLookupSchema = z.object({
  ids: z.array(z.string().trim().min(1).max(80)).min(1).max(200),
});

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

async function handlePost(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = batchLookupSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Provide one or more certificate IDs to verify." },
      { status: 400 }
    );
  }

  const ids = normalizeIds(parsed.data.ids);

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

export const POST = withApiGuard(handlePost);
