import { describe, expect, it } from "vitest";

import { getRequestIp } from "./rate-limit";

describe("getRequestIp", () => {
  it("prefers Vercel's platform-controlled real IP over a client-supplied Cloudflare header", () => {
    const headers = new Headers({
      "cf-connecting-ip": "198.51.100.10",
      "x-forwarded-for": "198.51.100.11, 10.0.0.1",
      "x-real-ip": "203.0.113.5",
    });

    expect(getRequestIp(headers)).toBe("203.0.113.5");
  });

  it("falls back to Cloudflare and then the first forwarded address", () => {
    expect(
      getRequestIp(new Headers({ "cf-connecting-ip": "203.0.113.6" })),
    ).toBe("203.0.113.6");
    expect(
      getRequestIp(
        new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }),
      ),
    ).toBe("203.0.113.7");
  });
});
