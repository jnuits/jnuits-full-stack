import type { ErrorEvent } from "@sentry/core";
import { describe, expect, it } from "vitest";

import { scrubSentryEvent } from "./sentry-privacy";

type Frame = Record<string, unknown>;

function eventWithFrames(frames: Frame[]): ErrorEvent {
  return {
    exception: {
      values: [
        {
          stacktrace: { frames },
          type: "Error",
          value: "Retention archive could not be completed.",
        },
      ],
    },
  } as unknown as ErrorEvent;
}

function framesOf(event: ErrorEvent | null) {
  return (
    (event as unknown as {
      exception: { values: Array<{ stacktrace: { frames: Frame[] } }> };
    }).exception.values[0].stacktrace.frames
  );
}

describe("Sentry error visibility", () => {
  it("keeps stack frames diagnosable", () => {
    const scrubbed = scrubSentryEvent(
      eventWithFrames([
        {
          abs_path: "/var/task/src/lib/retention/operations.ts",
          colno: 17,
          filename: "src/lib/retention/operations.ts",
          function: "archiveRetentionJob",
          in_app: true,
          lineno: 482,
          module: "lib/retention/operations",
        },
      ])
    );

    // `filename` matches the `name` branch of the sensitive-key pattern, so
    // without an explicit exemption every frame path became [REDACTED] and the
    // exception was unreadable.
    expect(framesOf(scrubbed)[0]).toEqual({
      abs_path: "/var/task/src/lib/retention/operations.ts",
      colno: 17,
      filename: "src/lib/retention/operations.ts",
      function: "archiveRetentionJob",
      in_app: true,
      lineno: 482,
      module: "lib/retention/operations",
    });
  });

  it("preserves the error type and message shape", () => {
    const scrubbed = scrubSentryEvent(eventWithFrames([]));
    const value = (scrubbed as unknown as {
      exception: { values: Array<{ type: string; value: string }> };
    }).exception.values[0];

    expect(value.type).toBe("Error");
    expect(value.value).toBe("Retention archive could not be completed.");
  });

  it("still redacts sensitive data that appears alongside a frame", () => {
    const scrubbed = scrubSentryEvent(
      eventWithFrames([
        {
          filename: "src/app/api/forms/[slug]/submit/route.ts",
          function: "POST",
          lineno: 91,
          submitter_email: "person@example.test",
          vars: { full_name: "Someone Real", phone: "+8801711223344" },
        },
      ])
    );
    const frame = framesOf(scrubbed)[0];

    expect(frame.filename).toBe("src/app/api/forms/[slug]/submit/route.ts");
    expect(frame.submitter_email).toBe("[REDACTED]");
    expect(frame.vars).toEqual({ full_name: "[REDACTED]", phone: "[REDACTED]" });
  });

  it("still redacts a free-text email or signed URL inside a frame value", () => {
    const scrubbed = scrubSentryEvent(
      eventWithFrames([
        {
          detail:
            "failed for person@example.test via https://res.cloudinary.com/demo/raw/authenticated/s--abc123--/v1/object.pdf",
          filename: "src/lib/forms/cloudinary-assets.ts",
        },
      ])
    );
    const detail = String(framesOf(scrubbed)[0].detail);

    expect(detail).not.toContain("person@example.test");
    expect(detail).not.toContain("s--abc123--");
  });
});
