import { describe, expect, it } from "vitest";
import { createCertificateImportIssue, createCertificateIssueReport } from "./import-catalog";

describe("certificate validation report", () => {
  it("includes every issue and protects formula-like submitted values", () => {
    const report = createCertificateIssueReport([2, 3].map((sourceRow) => createCertificateImportIssue({
      code: "type_invalid", explanation: "Choose a supported type.", field: "type",
      receivedValue: "=HYPERLINK(unsafe)", sourceRow,
    })));
    expect(report).toContain('"Source row","Field","Received value","Issue","Accepted format","Example"');
    expect(report).toContain('"2","Type","\'=HYPERLINK(unsafe)"');
    expect(report).toContain('"3","Type","\'=HYPERLINK(unsafe)"');
    expect(report).toContain('"Event, Exam, or Course","Event"');
  });
});
