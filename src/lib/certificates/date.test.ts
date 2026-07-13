import { describe, expect, it } from "vitest";

import { normalizeCertificateIssueDate } from "@/lib/certificates/date";

describe("certificate issue date helpers", () => {
  it.each([
    ["05-11-26", "2026-11-05"],
    ["05/11/26", "2026-11-05"],
    ["05-11-2026", "2026-11-05"],
    ["2026-11-05", "2026-11-05"],
  ])("normalizes %s to the stored ISO date", (input, expected) => {
    expect(normalizeCertificateIssueDate(input)).toBe(expected);
  });

  it("rejects invalid manual dates", () => {
    expect(normalizeCertificateIssueDate("31-02-26")).toBeNull();
    expect(normalizeCertificateIssueDate("11/05")).toBeNull();
  });

});