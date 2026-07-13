import type { Breadcrumb, Event } from "@sentry/core";
import { describe, expect, it } from "vitest";
import {
  getSentryPrivacyOptions,
  scrubSentryBreadcrumb,
  scrubSentryEvent,
} from "./sentry-privacy";

describe("Sentry privacy controls", () => {
  it("removes request payloads and identity data before an event is sent", () => {
    const source = {
      breadcrumbs: [
        {
          category: "ui.click",
          data: {
            authorization: "Bearer private-token",
            email: "student@example.test",
            status_code: 500,
          },
          message: "Request for student@example.test",
        },
      ],
      contexts: {
        form: {
          email: "student@example.test",
          fieldCount: 4,
        },
      },
      exception: {
        values: [
          { type: "Error", value: "Unable to send to student@example.test" },
        ],
      },
      extra: {
        email: "student@example.test",
        safeCount: 4,
        token: "private-token",
      },
      message: "Invitation failed for student@example.test",
      request: {
        cookies: { session: "private-session" },
        data: { password: "private-password" },
        headers: { authorization: "Bearer private-token" },
        method: "POST",
        query_string: "email=student@example.test",
        url: "https://jnuits.org.bd/forms/member?email=student@example.test",
      },
      tags: {
        email: "student@example.test",
        route: "member-claim",
      },
      user: {
        email: "student@example.test",
        id: "user-1",
        ip_address: "203.0.113.42",
        username: "student",
      },
    };

    const scrubbed = scrubSentryEvent(source as Event);

    expect(scrubbed).toMatchObject({
      breadcrumbs: [
        {
          category: "ui.click",
          data: {
            authorization: "[REDACTED]",
            email: "[REDACTED]",
            status_code: 500,
          },
        },
      ],
      contexts: { form: { email: "[REDACTED]", fieldCount: 4 } },
      extra: {
        email: "[REDACTED]",
        safeCount: 4,
        token: "[REDACTED]",
      },
      request: {
        method: "POST",
        url: "https://jnuits.org.bd/forms/member",
      },
      tags: { email: "[REDACTED]", route: "member-claim" },
      user: { id: "user-1" },
    });
    expect(scrubbed?.breadcrumbs?.[0]?.message).toBeUndefined();
    expect(scrubbed?.exception?.values?.[0]?.value).toBe(
      "Unable to send to [REDACTED_EMAIL]"
    );
    expect(scrubbed?.message).toBe("Invitation failed for [REDACTED_EMAIL]");
    expect(scrubbed).not.toBe(source);
    expect(source.request.data).toEqual({ password: "private-password" });
  });

  it("drops network and console breadcrumbs before collection", () => {
    expect(scrubSentryBreadcrumb({ category: "fetch" } as Breadcrumb)).toBeNull();
    expect(scrubSentryBreadcrumb({ category: "console" } as Breadcrumb)).toBeNull();
  });

  it("drops private breadcrumbs that bypass collection before sending an event", () => {
    const scrubbed = scrubSentryEvent({
      breadcrumbs: [
        { category: "fetch", message: "Request for student@example.test" },
        { category: "ui.click", message: "Opened member directory" },
      ],
    } as Event);

    expect(scrubbed?.breadcrumbs).toEqual([{ category: "ui.click" }]);
  });

  it("disables default PII capture, local variables, and Sentry log capture", () => {
    const options = getSentryPrivacyOptions();

    expect(options).toMatchObject({
      dataCollection: {
        cookies: false,
        frameContextLines: 0,
        httpBodies: [],
        httpHeaders: { request: false, response: false },
        queryParams: false,
        stackFrameVariables: false,
        userInfo: false,
      },
      enableLogs: false,
      includeLocalVariables: false,
    });
    expect(options).not.toHaveProperty("sendDefaultPii");
  });
});
