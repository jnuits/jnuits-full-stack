import { NextResponse } from "next/server";

import { withApiGuard } from "@/lib/security/with-api-guard";

async function handlePost() {
  return NextResponse.json(
    {
      intakeOpen: false,
      status: "closed",
      message:
        "New public membership applications are currently closed. Please use invitation/claim onboarding or check legacy application status.",
    },
    { status: 410 }
  );
}

export const POST = withApiGuard(handlePost);
