import type { Breadcrumb, Event } from "@sentry/core";
import { describe, expect, it } from "vitest";
import { getSentryPrivacyOptions, scrubSentryBreadcrumb, scrubSentryEvent } from "./sentry-privacy";

describe("Sentry privacy controls", () => {
  it("removes request payloads and identity data before send", () => {
    const source = {
      breadcrumbs: [{ category: "ui.click", data: { authorization: "Bearer private-token", email: "student@example.test", status_code: 500 }, message: "Request for student@example.test" }],
      contexts: { form: { email: "student@example.test", fieldCount: 4 } },
      exception: { values: [{ type: "Error", value: "Unable to send to student@example.test" }] },
      extra: { email: "student@example.test", safeCount: 4, token: "private-token" },
      message: "Invitation failed for student@example.test",
      request: { cookies: { session: "private-session" }, data: { password: "private-password" }, headers: { authorization: "Bearer private-token" }, method: "POST", query_string: "email=student@example.test", url: "https://jnuits.org.bd/forms/member?email=student@example.test" },
      tags: { email: "student@example.test", route: "member-claim" },
      user: { email: "student@example.test", id: "user-1", ip_address: "203.0.113.42", username: "student" },
    };
    const scrubbed = scrubSentryEvent(source as Event);
    expect(scrubbed).toMatchObject({
      contexts: { form: { email: "[REDACTED]", fieldCount: 4 } },
      extra: { email: "[REDACTED]", safeCount: 4, token: "[REDACTED]" },
      request: { method: "POST", url: "https://jnuits.org.bd/forms/member" },
      tags: { email: "[REDACTED]", route: "member-claim" },
      user: { id: "user-1" },
    });
    expect(scrubbed?.breadcrumbs?.[0]?.message).toBeUndefined();
    expect(scrubbed?.message).toBe("Invitation failed for [REDACTED_EMAIL]");
  });

  it("scrubs form answers, export rows, provider signatures, signed URLs, and sensitive IDs", () => {
    const scrubbed = scrubSentryEvent({
      extra: {
        answers: { full_name: "Private Person" },
        cloudinary_signature: "provider-signature",
        export_rows: [{ email: "person@example.test" }],
        google_drive_id: "drive-private-id",
        resend_webhook_signature: "webhook-signature",
        safeCount: 2,
      },
      message: "Failed for JNUITS-24001 at https://res.cloudinary.com/demo/image/authenticated/s--secret--/v1/file.jpg",
    } as Event);
    expect(scrubbed?.extra).toEqual({
      answers: "[REDACTED]",
      cloudinary_signature: "[REDACTED]",
      export_rows: "[REDACTED]",
      google_drive_id: "[REDACTED]",
      resend_webhook_signature: "[REDACTED]",
      safeCount: 2,
    });
    expect(scrubbed?.message).not.toContain("JNUITS-24001");
    expect(scrubbed?.message).not.toContain("s--secret--");
  });

  it("drops network and console breadcrumbs", () => {
    expect(scrubSentryBreadcrumb({ category: "fetch" } as Breadcrumb)).toBeNull();
    expect(scrubSentryBreadcrumb({ category: "console" } as Breadcrumb)).toBeNull();
  });

  it("explicitly disables default PII, local variables, and logs", () => {
    expect(getSentryPrivacyOptions()).toMatchObject({
      dataCollection: { cookies: false, frameContextLines: 0, httpBodies: [], httpHeaders: { request: false, response: false }, queryParams: false, stackFrameVariables: false, userInfo: false },
      enableLogs: false,
      includeLocalVariables: false,
      sendDefaultPii: false,
    });
  });
});
