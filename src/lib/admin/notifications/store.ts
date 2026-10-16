import "server-only";
import { z } from "zod";
import { requireAdminPermission } from "@/lib/auth/session";
import { loadAdminVerificationActor } from "@/lib/auth/admin-verification/actor";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";

const time = z.iso.datetime({ offset: true });
const notice = z.object({ id: z.uuid(), title: z.string().max(160), summary: z.string().max(512),
  actorLabel: z.string().max(200), occurredAt: time, severity: z.enum(["info", "warning", "critical"]),
  readAt: time.nullable(), href: z.string().startsWith("/admin/audit?").nullable(),
  deliveryStatus: z.enum(["pending", "accepted", "delivered", "suppressed", "failed", "uncertain"]).optional() });
const inbox = z.object({ items: z.array(notice).max(100), totalItems: z.number().int().nonnegative(),
  page: z.number().int().positive(), pageSize: z.number().int().min(1).max(100), unreadCount: z.number().int().nonnegative() });
const preferences = z.strictObject({ admin_security_email_opt_in: z.boolean(), admin_recommendation_email_opt_in: z.boolean() });
const jobHealth = z.strictObject({state:z.enum(["current","attention","delayed","unavailable"]),
  lastFinishedAt:time.nullable(),lastSuccessfulAt:time.nullable(),backlog:z.boolean(),operatorAttentionCount:z.number().int().nonnegative()});

async function currentActor() {
  const actor = await loadAdminVerificationActor();
  if (!actor.ok || (actor.value.enforced && actor.value.currentLevel !== "aal2")) throw new Error("Verified admin session required");
  return actor.value;
}

export async function loadOwnAdminNotices({ page = 1, pageSize = 25 }: { page?: number; pageSize?: number }) {
  await requireAdminPermission("admin.audit.read", { fallbackPath: "/admin/dashboard" });
  const actor = await currentActor();
  const boundedPage = Number.isSafeInteger(page) && page > 0 ? page : 1;
  const boundedSize = Number.isFinite(pageSize) ? Math.max(1, Math.min(100, Math.trunc(pageSize))) : 25;
  const { data, error } = await asFlexibleClient(createAdminClient()).rpc("query_own_admin_notices", {
    p_actor: actor, p_page: boundedPage, p_page_size: boundedSize,
  });
  const parsed = inbox.safeParse(data);
  if (error || !parsed.success) throw new Error("Notice inbox unavailable");
  return parsed.data;
}

export async function markOwnNoticeRead(noticeId: string | null) {
  if (noticeId !== null && !z.uuid().safeParse(noticeId).success) throw new Error("Invalid notice");
  await requireAdminPermission("admin.audit.read", { fallbackPath: "/admin/dashboard" });
  const actor = await currentActor();
  const { data, error } = await asFlexibleClient(createAdminClient()).rpc("mark_own_admin_notice_read", { p_actor: actor, p_notice_id: noticeId });
  if (error || data !== true) throw new Error("Notice could not be marked read");
}

/** Self service only; this never grants global notification-settings access. */
export async function loadOwnAdminEmailPreferences() {
  const actor = await currentActor();
  const { data, error } = await asFlexibleClient(createAdminClient()).rpc("own_admin_email_preferences", { p_actor: actor, p_preferences: null });
  const parsed = preferences.safeParse(data);
  if (error || !parsed.success) throw new Error("Email preferences unavailable");
  return parsed.data;
}

export async function saveOwnAdminEmailPreferences(input: unknown) {
  const value = preferences.parse(input);
  const actor = await currentActor();
  const { data, error } = await asFlexibleClient(createAdminClient()).rpc("own_admin_email_preferences", { p_actor: actor, p_preferences: value });
  const parsed = preferences.safeParse(data);
  if (error || !parsed.success) throw new Error("Email preferences unavailable");
  return parsed.data;
}

export async function loadOwnAdminNotificationHealth() {
  await requireAdminPermission("admin.audit.read",{fallbackPath:"/admin/dashboard"});
  const actor=await currentActor();
  const {data,error}=await asFlexibleClient(createAdminClient()).rpc("query_admin_accountability_health",{p_actor:actor});
  const parsed=jobHealth.safeParse(data);
  if(error||!parsed.success)throw new Error("Job health unavailable");
  return parsed.data;
}
