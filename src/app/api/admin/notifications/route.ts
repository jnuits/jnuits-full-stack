import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApiGuard } from "@/lib/security/with-api-guard";
import { loadOwnAdminNotices, markOwnNoticeRead, loadOwnAdminEmailPreferences, saveOwnAdminEmailPreferences } from "@/lib/admin/notifications/store";

const mutation = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("mark_read"), noticeId: z.uuid() }),
  z.strictObject({ action: z.literal("mark_all_read") }),
  z.strictObject({ action: z.literal("preferences"), preferences: z.strictObject({ admin_security_email_opt_in: z.boolean(), admin_recommendation_email_opt_in: z.boolean() }) }),
]);
const get = withApiGuard(async (request: NextRequest) => {
  try {
    const params = request.nextUrl.searchParams;
    if (params.get("view") === "preferences") return NextResponse.json({ ok: true, value: await loadOwnAdminEmailPreferences() });
    const value = await loadOwnAdminNotices({ page: Number(params.get("page") || 1) });
    return NextResponse.json({ ok: true, value });
  } catch { return NextResponse.json({ ok: false, code: "notices_unavailable" }, { status: 503 }); }
}, { requireAuth: true, rateLimit: { limit: 60, windowSeconds: 60 } });
const post = withApiGuard(async (request: NextRequest) => {
  const parsed = mutation.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, code: "invalid_input" }, { status: 422 });
  try {
    const value = parsed.data;
    if (value.action === "preferences") await saveOwnAdminEmailPreferences(value.preferences);
    else await markOwnNoticeRead(value.action === "mark_read" ? value.noticeId : null);
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ ok: false, code: "notices_unavailable" }, { status: 503 }); }
}, { requireAuth: true, rateLimit: { limit: 30, windowSeconds: 60 } });
type Context = { params: Promise<Record<string, string | string[] | undefined>> };
export async function GET(request: NextRequest, context: Context) {
  const response = await get(request, context); response.headers.set("Cache-Control", "private, no-store, max-age=0"); return response;
}
export async function POST(request: NextRequest, context: Context) {
  const response = await post(request, context); response.headers.set("Cache-Control", "private, no-store, max-age=0"); return response;
}
