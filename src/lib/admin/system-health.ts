import "server-only";

import { isCloudinaryConfigured } from "@/lib/cloudinary/config";
import { getAppBaseUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";

export type HealthStatus = "fail" | "ok" | "warn";
export type HealthCheckSource = "review" | "runtime";
type SupabaseCountResult = { count: number | null; error: { message?: string } | null };
type SupabaseCountQuery = PromiseLike<SupabaseCountResult> & { eq(column: string, value: string): SupabaseCountQuery };
export type SystemHealthCheck = {
  detail: string;
  group: "Database" | "Delivery" | "Environment" | "Operations";
  label: string;
  source: HealthCheckSource;
  status: HealthStatus;
};

function hasEnv(name: string) { return Boolean(process.env[name]?.trim()); }
function envCheck(label: string, name: string, group: SystemHealthCheck["group"] = "Environment") {
  return { detail: hasEnv(name) ? `${name} is configured.` : `${name} is missing.`, group, label, source: "runtime", status: hasEnv(name) ? "ok" : "fail" } satisfies SystemHealthCheck;
}
function groupEnvCheck(label: string, names: string[], group: SystemHealthCheck["group"] = "Environment") {
  const missing = names.filter((name) => !hasEnv(name));
  return {
    detail: missing.length ? `${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} missing.` : "Required configuration is present.",
    group,
    label,
    source: "runtime",
    status: missing.length ? "fail" : "ok",
  } satisfies SystemHealthCheck;
}

async function headCheck(table: string, label: string): Promise<SystemHealthCheck> {
  const { error } = await asFlexibleClient(createAdminClient()).from(table as string).select("*", { count: "exact", head: true });
  return { detail: error ? "Required object is unavailable through the server service client." : "Required object is reachable through the server service client.", group: "Database", label, source: "runtime", status: error ? "fail" : "ok" };
}
async function functionCheck(functionName: string, args: Record<string, unknown>, label: string): Promise<SystemHealthCheck> {
  const { error } = await asFlexibleClient(createAdminClient()).rpc(functionName as string, args);
  return { detail: error ? "Required server-only database function is unavailable." : "Required server-only database function responded safely.", group: "Database", label, source: "runtime", status: error ? "fail" : "ok" };
}
async function countCheck(table: string, label: string, apply: (query: SupabaseCountQuery) => SupabaseCountQuery, warningThreshold = 1): Promise<SystemHealthCheck> {
  const query = apply(asFlexibleClient(createAdminClient()).from(table as string).select("*", { count: "exact", head: true }) as SupabaseCountQuery);
  const { count, error } = await query;
  if (error) return { detail: "Count query failed.", group: "Operations", label, source: "runtime", status: "fail" };
  const value = count || 0;
  return { detail: `${value} matching records.`, group: "Operations", label, source: "runtime", status: value >= warningThreshold ? "warn" : "ok" };
}

export function buildMigrationRuntimeReadinessCheck(checks: SystemHealthCheck[]): SystemHealthCheck {
  const criticalLabels = new Set(["Public certificate safe view", "Gallery album card view", "Rate-limit table", "Admin invitation metadata", "Server-only Auth lookup"]);
  const criticalChecks = checks.filter((check) => criticalLabels.has(check.label));
  const ready = criticalChecks.length === criticalLabels.size && criticalChecks.every((check) => check.status === "ok");
  return { detail: ready ? "All critical schema objects used by the current release are reachable." : "One or more critical schema objects are unavailable; investigate before deployment.", group: "Database", label: "Migration runtime readiness", source: "runtime", status: ready ? "ok" : "fail" };
}
export function buildMigrationParityReviewCheck(): SystemHealthCheck {
  return { detail: "Review required: runtime checks cannot compare local migrations with remote history. Run npm run migration:check before deployment.", group: "Database", label: "Migration parity review", source: "review", status: "warn" };
}

export async function buildSystemHealthSnapshot() {
  const appBaseUrl = getAppBaseUrl();
  const appMacLength = process.env.APP_MAC_SECRET?.trim().length || 0;
  const rateBackend = process.env.RATE_LIMIT_BACKEND?.trim().toLowerCase() || "";
  const rateSaltLength = process.env.RATE_LIMIT_SECRET_SALT?.trim().length || 0;
  const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
  const checks: SystemHealthCheck[] = [
    envCheck("Supabase URL", "NEXT_PUBLIC_SUPABASE_URL"),
    envCheck("Supabase publishable key", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    envCheck("Supabase secret key", "SUPABASE_SECRET_KEY"),
    { detail: appMacLength >= 32 ? "Secret length is acceptable." : "Secret must be at least 32 characters.", group: "Environment", label: "Application MAC secret", source: "runtime", status: appMacLength >= 32 ? "ok" : "fail" },
    { detail: isProduction ? "Production application URL is configured." : "Non-production application URL is configured.", group: "Environment", label: "App base URL", source: "runtime", status: isProduction && appBaseUrl.includes("localhost") ? "fail" : "ok" },
    { detail: rateBackend === "supabase" ? "Supabase-backed rate limiting is configured." : "Supabase-backed rate limiting is required.", group: "Environment", label: "Rate-limit backend", source: "runtime", status: rateBackend === "supabase" ? "ok" : "fail" },
    { detail: rateSaltLength >= 32 ? "Salt length is acceptable." : "Salt must be at least 32 characters.", group: "Environment", label: "Rate-limit salt", source: "runtime", status: rateSaltLength >= 32 ? "ok" : "fail" },
    groupEnvCheck("CAPTCHA", ["AUTH_CAPTCHA_REQUIRED", "NEXT_PUBLIC_TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY"]),
    groupEnvCheck("Resend delivery", ["RESEND_API_KEY", "RESEND_FROM_EMAIL", "RESEND_WEBHOOK_SECRET"], "Delivery"),
    groupEnvCheck("Google Shared Drive", ["GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL", "GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY", "GOOGLE_DRIVE_SHARED_DRIVE_ID", "GOOGLE_DRIVE_EXPORTS_FOLDER_ID"], "Delivery"),
    envCheck("Retention manifest signing", "RETENTION_MANIFEST_SIGNING_SECRET", "Delivery"),
    { detail: isCloudinaryConfigured() ? "Cloudinary signing credentials are configured." : "Cloudinary signing credentials are missing.", group: "Delivery", label: "Cloudinary", source: "runtime", status: isCloudinaryConfigured() ? "ok" : "fail" },
    { detail: hasEnv("SENTRY_DSN") || hasEnv("NEXT_PUBLIC_SENTRY_DSN") ? "Sentry DSN is configured." : "Sentry DSN is not configured.", group: "Delivery", label: "Sentry", source: "runtime", status: hasEnv("SENTRY_DSN") || hasEnv("NEXT_PUBLIC_SENTRY_DSN") ? "ok" : "warn" },
  ];
  const dbChecks = await Promise.all([
    headCheck("public_certificates", "Public certificate safe view"), headCheck("gallery_album_cards", "Gallery album card view"),
    headCheck("security_rate_limits", "Rate-limit table"), headCheck("admin_invitations", "Admin invitation metadata"), headCheck("audit_events", "Audit event table"),
    functionCheck("find_auth_user_id_by_email", { target_email: "migration-health-sentinel@invalid.example" }, "Server-only Auth lookup"),
    countCheck("member_invitations", "Failed invitation deliveries", (query) => query.eq("delivery_status", "failed")),
    countCheck("profile_update_requests", "Pending profile/workplace reviews", (query) => query.eq("status", "pending")),
  ]);
  const allChecks = [...checks, ...dbChecks, buildMigrationRuntimeReadinessCheck(dbChecks), buildMigrationParityReviewCheck()];
  return { checks: allChecks, counts: { fail: allChecks.filter((check) => check.status === "fail").length, ok: allChecks.filter((check) => check.status === "ok").length, warn: allChecks.filter((check) => check.status === "warn").length }, generatedAt: new Date().toISOString() };
}
