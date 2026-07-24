import { describe, expect, it, vi } from "vitest";

import { fetchGoogleWithRetry, normalizeGooglePrivateKey } from "./google-drive";

describe("Google Shared Drive integration", () => {
  it("normalizes escaped multiline keys without logging or exposing them", () => {
    expect(normalizeGooglePrivateKey("  line-1\\nline-2  ")).toBe("line-1\nline-2");
  });

  it("retries rate limits with bounded exponential backoff", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response("quota", { status: 429 }))
      .mockResolvedValueOnce(new Response("temporary", { status: 503 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const sleep = vi.fn().mockResolvedValue(undefined);

    const response = await fetchGoogleWithRetry("https://google.example.test", { method: "POST" }, { fetchImpl, sleep });

    expect(response.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 250);
    expect(sleep).toHaveBeenNthCalledWith(2, 500);
  });

  it("does not retry permanent authorization failures", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("forbidden", { status: 403 }));
    const sleep = vi.fn();

    const response = await fetchGoogleWithRetry("https://google.example.test", { method: "POST" }, { fetchImpl, sleep });

    expect(response.status).toBe(403);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("stops after three retryable failures", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 }));
    const sleep = vi.fn().mockResolvedValue(undefined);

    const response = await fetchGoogleWithRetry("https://google.example.test", { method: "GET" }, { fetchImpl, sleep });

    expect(response.status).toBe(503);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });
});
