import { describe, expect, it } from "vitest";

import {
  checkPasswordExposure,
  sha1PasswordHash,
} from "@/lib/security/pwned-passwords";

describe("Pwned Passwords k-anonymity helper", () => {
  it("hashes a password locally using SHA-1", async () => {
    await expect(sha1PasswordHash("password")).resolves.toBe(
      "5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8"
    );
  });

  it("sends only the five-character hash prefix and finds a matching suffix", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const result = await checkPasswordExposure("password", {
      fetchImpl: async (input, init) => {
        requests.push({ init, url: String(input) });
        return new Response("1E4C9B93F3F0682250B6CF8331B7EE68FD8:123\r\nAAAA:0\r\n");
      },
    });

    expect(result).toEqual({ count: 123, status: "pwned" });
    const requestUrl = new URL(requests[0]?.url || "https://example.com");
    expect(requestUrl.toString()).toBe("https://api.pwnedpasswords.com/range/5BAA6");
    expect(`${requestUrl.pathname}${requestUrl.search}`).not.toContain("password");
    expect(requests[0]?.init?.headers).toMatchObject({ "Add-Padding": "true" });
  });

  it("treats a missing suffix as safe", async () => {
    const result = await checkPasswordExposure("password", {
      fetchImpl: async () => new Response("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:0\r\n"),
    });

    expect(result).toEqual({ status: "safe" });
  });

  it("fails closed when the range service is unavailable", async () => {
    const result = await checkPasswordExposure("password", {
      fetchImpl: async () => new Response("", { status: 503 }),
    });

    expect(result).toEqual({ status: "unavailable" });
  });
});
