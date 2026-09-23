import { describe, expect, it } from "vitest";
import {
  expectedPortalLanding,
  hasPortalAuditFailures,
  isIgnorablePortalConsoleError,
  isExpectedPortalLanding,
} from "./lib/portal-audit-contracts.mjs";

const baseUrl = "http://localhost:3000";

describe("portal snapshot audit contracts", () => {
  it("models authenticated canonical and guard-route redirects", () => {
    expect(expectedPortalLanding("/portal/dashboard", true, baseUrl)).toBe(
      "/portal/dashboard"
    );
    expect(expectedPortalLanding("/portal/login", true, baseUrl)).toBe(
      "/portal/dashboard"
    );
    expect(expectedPortalLanding("/portal/access-pending", true, baseUrl)).toBe(
      "/portal/dashboard"
    );
    expect(expectedPortalLanding("/profile/edit", true, baseUrl)).toBe(
      "/portal/profile/edit"
    );
  });

  it("models unauthenticated protected-route redirects without treating login as protected", () => {
    expect(expectedPortalLanding("/portal/login", false, baseUrl)).toBe(
      "/portal/login"
    );
    expect(expectedPortalLanding("/portal", false, baseUrl)).toBe(
      "/portal/login?next=%2Fportal"
    );
    expect(
      expectedPortalLanding("/portal/access-pending", false, baseUrl)
    ).toBe("/portal/login?next=%2Fportal%2Faccess-pending");
  });

  it("rejects an unexpected landing route", () => {
    expect(
      isExpectedPortalLanding({
        baseUrl,
        isAuthenticated: true,
        landedRoute: "/portal/profile",
        requestedRoute: "/portal/activity",
      })
    ).toBe(false);
  });

  it("fails for findings, console errors, or page errors", () => {
    expect(
      hasPortalAuditFailures({ findings: [], consoleErrors: [], pageErrors: [] })
    ).toBe(false);
    expect(
      hasPortalAuditFailures({
        findings: ["[BROKEN_IMAGE] /portal/profile"],
        consoleErrors: [],
        pageErrors: [],
      })
    ).toBe(true);
    expect(
      hasPortalAuditFailures({
        findings: [],
        consoleErrors: [{ text: "Hydration failed" }],
        pageErrors: [],
      })
    ).toBe(true);
    expect(
      hasPortalAuditFailures({
        findings: [],
        consoleErrors: [],
        pageErrors: [{ message: "render failed" }],
      })
    ).toBe(true);
  });

  it("ignores only the exact known Turnstile formatting diagnostic", () => {
    const turnstileUrl =
      "https://challenges.cloudflare.com/cdn-cgi/challenge-platform/widget";

    expect(
      isIgnorablePortalConsoleError({
        text: "%c%d font-size:0;color:transparent NaN",
        url: turnstileUrl,
      })
    ).toBe(true);
    expect(
      isIgnorablePortalConsoleError({
        text: "Turnstile failed to load",
        url: turnstileUrl,
      })
    ).toBe(false);
    expect(
      isIgnorablePortalConsoleError({
        text: "%c%d font-size:0;color:transparent NaN",
        url: "https://example.com/application.js",
      })
    ).toBe(false);
  });
});
