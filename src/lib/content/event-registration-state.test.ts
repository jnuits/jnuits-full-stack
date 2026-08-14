import { describe, expect, it } from "vitest";
import {
  deriveEventRegistrationState,
  isEventRegistrationWindowClosed,
} from "@/lib/content/events";

const externalEvent = {
  capacity: null,
  ends_at: null,
  registration_closes_at: "2026-08-15T17:59:00Z",
  registration_mode: "external",
  registration_open: false,
  starts_at: "2026-08-30T03:00:00Z",
} as const;

const internalEvent = {
  capacity: 20,
  ends_at: "2026-08-30T06:00:00Z",
  registration_closes_at: "2026-08-29T17:59:00Z",
  registration_mode: "internal",
  registration_open: true,
  starts_at: "2026-08-30T03:00:00Z",
} as const;

describe("event registration state", () => {
  it("keeps external registration available before its deadline regardless of the internal open flag", () => {
    expect(
      deriveEventRegistrationState(
        externalEvent,
        0,
        new Date("2026-08-15T17:58:59Z")
      )
    ).toBe("external");
  });

  it.each([
    "2026-08-15T17:59:00Z",
    "2026-08-15T17:59:01Z",
  ])("closes external registration at or after its deadline (%s)", (now) => {
    expect(deriveEventRegistrationState(externalEvent, 0, new Date(now))).toBe(
      "closed"
    );
  });

  it("closes external registration when the event begins without a separate deadline", () => {
    expect(
      deriveEventRegistrationState(
        { ...externalEvent, registration_closes_at: null },
        0,
        new Date("2026-08-30T03:00:00Z")
      )
    ).toBe("closed");
  });

  it("keeps an internal event open before its deadline when capacity remains", () => {
    expect(
      deriveEventRegistrationState(
        internalEvent,
        19,
        new Date("2026-08-14T12:00:00Z")
      )
    ).toBe("open");
  });

  it("marks an internal event full when its registration count reaches capacity", () => {
    expect(
      deriveEventRegistrationState(
        internalEvent,
        20,
        new Date("2026-08-14T12:00:00Z")
      )
    ).toBe("full");
  });

  it("closes internal registration when its open flag is disabled", () => {
    expect(
      deriveEventRegistrationState(
        { ...internalEvent, registration_open: false },
        0,
        new Date("2026-08-14T12:00:00Z")
      )
    ).toBe("closed");
  });

  it("returns none for events that do not accept registration", () => {
    expect(
      deriveEventRegistrationState(
        { ...externalEvent, registration_mode: "none" },
        0,
        new Date("2026-08-14T12:00:00Z")
      )
    ).toBe("none");
  });

  it("treats the exact internal mutation deadline as closed", () => {
    expect(
      isEventRegistrationWindowClosed(
        internalEvent,
        new Date("2026-08-29T17:59:00Z")
      )
    ).toBe(true);
  });
});
