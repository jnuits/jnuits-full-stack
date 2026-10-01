import { describe, expect, it } from "vitest";

import { formatDhakaDate, formatRenewalState } from "./anniversary";

describe("membership renewal presentation", () => {
  it.each([
    ["2024-07-01", "1 July 2024"],
    ["2025-12-31", "31 December 2025"],
    ["2026-01-01", "1 January 2026"],
    ["2024-02-29", "29 February 2024"],
    ["2025-02-28", "28 February 2025"],
    ["2028-02-29", "29 February 2028"],
  ])("displays database date %s without a browser-local midnight shift", (date, display) => {
    expect(formatDhakaDate(date)).toBe(display);
  });

  it.each(["2025-02-29", "2026-13-01", "2026-01-00", "01/07/2024", "2026-01-01T00:00:00Z"])(
    "refuses invalid or non-date-only input %s",
    (input) => expect(() => formatDhakaDate(input)).toThrow(RangeError),
  );

  it("does not invent an unknown historical joining or due date", () => {
    expect(formatDhakaDate(null)).toBe("Not recorded");
    expect(formatRenewalState({ state: "unknown", dueOn: null, graceEndsOn: null })).toMatchObject({
      label: "Joining date needs review",
      description: expect.stringMatching(/administrator/i),
    });
  });

  it("presents the database's paid state before the due date", () => {
    expect(formatRenewalState({ state: "paid", dueOn: "2025-07-01", graceEndsOn: "2026-01-01" }))
      .toMatchObject({ label: "Membership current", description: expect.stringContaining("1 July 2025") });
  });

  it("explains continued access when the database reports grace on the exact due date", () => {
    const display = formatRenewalState({ state: "grace", dueOn: "2025-07-01", graceEndsOn: "2026-01-01" });
    expect(display.label).toBe("Renewal overdue — grace period");
    expect(display.description).toMatch(/1 July 2025.*1 January 2026/);
    expect(display.description).toMatch(/continue using/i);
  });

  it("shows the former-state choice at the database's exact six-month boundary", () => {
    const display = formatRenewalState({ state: "former", dueOn: "2025-07-01", graceEndsOn: "2026-01-01" });
    expect(display.label).toBe("Former member");
    expect(display.description).toMatch(/administrator.*confirm/i);
    expect(display.description).not.toMatch(/payment processed|paid successfully/i);
  });

  it("does not solicit annual renewal from alumni", () => {
    expect(formatRenewalState({ state: "not_applicable", dueOn: "2025-07-01", graceEndsOn: null }))
      .toMatchObject({ label: "Annual renewal not required", description: expect.not.stringContaining("pay") });
  });
});
