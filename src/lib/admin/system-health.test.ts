import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  isCloudinaryConfigured: vi.fn(),
}));
vi.mock("@/lib/cloudinary/config", () => ({ isCloudinaryConfigured: mocks.isCloudinaryConfigured }));
vi.mock("@/lib/env", () => ({ getAppBaseUrl: () => "https://jnuits.example.test" }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/supabase/flexible", () => ({ asFlexibleClient: <T>(client: T) => client }));

import {
  buildMigrationParityReviewCheck,
  buildMigrationRuntimeReadinessCheck,
  buildSystemHealthSnapshot,
  type SystemHealthCheck,
} from "@/lib/admin/system-health";

function runtimeCheck(label: string, status: SystemHealthCheck["status"]): SystemHealthCheck {
  return { detail: "test", group: "Database", label, source: "runtime", status };
}

function queryResult() {
  return {
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ count: 0, data: [], error: null }).then(resolve),
  };
}

const originalEnv = process.env;

/**
 * Every server-only secret the snapshot can see gets a unique canary. A value
 * that is seeded but never asserted proves nothing, so all of these are checked
 * against the serialized snapshot.
 */
const secretCanaries = {
  appMac: "CANARY_APP_MAC_1f9c8372d4b65e0a01",
  google: "CANARY_GOOGLE_PRIVATE_7c8f3d",
  rateLimitSalt: "CANARY_RATE_LIMIT_SALT_5f1c84a2d7e309b6",
  resend: "CANARY_RESEND_WEBHOOK_4e2a91",
  retention: "CANARY_RETENTION_SIGNING_1a7be4",
  supabase: "CANARY_SUPABASE_PRIVILEGED_9b6d20",
  turnstile: "CANARY_TURNSTILE_SECRET_3d90fc",
};

function expectNoCanaryLeak(value: unknown) {
  const serialized = JSON.stringify(value);

  for (const [name, canary] of Object.entries(secretCanaries)) {
    expect(serialized, `${name} canary leaked`).not.toContain(canary);
  }
}

describe("system health", () => {
  const criticalLabels = ["Public certificate safe view", "Gallery album card view", "Rate-limit table", "Admin invitation metadata", "Server-only Auth lookup"];

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv,
      APP_MAC_SECRET: secretCanaries.appMac,
      AUTH_CAPTCHA_REQUIRED: "true",
      GOOGLE_DRIVE_EXPORTS_FOLDER_ID: "folder",
      GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL: "service@example.test",
      GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY: secretCanaries.google,
      GOOGLE_DRIVE_SHARED_DRIVE_ID: "drive",
      NEXT_PUBLIC_SENTRY_DSN: "https://public@example.test/1",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "site",
      RATE_LIMIT_BACKEND: "supabase",
      RATE_LIMIT_SECRET_SALT: secretCanaries.rateLimitSalt,
      RESEND_API_KEY: "resend",
      RESEND_FROM_EMAIL: "JnUITS <no-reply@example.test>",
      RESEND_WEBHOOK_SECRET: secretCanaries.resend,
      RETENTION_MANIFEST_SIGNING_SECRET: secretCanaries.retention,
      SUPABASE_SECRET_KEY: secretCanaries.supabase,
      TURNSTILE_SECRET_KEY: secretCanaries.turnstile,
    };
    mocks.isCloudinaryConfigured.mockReturnValue(true);
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn(() => queryResult()),
      rpc: vi.fn().mockResolvedValue({ error: null }),
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("reports runtime readiness only when every required object is reachable", () => {
    expect(buildMigrationRuntimeReadinessCheck(criticalLabels.map((label) => runtimeCheck(label, "ok"))).status).toBe("ok");
    expect(buildMigrationRuntimeReadinessCheck(criticalLabels.slice(0, -1).map((label) => runtimeCheck(label, "ok"))).status).toBe("fail");
  });

  it("keeps migration parity as explicit review", () => {
    expect(buildMigrationParityReviewCheck()).toMatchObject({ source: "review", status: "warn" });
  });

  it("exposes safe grouped integration status without raw secret values", async () => {
    const snapshot = await buildSystemHealthSnapshot();

    for (const label of ["Application MAC secret", "CAPTCHA", "Resend delivery", "Google Shared Drive", "Retention manifest signing", "Cloudinary", "Sentry"]) {
      expect(snapshot.checks.find((check) => check.label === label)?.status).toBe("ok");
    }

    expectNoCanaryLeak(snapshot);
  });

  it("reports the rate-limit salt by length without echoing it", async () => {
    const snapshot = await buildSystemHealthSnapshot();
    const salt = snapshot.checks.find((check) => check.label === "Rate-limit salt");

    expect(salt).toMatchObject({ status: "ok" });
    expect(salt?.detail).not.toContain(secretCanaries.rateLimitSalt);
  });

  it("reports the application MAC secret by length without echoing it", async () => {
    const snapshot = await buildSystemHealthSnapshot();
    const mac = snapshot.checks.find(
      (check) => check.label === "Application MAC secret",
    );

    expect(mac).toMatchObject({ status: "ok" });
    expect(mac?.detail).not.toContain(secretCanaries.appMac);
  });

  it("names missing configuration without exposing neighboring values", async () => {
    delete process.env.GOOGLE_DRIVE_EXPORTS_FOLDER_ID;
    const snapshot = await buildSystemHealthSnapshot();
    const drive = snapshot.checks.find((check) => check.label === "Google Shared Drive");

    expect(drive).toMatchObject({ status: "fail" });
    expect(drive?.detail).toContain("GOOGLE_DRIVE_EXPORTS_FOLDER_ID");
    expect(drive?.detail).not.toContain(process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID!);
    expectNoCanaryLeak(snapshot);
  });

  it("reports every missing secret by name when nothing is configured", async () => {
    for (const name of [
      "GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY",
      "RESEND_WEBHOOK_SECRET",
      "RETENTION_MANIFEST_SIGNING_SECRET",
      "TURNSTILE_SECRET_KEY",
    ]) {
      delete process.env[name];
    }

    const snapshot = await buildSystemHealthSnapshot();

    expect(snapshot.checks.find((check) => check.label === "CAPTCHA")?.detail).toContain("TURNSTILE_SECRET_KEY");
    expect(snapshot.checks.find((check) => check.label === "Resend delivery")?.detail).toContain("RESEND_WEBHOOK_SECRET");
    expect(snapshot.checks.find((check) => check.label === "Retention manifest signing")?.detail).toContain("RETENTION_MANIFEST_SIGNING_SECRET");
    expectNoCanaryLeak(snapshot);
  });
});
