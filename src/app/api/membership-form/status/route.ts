import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { withApiGuard } from "@/lib/security/with-api-guard";

/**
 * Anti-enumeration: both found and not-found paths return the same
 * JSON shape so an attacker cannot distinguish whether an email
 * has a submitted application by comparing response bodies.
 *
 * We also apply the same small jittered delay after the lookup on
 * success and not-found paths to reduce simple timing differences.
 */
export function getAntiEnumerationDelayMs(random = Math.random()) {
  return 80 + Math.floor(random * 120); // 80-199 ms
}

function antiEnumerationDelay(): Promise<void> {
  const ms = getAntiEnumerationDelayMs();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function handleStatusLookup(request: NextRequest): Promise<NextResponse> {
  const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase() ?? "";

  if (!email) {
    return NextResponse.json({ message: "Email is required." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("membership_applications")
    .select("status, updated_at")
    .eq("email", email)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) {
    // Log internally but return a safe generic message
    console.error("[membership-form/status] DB error:", error.message);
    await antiEnumerationDelay();
    return NextResponse.json(
      { message: "Unable to check application status right now." },
      { status: 500 }
    );
  }

  const application = data?.[0];

  // ── Uniform response shape for both found and not-found ──────────────────
  // "found" is intentionally omitted so clients cannot enumerate by
  // checking field presence. Only "status" carries meaningful state.
  await antiEnumerationDelay();

  if (!application) {
    return NextResponse.json(
      { status: null, updatedAt: null },
      { status: 200 }
    );
  }

  return NextResponse.json(
    { status: application.status, updatedAt: application.updated_at },
    { status: 200 }
  );
}

export const GET = withApiGuard(handleStatusLookup, {
  rateLimit: RATE_LIMITS.membershipStatus,
});
