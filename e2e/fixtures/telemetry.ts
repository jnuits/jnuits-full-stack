import type { BrowserContext } from "@playwright/test";

export const FIXTURE_SENTRY_DSN = "https://public@example.ingest.sentry.io/123";

/** Keep only the CI placeholder transport offline; live telemetry is untouched. */
export async function installFixtureTelemetry(
  context: BrowserContext,
  { baseURL, dsn }: { baseURL?: string; dsn?: string },
): Promise<void> {
  if (dsn !== FIXTURE_SENTRY_DSN || !baseURL) return;

  const base = new URL(baseURL);
  if (!(["http:", "https:"].includes(base.protocol) && ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname))) return;

  await context.route(url =>
    (url.origin === "https://example.ingest.sentry.io" && url.pathname === "/api/123/envelope/") ||
    (url.origin === base.origin && url.pathname === "/monitoring"),
  async route => {
    if (!["POST", "OPTIONS"].includes(route.request().method())) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": base.origin,
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "content-type, sentry-trace, baggage",
      },
      body: "{}",
    });
  });
}
