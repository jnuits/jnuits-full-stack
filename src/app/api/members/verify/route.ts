import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  clearDirectoryVerificationCookies,
  hashDirectoryVerificationCode,
  setDirectoryVerificationCookies,
} from "@/lib/auth/directory-verification";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { withApiGuard } from "@/lib/security/with-api-guard";

const verificationSchema = z.object({
  jnuitsId: z.string().trim().min(3),
  verificationCode: z.string().trim().min(4),
});

async function handleVerify(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as Record<string, unknown> | undefined;

  const userId = typeof claims?.sub === "string" ? claims.sub : null;

  if (!userId) {
    const response = NextResponse.json(
      {
        verified: false,
        message: "Sign in with your claimed account before directory verification.",
      },
      { status: 401 }
    );
    clearDirectoryVerificationCookies(response.cookies);
    return response;
  }

  const payload = await request.json().catch(() => null);
  const parsed = verificationSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { verified: false, message: "jnuitsId and verificationCode are required." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: member, error } = await admin
    .from("members")
    .select("id, jnuits_id, full_name, member_type, is_profile_claimed, user_id, verification_code_hash")
    .eq("jnuits_id", parsed.data.jnuitsId.trim().toUpperCase())
    .maybeSingle();

  if (error || !member) {
    const response = NextResponse.json(
      { verified: false, message: "Member record was not found." },
      { status: 404 }
    );
    clearDirectoryVerificationCookies(response.cookies);
    return response;
  }

  if (!member.is_profile_claimed || member.user_id !== userId) {
    const response = NextResponse.json(
      {
        verified: false,
        message: "Only the claimed member account can complete directory verification.",
      },
      { status: 403 }
    );
    clearDirectoryVerificationCookies(response.cookies);
    return response;
  }

  if (!member.verification_code_hash) {
    const response = NextResponse.json(
      {
        verified: false,
        message: "No verification code has been assigned to this member yet.",
      },
      { status: 409 }
    );
    clearDirectoryVerificationCookies(response.cookies);
    return response;
  }

  const submittedHash = hashDirectoryVerificationCode(parsed.data.verificationCode);

  if (submittedHash !== member.verification_code_hash) {
    const response = NextResponse.json(
      { verified: false, message: "Verification code is invalid." },
      { status: 400 }
    );
    clearDirectoryVerificationCookies(response.cookies);
    return response;
  }

  const response = NextResponse.json(
    {
      verified: true,
      message: "Directory verification succeeded.",
      member: {
        id: member.id,
        jnuitsId: member.jnuits_id,
        fullName: member.full_name,
        memberType: member.member_type,
        isProfileClaimed: member.is_profile_claimed,
      },
    },
    { status: 200 }
  );

  setDirectoryVerificationCookies(response.cookies, userId);
  return response;
}

export const POST = withApiGuard(handleVerify, {
  rateLimit: RATE_LIMITS.memberVerify,
});
