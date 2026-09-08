import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth/session";
import { buildPasswordSignInPayload } from "@/lib/auth/password-sign-in";
import { buildStepUpCookie, getStepUpCookieName } from "@/lib/auth/step-up";
import {
  getSupabasePublishableKey,
  getSupabaseUrl,
} from "@/lib/supabase/config";
import { checkRateLimitForApi, RATE_LIMITS } from "@/lib/security/rate-limit";
import { rateLimitError } from "@/lib/errors/api-error";
import { withApiGuard } from "@/lib/security/with-api-guard";
import { isCaptchaRequired } from "@/lib/security/captcha";

const requestSchema = z.object({
  captchaToken: z.string().trim().optional().default(""),
  currentPassword: z.string().min(8),
});

async function handlePost(request: NextRequest) {
  const auth = await getAuthContext();

  if (!auth.user?.email) {
    return NextResponse.json(
      { message: "Sign in with your claimed member account first." },
      { status: 401 }
    );
  }

  // Rate limit per user: 3 step-up attempts per 10 minutes
  const rl = await checkRateLimitForApi(
    `step-up:${auth.user.id}`,
    RATE_LIMITS.profileStepUp
  );
  if (!rl.success) return rateLimitError(rl.resetAt);

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Enter your current password to verify this session." },
      { status: 400 }
    );
  }

  if (isCaptchaRequired() && !parsed.data.captchaToken) {
    return NextResponse.json(
      { message: "Complete the verification challenge." },
      { status: 400 }
    );
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

  const { data, error } = await ephemeral.auth.signInWithPassword(
    buildPasswordSignInPayload({
      captchaToken: parsed.data.captchaToken,
      email: auth.user.email,
      password: parsed.data.currentPassword,
    })
  );

  if (error || data.user?.id !== auth.user.id) {
    return NextResponse.json(
      { message: "Current password verification failed." },
      { status: 403 }
    );
  }

  await ephemeral.auth.signOut({ scope: "local" });

  const stepUpCookie = buildStepUpCookie(auth.user.id);
  const response = NextResponse.json(
    {
      expiresAt: stepUpCookie.expiresAt.toISOString(),
      message:
        "Step-up verification succeeded. Direct profile edits are unlocked for 15 minutes on this browser.",
      verified: true,
    },
    { status: 200 }
  );

  response.cookies.set({
    name: stepUpCookie.name,
    value: stepUpCookie.value,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: stepUpCookie.expiresAt,
    path: "/",
  });

  return response;
}

async function handleDelete() {
  const response = NextResponse.json(
    { message: "Step-up verification cleared." },
    { status: 200 }
  );

  response.cookies.set({
    name: getStepUpCookieName(),
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
    path: "/",
  });

  return response;
}

export const POST = withApiGuard(handlePost);
export const DELETE = withApiGuard(handleDelete);
