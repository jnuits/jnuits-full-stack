import { NextResponse } from "next/server";
import { z } from "zod";

import { hashFormConfirmationToken } from "@/lib/forms/confirmation";
import { confirmFormSubmission } from "@/lib/forms/repository";
import { withApiGuard } from "@/lib/security/with-api-guard";
import { RATE_LIMITS } from "@/lib/security/rate-limit";

const confirmationRequestSchema = z
  .object({
    submissionId: z.string().uuid(),
    token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  })
  .strict();

export const POST = withApiGuard(
  async (request) => {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid confirmation request." }, { status: 400 });
    }

    const parsed = confirmationRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid confirmation request." }, { status: 400 });
    }

    const result = await confirmFormSubmission({
      submissionId: parsed.data.submissionId,
      tokenHash: hashFormConfirmationToken(parsed.data.token),
    });

    if (
      result?.result_status === "confirmed" ||
      result?.result_status === "already_confirmed"
    ) {
      return NextResponse.json({ success: true });
    }

    if (result?.result_status === "expired") {
      return NextResponse.json(
        { error: "This confirmation link has expired. Request a new one from the form page." },
        { status: 410 }
      );
    }

    return NextResponse.json({ error: "Invalid confirmation request." }, { status: 400 });
  },
  {
    rateLimit: RATE_LIMITS.formConfirm,
    requireAuth: false,
  }
);
