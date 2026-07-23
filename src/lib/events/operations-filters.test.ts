import { describe, expect, it } from "vitest";
import {
  escapeEventRegistrationSearch,
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

  it("escapes PostgREST search metacharacters", () => {
    expect(escapeEventRegistrationSearch("a%b,c")).toBe("a\\%b\\,c");
  });

  it("preserves active filters in export links", () => {
    expect(
      eventRegistrationExportSearch({ query: "member@example.test", status: "confirmed" })
    ).toBe("&q=member%40example.test&status=confirmed");
  });
});
