import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withApiGuard } from "@/lib/security/with-api-guard";

const context = { params: Promise.resolve({}) };

function request(headers: HeadersInit = {}) {
  return new NextRequest("https://jnuits.org.bd/api/example", {
    headers,
    method: "POST",
  });
}

describe("withApiGuard", () => {
  beforeEach(() => {
    vi.stubEnv("APP_BASE_URL", "https://jnuits.org.bd");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("allows unsafe requests with a same-origin Origin header", async () => {
    const handler = vi.fn(() => NextResponse.json({ ok: true }));
    const response = await withApiGuard(handler)(
      request({ origin: "https://jnuits.org.bd" }),
      context
    );

    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("allows unsafe requests with a same-origin Referer fallback", async () => {
    const handler = vi.fn(() => NextResponse.json({ ok: true }));
    const response = await withApiGuard(handler)(
      request({ referer: "https://jnuits.org.bd/events" }),
      context
    );

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("rejects unsafe requests without Origin or Referer metadata", async () => {
    const handler = vi.fn(() => NextResponse.json({ ok: true }));
    const response = await withApiGuard(handler)(request(), context);

    await expect(response.json()).resolves.toEqual({
      message: "Cross-origin requests are not allowed.",
    });
    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it("rejects unsafe cross-origin requests", async () => {
    const handler = vi.fn(() => NextResponse.json({ ok: true }));
    const response = await withApiGuard(handler)(
      request({ origin: "https://attacker.example" }),
      context
    );

    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns a safe error envelope when the handler throws", async () => {
    const response = await withApiGuard(async () => {
      throw new Error("database password leaked in provider error");
    })(request({ origin: "https://jnuits.org.bd" }), context);

    await expect(response.json()).resolves.toEqual({
      message: "Unexpected server error.",
    });
    expect(response.status).toBe(500);
  });
});
