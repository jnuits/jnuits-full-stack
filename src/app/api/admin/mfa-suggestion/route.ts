import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { loadAdminVerificationActor } from "@/lib/auth/admin-verification/actor";
import { AdminVerificationStore } from "@/lib/auth/admin-verification/store";
import { withApiGuard } from "@/lib/security/with-api-guard";

async function preferences(snooze: boolean) {
  try {
    const actor = await loadAdminVerificationActor();
    if (!actor.ok) return NextResponse.json(actor, { status: actor.code === "permission_denied" ? 403 : 503 });
    const result = await new AdminVerificationStore().suggestion(actor.value, snooze);
    return NextResponse.json(result, { status: result.ok ? 200 : 503 });
  } catch { return NextResponse.json({ ok: false, code: "verification_unavailable" }, { status: 503 }); }
}
const get = withApiGuard(() => preferences(false), { requireAuth: true });
const post = withApiGuard(async (request: NextRequest) => {
  const body = z.strictObject({ action: z.literal("snooze") }).safeParse(await request.json().catch(() => null));
  return body.success ? preferences(true) : NextResponse.json({ ok: false, code: "invalid_input" }, { status: 422 });
}, { requireAuth: true });
type Context = { params: Promise<Record<string, string | string[] | undefined>> };
export async function GET(request: NextRequest, context: Context) {
  const response = await get(request, context); response.headers.set("Cache-Control", "private, no-store, max-age=0"); return response;
}
export async function POST(request: NextRequest, context: Context) {
  const response = await post(request, context); response.headers.set("Cache-Control", "private, no-store, max-age=0"); return response;
}
