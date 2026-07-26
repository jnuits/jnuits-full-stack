import { afterEach, describe, expect, it, vi } from "vitest";

const sentryMocks = vi.hoisted(() => ({
  captureException: vi.fn(() => "event-id"),
  flush: vi.fn(async () => true),
}));

vi.mock("@sentry/nextjs", () => sentryMocks);

import { GET } from "./route";

async function expectDenied() {
  const response = await GET();

  expect(response.status).toBe(404);
  await expect(response.json()).resolves.toEqual({ error: "Not found." });
  expect(sentryMocks.captureException).not.toHaveBeenCalled();
  expect(sentryMocks.flush).not.toHaveBeenCalled();
}

describe("debug Sentry route", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("returns 404 in production without sending a Sentry event", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await expectDenied();
  });

  it("returns 404 on every deployed environment, not just production builds", async () => {
    // NODE_ENV describes the build, not where it runs. A deployed preview must
    // never expose an endpoint that mints Sentry events on demand.
    for (const vercelEnv of ["production", "preview", "development"]) {
      vi.clearAllMocks();
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("VERCEL_ENV", vercelEnv);

      await expectDenied();
    }
  });

  it("sends a verification event outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", "");

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, eventId: "event-id" });
    expect(sentryMocks.captureException).toHaveBeenCalledOnce();
    expect(sentryMocks.flush).toHaveBeenCalledWith(2_000);
  });
});
