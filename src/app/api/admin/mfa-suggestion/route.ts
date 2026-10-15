import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasPermission } from "@/lib/auth/session";
import { adminOperationRegistry } from "@/lib/auth/admin-verification/operations";
import { buildAdminSecurityGuidance } from "@/lib/admin/security-guidance";
import type { AdminOperation } from "@/lib/auth/admin-verification/types";
import { loadAdminVerificationActor } from "@/lib/auth/admin-verification/actor";
import { AdminVerificationStore } from "@/lib/auth/admin-verification/store";
import { withApiGuard } from "@/lib/security/with-api-guard";

async function preferences(snooze: boolean) {
  try {
    const actor = await loadAdminVerificationActor();
    if (!actor.ok) return NextResponse.json(actor, { status: actor.code === "permission_denied" ? 403 : 503 });
    const result = await new AdminVerificationStore().suggestion(actor.value, snooze);
    if (!result.ok || snooze) return NextResponse.json(result, { status: result.ok ? 200 : 503 });
    const operations = Object.keys(adminOperationRegistry) as AdminOperation[];
    const permissions = [...new Set(operations.map(key => adminOperationRegistry[key].permission))];
    const allowed = await Promise.all(permissions.map(async permission => [permission, await hasPermission(permission)] as const));
    const permitted = new Map(allowed);
    const guidance = buildAdminSecurityGuidance({actor: actor.value, permittedOperations: operations.filter(key => permitted.get(adminOperationRegistry[key].permission) === true)});
    const snoozed = result.value.snoozedUntil !== null && Date.parse(result.value.snoozedUntil) > Date.now();
    return NextResponse.json({ok:true,value:{...result.value,show:guidance.state !== "verified" && !snoozed,guidance}});
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
