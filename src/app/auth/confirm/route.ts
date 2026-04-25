import { type EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") || "/portal/dashboard";

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

      if (user?.email) {
        const admin = createAdminClient();
        await admin
          .from("members")
          .update({
            email: user.email,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);
      }

      return NextResponse.redirect(redirectTo);
    }
  }

  const fallback = request.nextUrl.clone();
  fallback.pathname = "/verify-email";
  fallback.search = "?error=Verification link is invalid or expired.";
  return NextResponse.redirect(fallback);
}
