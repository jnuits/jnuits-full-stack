import { expect, test } from "@playwright/test";
import { FIXTURE_SENTRY_DSN, installFixtureTelemetry } from "./fixtures/telemetry";

const origin = "http://127.0.0.1:3100";
const envelope = "https://example.ingest.sentry.io/api/123/envelope/?sentry_key=public";

// A synthetic document and catch-all keep these fixture tests completely offline.
// The sentinel exposes any traffic the scoped fixture does not intercept.
test.beforeEach(async ({ context, page }) => {
  await context.route("**/*", async route => {
    if (route.request().isNavigationRequest()) {
      await route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Telemetry fixture</title>" });
      return;
    }
    await route.fulfill({
      status: 418,
      headers: { "access-control-allow-origin": origin },
      body: "outside-fixture",
    });
  });
  await page.goto(`${origin}/__telemetry_fixture__`);
});

test("placeholder envelopes and the local tunnel have usable browser responses", async ({ context, page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await installFixtureTelemetry(context, { baseURL: origin, dsn: FIXTURE_SENTRY_DSN });
  for (const url of [envelope, `${origin}/monitoring?sentry_client=fixture`]) {
    const result = await page.evaluate(async endpoint => {
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/x-sentry-envelope" }, body: "synthetic-envelope" });
      return { status: response.status, body: await response.text() };
    }, url);
    expect(result).toEqual({ status: 200, body: "{}" });
  }
  expect(errors).toEqual([]);
});

test("unrelated hosts, paths and read requests reach the original handler", async ({ context, page }) => {
  await installFixtureTelemetry(context, { baseURL: origin, dsn: FIXTURE_SENTRY_DSN });
  const requests = [
    { url: envelope, method: "GET" },
    { url: "https://example.ingest.sentry.io/api/999/envelope/", method: "POST" },
    { url: "https://another-ingest.invalid/api/123/envelope/", method: "POST" },
    { url: `${origin}/api/newsletter/subscribe`, method: "POST" },
  ];
  for (const request of requests) {
    const result = await page.evaluate(async ({ url, method }) => {
      const response = await fetch(url, { method });
      return { status: response.status, body: await response.text() };
    }, request);
    expect(result).toEqual({ status: 418, body: "outside-fixture" });
  }
});

for (const options of [
  { baseURL: "https://jnuits.org.bd", dsn: FIXTURE_SENTRY_DSN },
  { baseURL: origin, dsn: "https://synthetic@another-ingest.invalid/123" },
  { baseURL: origin, dsn: undefined },
]) {
  test(`transport stays untouched with ${options.baseURL === origin ? options.dsn ? "a different DSN" : "no DSN" : "an external base URL"}`, async ({ context, page }) => {
    await installFixtureTelemetry(context, options);
    const result = await page.evaluate(async endpoint => {
      const response = await fetch(endpoint, { method: "POST" });
      return { status: response.status, body: await response.text() };
    }, envelope);
    expect(result).toEqual({ status: 418, body: "outside-fixture" });
  });
}
