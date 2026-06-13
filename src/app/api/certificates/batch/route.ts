import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  MAX_BATCH_IDS,
  normalizeIds,
  toPublicCertificate,
} from "@/lib/certificates/public-batch";
import { findCertificatesByIds } from "@/lib/certificates/queries";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { withApiGuard } from "@/lib/security/with-api-guard";

const batchLookupSchema = z.object({
  ids: z.array(z.string().trim().min(1).max(80)).min(1).max(MAX_BATCH_IDS),
});

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
    certificate: byId.has(certificateId)
      ? toPublicCertificate(byId.get(certificateId)!)
      : null,
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

export const POST = withApiGuard(handlePost, {
  rateLimit: RATE_LIMITS.certificateBatch,
});
