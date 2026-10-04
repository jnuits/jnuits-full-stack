import { NextResponse } from "next/server";
import { withApiGuard } from "@/lib/security/with-api-guard";

// Retired: an email address alone is not proof of applicant ownership.
// The response is independent of all request input and performs no lookup.
export const GET = withApiGuard(async () =>
  NextResponse.json(
    {
      message: "Email-only application status lookup has been retired. Visit membership support for guidance.",
      supportUrl: "/membership-form",
    },
    { status: 410, headers: { "Cache-Control": "private, no-store" } }
  )
);
