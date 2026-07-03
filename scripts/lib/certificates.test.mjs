import { describe, expect, it } from "vitest";
import { normalizeCertificateRow } from "./certificates.mjs";

describe("certificate CSV normalization", () => {
  it("accepts full_name as the canonical certificate recipient field", () => {
    const row = normalizeCertificateRow(
      {
        certificate_id: " cert-1 ",
        fullName: " Ayesha Rahman ",
        exam_or_event: "Event",
        exam_or_event_name: "Workshop",
        issue_date: "2026-01-02",
      },
      2
    );

    expect(row.parseError).toBeNull();
    expect(row.normalized).toMatchObject({
      certificate_id: "CERT-1",
      full_name: "Ayesha Rahman",
    });
    expect(row.normalized).not.toHaveProperty("first_name");
    expect(row.normalized).not.toHaveProperty("last_name");
  });

  it("derives full_name from legacy first and last columns", () => {
    const row = normalizeCertificateRow(
      {
        certificateID: "cert-2",
        firstName: "Nadia",
        lastName: "Islam",
        exam_or_event: "Exam",
        exam_or_event_name: "Final",
        issueDate: "2026-02-03",
      },
      3
    );

    expect(row.parseError).toBeNull();
    expect(row.normalized).toMatchObject({
      certificate_id: "CERT-2",
      full_name: "Nadia Islam",
    });
  });
});
