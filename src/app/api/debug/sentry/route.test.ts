import { afterEach, describe, expect, it, vi } from "vitest";

const sentryMocks = vi.hoisted(() => ({
  captureException: vi.fn(() => "event-id"),
  flush: vi.fn(async () => true),
}));

vi.mock("@sentry/nextjs", () => sentryMocks);

import { GET } from "./route";

describe("debug Sentry route", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("returns 404 in production without sending a Sentry event", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const response = await GET();

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Not found." });
    expect(sentryMocks.captureException).not.toHaveBeenCalled();
    expect(sentryMocks.flush).not.toHaveBeenCalled();
  });

  it("sends a verification event outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, eventId: "event-id" });
    expect(sentryMocks.captureException).toHaveBeenCalledOnce();
    expect(sentryMocks.flush).toHaveBeenCalledWith(2_000);
  });
});