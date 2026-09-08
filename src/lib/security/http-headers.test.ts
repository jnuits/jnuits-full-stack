import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy, buildSecurityHeaders } from "./http-headers";

describe("security headers", () => {
  it("omits unsafe-eval from production CSP", () => {
    const csp = buildContentSecurityPolicy({ allowUnsafeEval: false });

    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toContain("https://challenges.cloudflare.com");
    expect(csp).toContain("https://api.pwnedpasswords.com");
    expect(csp).toContain("worker-src 'self' blob:");
    expect(csp).toContain(
      "frame-src 'self' https://challenges.cloudflare.com https://www.google.com"
    );
  });

  it("keeps the powered-by replacement headers explicit", () => {
    const headers = buildSecurityHeaders({ allowUnsafeEval: false, includeHsts: true });
    const headerMap = new Map(headers.map((header) => [header.key, header.value]));

    expect(headerMap.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headerMap.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(headerMap.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headerMap.get("Strict-Transport-Security")).toContain("max-age=63072000");
    expect(headerMap.has("X-Powered-By")).toBe(false);
  });
});
