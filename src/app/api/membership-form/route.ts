import { NextResponse } from "next/server";

export async function POST() {
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
