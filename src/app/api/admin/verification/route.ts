import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prepareAdminVerification, requestAdminEmailVerification, verifyAdminEmailCodeWithScope } from "@/lib/auth/admin-verification/email";
import { verifyAdminRolePassword } from "@/lib/auth/admin-verification/password";
import { parseAdminOperationIntent } from "@/lib/auth/admin-verification/operations";
import { getAdminReadProofCookieName } from "@/lib/auth/admin-verification/read-cookie";
import { getRequestIp } from "@/lib/security/rate-limit";
import { withApiGuard } from "@/lib/security/with-api-guard";
import type { AdminOperationIntent } from "@/lib/auth/admin-verification/types";

export const runtime = "nodejs";
const intentSchema = z.unknown().transform((input, ctx) => {
  const parsed = parseAdminOperationIntent(input);
  if (parsed.ok) return parsed.value;
  ctx.addIssue({ code: "custom", message: "Choose a valid admin operation." });
  return z.NEVER;
});
const schema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("prepare"), intent: intentSchema }),
  z.strictObject({ action: z.literal("email_send"), intent: intentSchema }),
  z.strictObject({ action: z.literal("email_verify"), challengeId: z.uuid(), code: z.string().regex(/^\d{6}$/) }),
  z.strictObject({ action: z.literal("password_verify"), intent: intentSchema, password: z.string().min(1).max(4096), captchaToken: z.string().trim().max(8192).default("") }),
]);
function statusFor(code: string) {
  return code === "rate_limited" ? 429 : code === "verification_unavailable" ? 503 : code === "session_invalid" ? 401 : 403;
}
async function handlePost(request: NextRequest) {
  try {
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ ok: false, code: "invalid_input" }, { status: 422 });
    const input = parsed.data;
    const ip = getRequestIp(request.headers);
    if (input.action === "email_verify") {
      const result = await verifyAdminEmailCodeWithScope(input.challengeId, input.code, ip);
      if (!result.ok) return NextResponse.json(result, { status: statusFor(result.code) });
      const response = NextResponse.json({ ok: true, value: result.value.proof });
      const name = result.value.readOperation && getAdminReadProofCookieName(result.value.readOperation);
      const maxAge = Math.max(0, Math.min(300, Math.floor((Date.parse(result.value.proof.expiresAt) - Date.now()) / 1000)));
      if (name && maxAge > 0) response.cookies.set(name, result.value.proof.token, {
        httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge,
      });
      return response;
    }
    const intent = input.intent as AdminOperationIntent;
    const result = input.action === "prepare" ? await prepareAdminVerification(intent)
      : input.action === "email_send" ? await requestAdminEmailVerification(intent, ip)
      : await verifyAdminRolePassword(intent, input.password, input.captchaToken, ip);
    return NextResponse.json(result, { status: result.ok ? 200 : statusFor(result.code) });
  } catch { return NextResponse.json({ ok: false, code: "verification_unavailable" }, { status: 503 }); }
}
const guardedPost = withApiGuard(handlePost, { requireAuth: true });
export async function POST(request: NextRequest, context: { params: Promise<Record<string, string | string[] | undefined>> }) {
  const response = await guardedPost(request, context);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}
