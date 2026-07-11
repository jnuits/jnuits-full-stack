import { describe, expect, it } from "vitest";
import {
  CertificateImportInputError,
  parseCertificateImportCsv,
  readCertificateImportSource,
} from "@/lib/certificates/admin-import";

describe("certificate admin CSV import parser", () => {
  it("parses the current full-name format with quoted commas and optional details", () => {
    const result = parseCertificateImportCsv(
      [
        "certId,fullName,type,eventName,issueDate,assetUrl,details",
        'CERT-2026-001,"Ayesha Khan",Event,"Speak Up, Dhaka",2026-01-15,https://example.com/cert.pdf,"Completed with distinction"',
      ].join("\n")
    );

    expect(result.dataRowCount).toBe(1);
    expect(result.validRows).toHaveLength(1);
    expect(result.validRows[0]?.certificate).toMatchObject({
      certificate_id: "CERT-2026-001",
      details: "Completed with distinction",
      exam_or_event: "Event",
      exam_or_event_name: "Speak Up, Dhaka",
      full_name: "Ayesha Khan",
      issue_date: "2026-01-15",
    });
  });

  it("accepts the legacy first-name and last-name positional format", () => {
    const result = parseCertificateImportCsv(
      "CERT-2026-002,Redwan,Ahmed,Exam,Basic Computer Course,2026-02-20,https://example.com/cert.pdf"
    );

    expect(result.validRows[0]?.certificate).toMatchObject({
      certificate_id: "CERT-2026-002",
      exam_or_event: "Exam",
      full_name: "Redwan Ahmed",
    });
  });

  it("keeps template examples out of the live registry", () => {
    const result = parseCertificateImportCsv(
      "certId,fullName,type,eventName,issueDate\nEXAMPLE-CERT-001,Sample Member,Course,Sample Course,2026-03-10"
    );

    expect(result.validRows).toHaveLength(0);
    expect(result.rows[0]?.errors.join(" ")).toContain("replace the example");
  });

  it("rejects a malformed required header before a batch is created", () => {
    expect(() =>
      parseCertificateImportCsv("certId,fullName,type\nCERT-1,Ayesha Khan,Event")
    ).toThrow(CertificateImportInputError);
  });
  it("prefers an uploaded CSV file over pasted fallback text", async () => {
    const formData = new FormData();
    formData.set("csv_data", "CERT-PASTE,Ignored,Event,Ignored,2026-01-15");
    formData.set(
      "csv_file",
      new Blob(["CERT-FILE,Ayesha Khan,Event,Workshop,2026-01-15"], {
        type: "text/csv",
      }),
      "summer-certificates.csv"
    );

    await expect(readCertificateImportSource(formData)).resolves.toMatchObject({
      csvText: "CERT-FILE,Ayesha Khan,Event,Workshop,2026-01-15",
      fileName: "summer-certificates.csv",
    });
  });
});
