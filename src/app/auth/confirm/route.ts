import { type EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { resolveSafeNextPath } from "@/lib/auth/session";
import { buildPasswordRecoveryCookie } from "@/lib/auth/password-recovery";
import { logServerError } from "@/lib/errors/api-error";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = resolveSafeNextPath(
    searchParams.get("next"),
    "/portal/dashboard"
  );

  const redirectTo = request.nextUrl.clone();
  redirectTo.pathname = next;
  redirectTo.search = "";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const metadata = user?.app_metadata ?? {};
      const claimSource = asString(metadata.claim_source);
      const claimMemberId = asString(metadata.claim_member_id);
      const claimInvitationId = asString(metadata.claim_invitation_id);

      if (
        user?.email &&
        claimSource === "member_invitation" &&
        claimMemberId &&
        claimInvitationId
      ) {
        const admin = createAdminClient();
        const { error: finalizeError } = await (admin as never as {
          rpc: (
            fn: "finalize_member_invitation_claim",
            args: {
              target_email: string;
              target_invitation_id: string;
              target_member_id: string;
              target_user_id: string;
            }
          ) => Promise<{ data: unknown; error: { message?: string } | null }>;
        }).rpc("finalize_member_invitation_claim", {
          target_email: user.email,
          target_invitation_id: claimInvitationId,
          target_member_id: claimMemberId,
          target_user_id: user.id,
        });

        if (finalizeError) {
          logServerError("authConfirm.finalizeMemberInvitationClaim", finalizeError);
          const fallback = request.nextUrl.clone();
          fallback.pathname = "/verify-email";
          fallback.search = `?error=${encodeURIComponent(
            "Email verified, but the member claim could not be completed. Please contact JnUITS support."
          )}`;
          return NextResponse.redirect(fallback);
        }
      } else if (
        user?.email &&
        typeof type === "string" &&
        type.startsWith("email_change")
      ) {
        const admin = createAdminClient();
        await admin
          .from("members")
          .update({
            email: user.email,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);
      }

      const response = NextResponse.redirect(redirectTo);

      if (type === "recovery" && user?.id) {
        const recoveryCookie = buildPasswordRecoveryCookie(user.id);
        response.cookies.set({
          name: recoveryCookie.name,
          value: recoveryCookie.value,
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          expires: recoveryCookie.expiresAt,
          path: "/",
        });
      }

      return response;
    }
  }

  const fallback = request.nextUrl.clone();
  fallback.pathname = "/verify-email";
  fallback.search = "?error=Verification link is invalid or expired.";
  return NextResponse.redirect(fallback);
}
