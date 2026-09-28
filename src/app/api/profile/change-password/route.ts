import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { clearDirectoryVerificationCookies } from "@/lib/auth/directory-verification";
import { buildPasswordSignInPayload } from "@/lib/auth/password-sign-in";
import { PASSWORD_RECOVERY_COOKIE_NAME } from "@/lib/auth/password-recovery";
import { getAuthContext } from "@/lib/auth/session";
import { getStepUpCookieName } from "@/lib/auth/step-up";
import { logServerError, rateLimitError } from "@/lib/errors/api-error";
import { isCaptchaRequired } from "@/lib/security/captcha";
import { getPasswordExposureError } from "@/lib/security/pwned-passwords";
import { getPasswordPolicyError } from "@/lib/security/password-policy";
import { checkRateLimitForApi, RATE_LIMITS } from "@/lib/security/rate-limit";
import { withApiGuard } from "@/lib/security/with-api-guard";
import {
  getSupabasePublishableKey,
  getSupabaseUrl,
} from "@/lib/supabase/config";

const requestSchema = z.object({
  captchaToken: z.string().trim().optional().default(""),
  confirmPassword: z.string(),
  currentPassword: z.string().min(1),
  password: z.string(),
});

function clearPrivilegedCookies(response: NextResponse) {
  clearDirectoryVerificationCookies(response.cookies);

  const options = {
    expires: new Date(0),
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };

  response.cookies.set({
    ...options,
    name: getStepUpCookieName(),
    value: "",
  });
  response.cookies.set({
    ...options,
    name: PASSWORD_RECOVERY_COOKIE_NAME,
    value: "",
  });
}

async function handlePost(request: NextRequest) {
  const auth = await getAuthContext();

  if (!auth.user?.id || !auth.user.email) {
    return NextResponse.json(
      { message: "Your session has expired. Sign in and try again." },
      { status: 401 }
    );
  }

  const rateLimit = await checkRateLimitForApi(
    `change-password:${auth.user.id}`,
    RATE_LIMITS.profileStepUp
  );

  if (!rateLimit.success) {
    return rateLimitError(rateLimit.resetAt);
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Enter your current password and a valid new password." },
      { status: 400 }
    );
  }

  const { captchaToken, confirmPassword, currentPassword, password } =
    parsed.data;
  const policyError = getPasswordPolicyError(password, {
    email: auth.user.email,
  });

  if (policyError) {
    return NextResponse.json({ message: policyError }, { status: 400 });
  }

  if (password !== confirmPassword) {
    return NextResponse.json(
      { message: "New password and confirmation do not match." },
      { status: 400 }
    );
  }

  if (password === currentPassword) {
    return NextResponse.json(
      { message: "Choose a new password that differs from your current password." },
      { status: 400 }
    );
  }

  if (isCaptchaRequired() && !captchaToken) {
    return NextResponse.json(
      { message: "Complete the verification challenge." },
      { status: 400 }
    );
  }

  const exposureError = await getPasswordExposureError(password);
  if (exposureError) {
    return NextResponse.json({ message: exposureError }, { status: 400 });
  }

  const ephemeral = createSupabaseClient(
    getSupabaseUrl(),
    getSupabasePublishableKey(),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  const { data, error: signInError } =
    await ephemeral.auth.signInWithPassword(
      buildPasswordSignInPayload({
        captchaToken,
        email: auth.user.email,
        password: currentPassword,
      })
    );

  if (signInError || data.user?.id !== auth.user.id) {
    if (data.user) {
      await ephemeral.auth.signOut({ scope: "local" });
    }

    return NextResponse.json(
      { message: "Current password is incorrect." },
      { status: 403 }
    );
  }

  let updateError: unknown = null;

  try {
    const result = await ephemeral.auth.updateUser({
      current_password: currentPassword,
      password,
    });
    updateError = result.error;
  } finally {
    await ephemeral.auth.signOut({ scope: "local" });
  }

  if (updateError) {
    logServerError("profile.changePassword", updateError);
    return NextResponse.json(
      { message: "Unable to update your password. Try again." },
      { status: 400 }
    );
  }

  const response = NextResponse.json(
    { message: "Password updated successfully." },
    { status: 200 }
  );
  clearPrivilegedCookies(response);

  return response;
}

export const POST = withApiGuard(handlePost);
