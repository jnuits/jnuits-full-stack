import "server-only";

import type { ExportTable } from "./tabular";

export type EventRegistrationExportRow = {
  cancelled_at: null | string;
  checked_in_at: null | string;
  created_at: string;
  promoted_at: null | string;
  registration_code: string;
  registration_status: null | string;
  registrant_email: string;
  registrant_name: string;
  registrant_phone: null | string;
  waitlisted_at: null | string;
};

export const eventRegistrationExportColumns = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "reference", label: "Registration reference" },
  { key: "status", label: "Status" },
  { key: "registeredAt", label: "Registered at (UTC)" },
  { key: "waitlistedAt", label: "Waitlisted at (UTC)" },
  { key: "promotedAt", label: "Promoted at (UTC)" },
  { key: "checkedInAt", label: "Checked in at (UTC)" },
  { key: "cancelledAt", label: "Cancelled at (UTC)" },
] as const;

export type EventRegistrationExportRecord = Record<
  (typeof eventRegistrationExportColumns)[number]["key"],
  string
>;

export function eventRegistrationToExportRecord(
  row: EventRegistrationExportRow
): EventRegistrationExportRecord {
  return {
    cancelledAt: row.cancelled_at || "",
    checkedInAt: row.checked_in_at || "",
    email: row.registrant_email,
    name: row.registrant_name,
    phone: row.registrant_phone || "",
    promotedAt: row.promoted_at || "",
    reference: row.registration_code,
    registeredAt: row.created_at,
    status:
      row.registration_status || (row.cancelled_at ? "cancelled" : "confirmed"),
    waitlistedAt: row.waitlisted_at || "",
  };
}

export function eventRegistrationsToExportTable(
  rows: readonly EventRegistrationExportRow[]
): ExportTable {
  return {
    columns: eventRegistrationExportColumns,
    rows: rows.map((row) => eventRegistrationToExportRecord(row)),
  };
}
