import { describe, expect, it } from "vitest";

import { resolveSignOutRedirect } from "./sign-out-redirect";

describe("sign-out redirect", () => {
  it("allows only the two application login destinations", () => {
    expect(resolveSignOutRedirect("/admin/login")).toBe("/admin/login");
    expect(resolveSignOutRedirect("/portal/login")).toBe("/portal/login");
  });

  it("falls back for external, protocol-relative, and unexpected paths", () => {
    for (const destination of [
      "https://attacker.example/after-logout",
      "//attacker.example/after-logout",
      "/admin/dashboard",
      "javascript:alert(1)",
      "",
    ]) {
      expect(resolveSignOutRedirect(destination)).toBe("/portal/login");
    }
  });
});
