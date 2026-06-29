import "server-only";

import { isCloudinaryConfigured } from "@/lib/cloudinary/config";
import { getAppBaseUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { asFlexibleClient } from "@/lib/supabase/flexible";

export type HealthStatus = "fail" | "ok" | "warn";

type SupabaseCountResult = {
  count: number | null;
  error: { message?: string } | null;
};

type SupabaseCountQuery = PromiseLike<SupabaseCountResult> & {
  eq(column: string, value: string): SupabaseCountQuery;
};
export type SystemHealthCheck = {
  detail: string;
  group: "Database" | "Delivery" | "Environment" | "Operations";
  label: string;
  status: HealthStatus;
};

function hasEnv(name: string) {
  return Boolean(process.env[name]?.trim());
}

function envCheck(label: string, name: string, group: SystemHealthCheck["group"] = "Environment") {
  return {
    detail: hasEnv(name) ? `${name} is configured.` : `${name} is missing.`,
    group,
    label,
    status: hasEnv(name) ? "ok" : "fail",
  } satisfies SystemHealthCheck;
}

async function headCheck(table: string, label: string): Promise<SystemHealthCheck> {
  const admin = asFlexibleClient(createAdminClient());
  const { error } = await admin.from(table as string).select("*", { count: "exact", head: true });

  return {
    detail: error ? "Object is unavailable through the service client." : "Object is reachable through the service client.",
    group: "Database",
    label,
    status: error ? "fail" : "ok",
  };
}

async function countCheck(
  table: string,
  label: string,
  apply: (query: SupabaseCountQuery) => SupabaseCountQuery,
  warningThreshold = 1
): Promise<SystemHealthCheck> {
  const admin = asFlexibleClient(createAdminClient());
  const query = apply(
    admin.from(table as string).select("*", { count: "exact", head: true }) as SupabaseCountQuery
  );
  const { count, error } = await query;

  if (error) {
    return {
      detail: "Count query failed.",
      group: "Operations",
      label,
      status: "fail",
    };
  }

  const value = count || 0;
  return {
    detail: `${value} matching records.`,
    group: "Operations",
    label,
    status: value >= warningThreshold ? "warn" : "ok",
  };
}

export async function buildSystemHealthSnapshot() {
  const appBaseUrl = getAppBaseUrl();
  const rateBackend = process.env.RATE_LIMIT_BACKEND?.trim().toLowerCase() || "";
  const rateSaltLength = process.env.RATE_LIMIT_SECRET_SALT?.trim().length || 0;
  const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";

  const checks: SystemHealthCheck[] = [
    envCheck("Supabase URL", "NEXT_PUBLIC_SUPABASE_URL"),
    envCheck("Supabase publishable key", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    envCheck("Supabase secret key", "SUPABASE_SECRET_KEY"),
    {
      detail: appBaseUrl,
      group: "Environment",
      label: "App base URL",
      status: isProduction && appBaseUrl.includes("localhost") ? "fail" : "ok",
    },
    {
      detail: rateBackend || "Not configured",
      group: "Environment",
      label: "Rate-limit backend",
      status: rateBackend === "supabase" ? "ok" : "fail",
    },
    {
      detail: rateSaltLength >= 32 ? "Salt length is acceptable." : "Salt must be at least 32 characters.",
      group: "Environment",
      label: "Rate-limit salt",
      status: rateSaltLength >= 32 ? "ok" : "fail",
    },
    envCheck("Turnstile site key", "NEXT_PUBLIC_TURNSTILE_SITE_KEY"),
    envCheck("Turnstile secret", "TURNSTILE_SECRET_KEY"),
    envCheck("Resend API key", "RESEND_API_KEY", "Delivery"),
    envCheck("Resend from address", "RESEND_FROM_EMAIL", "Delivery"),
    {
      detail: isCloudinaryConfigured()
        ? "Cloudinary signing credentials are configured."
        : "Cloudinary signing credentials are missing.",
      group: "Delivery",
      label: "Cloudinary",
      status: isCloudinaryConfigured() ? "ok" : "fail",
    },
    {
      detail: hasEnv("SENTRY_DSN") || hasEnv("NEXT_PUBLIC_SENTRY_DSN")
        ? "Sentry DSN is configured."
        : "Sentry DSN is not configured.",
      group: "Delivery",
      label: "Sentry",
      status: hasEnv("SENTRY_DSN") || hasEnv("NEXT_PUBLIC_SENTRY_DSN") ? "ok" : "warn",
    },
    {
      detail: "Run npm run migration:check where Supabase CLI is installed.",
      group: "Database",
      label: "Migration parity check",
      status: "warn",
    },
  ];

  const dbChecks = await Promise.all([
    headCheck("public_certificates", "Public certificate safe view"),
    headCheck("gallery_album_cards", "Gallery album card view"),
    headCheck("security_rate_limits", "Rate-limit table"),
    headCheck("audit_events", "Audit event table"),
    countCheck(
      "member_invitations",
      "Failed invitation deliveries",
      (query) => query.eq("delivery_status", "failed")
    ),
    countCheck(
      "profile_update_requests",
      "Pending profile/workplace reviews",
      (query) => query.eq("status", "pending")
    ),
  ]);

  const allChecks = [...checks, ...dbChecks];

  return {
    checks: allChecks,
    counts: {
      fail: allChecks.filter((check) => check.status === "fail").length,
      ok: allChecks.filter((check) => check.status === "ok").length,
      warn: allChecks.filter((check) => check.status === "warn").length,
    },
    generatedAt: new Date().toISOString(),
  };
}