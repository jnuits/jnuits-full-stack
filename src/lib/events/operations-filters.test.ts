import { describe, expect, it } from "vitest";
import {
  buildEventRegistrationSearchPattern,
  eventRegistrationExportSearch,
  parseEventRegistrationFilters,
} from "./operations-filters";

describe("event operations filters", () => {
  it("normalizes bounded server-side filters", () => {
    const filters = parseEventRegistrationFilters(
      new URL(`https://jnuits.test/?status=waitlisted&q=${"a".repeat(150)}`)
    );
    expect(filters.status).toBe("waitlisted");
    expect(filters.query).toHaveLength(100);
  });

  it("falls back from unknown statuses", () => {
    expect(
      parseEventRegistrationFilters(new URL("https://jnuits.test/?status=deleted"))
        .status
    ).toBe("all");
  });

  it("quotes PostgREST search values while preserving literal LIKE characters", () => {
    expect(buildEventRegistrationSearchPattern('a%b_c,("quoted").')).toBe(
      String.raw`"%a\\%b\\_c,(\"quoted\").%"`,
    );
    expect(buildEventRegistrationSearchPattern(String.raw`a\b`)).toBe(
      String.raw`"%a\\\\b%"`,
    );
  });

  it("preserves active filters in export links", () => {
    expect(
      eventRegistrationExportSearch({ query: "member@example.test", status: "confirmed" })
    ).toBe("&q=member%40example.test&status=confirmed");
  });
});
