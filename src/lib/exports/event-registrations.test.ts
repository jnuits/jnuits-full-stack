import { describe, expect, it } from "vitest";
import { createCsv } from "./tabular";
import { eventRegistrationsToExportTable } from "./event-registrations";

describe("event registration exports", () => {
  it("protects attacker-controlled attendee cells from spreadsheet formulas", () => {
    const table = eventRegistrationsToExportTable([{
      cancelled_at: null,
      checked_in_at: null,
      created_at: "2026-07-23T15:00:00.000Z",
      promoted_at: null,
      registration_code: "CODE1234",
      registration_status: "confirmed",
      registrant_email: "+cmd@example.test",
      registrant_name: "=HYPERLINK(\"https://evil.test\")",
      registrant_phone: "@SUM(1,1)",
      waitlisted_at: null,
    }]);
    const csv = createCsv(table);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'+cmd@example.test");
    expect(csv).toContain("'@SUM(1,1)");
  });

  it("keeps status and opaque reference in the approved export schema", () => {
    const table = eventRegistrationsToExportTable([{
      cancelled_at: null,
      checked_in_at: null,
      created_at: "2026-07-23T15:00:00.000Z",
      promoted_at: null,
      registration_code: "AB12CD34",
      registration_status: "waitlisted",
      registrant_email: "member@example.test",
      registrant_name: "Member",
      registrant_phone: null,
      waitlisted_at: "2026-07-23T15:00:00.000Z",
    }]);
    expect(table.rows[0]).toMatchObject({ reference: "AB12CD34", status: "waitlisted" });
  });
});
