import { describe, expect, it } from "vitest";
import {
  CERTIFICATE_IMPORT_FIELDS,
  CertificateImportInputError,
  createCertificateImportTemplate,
  parseCertificateImportCsv,
  readCertificateImportSource,
} from "@/lib/certificates/admin-import";

describe("certificate admin CSV import parser", () => {
  it("generates separate blank and fictional sample CSV/XLSX artifacts from field guidance", () => {
    const blankCsv = createCertificateImportTemplate({ format: "csv", kind: "blank" });
    const sampleCsv = createCertificateImportTemplate({ format: "csv", kind: "sample" });
    const blankXlsx = createCertificateImportTemplate({ format: "xlsx", kind: "blank" });
    const sampleXlsx = createCertificateImportTemplate({ format: "xlsx", kind: "sample" });

    expect(blankCsv.filename).toBe("jnuits-certificate-import-blank.csv");
    expect(String(blankCsv.body).split("\r\n").filter(Boolean)).toHaveLength(1);
    expect(sampleCsv.filename).toBe("jnuits-certificate-import-sample.csv");
    expect(String(sampleCsv.body).split("\r\n").filter(Boolean)).toHaveLength(2);
    expect(String(sampleCsv.body)).toContain("EXAMPLE-CERT-2099-001");
    expect(String(sampleCsv.body)).toContain("Sample Recipient");
    expect(String(sampleCsv.body)).not.toMatch(/@(gmail|yahoo|outlook)\./i);
    expect((blankXlsx.body as Buffer).subarray(0, 2).toString("utf8")).toBe("PK");
    expect((sampleXlsx.body as Buffer).subarray(0, 2).toString("utf8")).toBe("PK");
    expect(CERTIFICATE_IMPORT_FIELDS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          acceptedFormat: expect.any(String),
          example: expect.any(String),
          key: "certificateId",
          limits: expect.any(String),
          required: true,
        }),
        expect.objectContaining({ key: "assetUrl", required: false }),
      ])
    );
  });

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
      [
        "certId,fullName,type,eventName,issueDate",
        "EXAMPLE-CERT-001,Sample Member,Course,Sample Course,2026-03-10",
        "CERT-2026-004,Real Member,Course,Real Course,2026-03-11",
      ].join("\n")
    );

    expect(result.ignoredRowCount).toBe(1);
    expect(result.rows[0]?.ignored).toBe(true);
    expect(result.validRows).toHaveLength(1);
  });

  it("rejects a template with no real certificate rows", () => {
    expect(() =>
      parseCertificateImportCsv(
        "certId,fullName,type,eventName,issueDate\nEXAMPLE-CERT-001,Sample Member,Course,Sample Course,2026-03-10"
      )
    ).toThrow(CertificateImportInputError);
  });

  it("normalizes common spreadsheet headers, type labels, and day-first dates", () => {
    const result = parseCertificateImportCsv(
      [
        "Certificate ID,Recipient Name,Certificate Type,Event / Exam / Course Name,Issued Date,Certificate URL,Notes",
        " cert-2026-005 , Ayesha Khan , Workshop , JnUITS Career Session , 15/01/2026 , https://example.com/cert.pdf , Excel export",
      ].join("\n")
    );

    expect(result.validRows[0]?.certificate).toMatchObject({
      certificate_id: "CERT-2026-005",
      exam_or_event: "Event",
      issue_date: "2026-01-15",
    });
  });

  it("accepts Bangladesh day-first dates with a two-digit year", () => {
    const result = parseCertificateImportCsv(
      [
        "certId,fullName,type,eventName,issueDate,assetUrl,details",
        "2610001BCC0001,Bristy Akter Moreom,Exam,BCC Season 8.0 Basic Computer Structural Knowledge and IT,05-11-26,,Completed the examination",
      ].join("\n")
    );

    expect(result.validRows[0]?.certificate).toMatchObject({
      certificate_id: "2610001BCC0001",
      issue_date: "2026-11-05",
    });
  });
  it("rejects an all-invalid file before an import batch is created", () => {
    expect(() =>
      parseCertificateImportCsv(
        "certId,fullName,type,eventName,issueDate\nCERT-2026-006,Ayesha Khan,Exam,Basic Computer Course,not-a-date"
      )
    ).toThrow(/No valid certificate rows were found.*issue date must be a valid date/i);
  });

  it("preserves actionable diagnostics for every invalid source row", () => {
    let caught: unknown;

    try {
      parseCertificateImportCsv(
        [
          "certId,fullName,type,eventName,issueDate,assetUrl",
          "CERT-INVALID-1,Ayesha Khan,Exam,Basic Computer Course,not-a-date,ftp://bad.test/file.pdf",
          "CERT-INVALID-2,,Unknown,,2026-02-20,",
        ].join("\n")
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(CertificateImportInputError);
    expect((caught as CertificateImportInputError).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          acceptedFormat: expect.any(String),
          example: expect.any(String),
          explanation: "Issue date must be a valid date.",
          field: "issueDate",
          receivedValue: "not-a-date",
          sourceRow: 2,
        }),
        expect.objectContaining({
          explanation: "Asset URL must use http or https.",
          field: "assetUrl",
          receivedValue: "ftp://bad.test/file.pdf",
          sourceRow: 2,
        }),
        expect.objectContaining({
          explanation: "Full name is required.",
          field: "fullName",
          receivedValue: "",
          sourceRow: 3,
        }),
        expect.objectContaining({
          explanation: "Type must be Event, Exam, or Course.",
          field: "type",
          receivedValue: "Unknown",
          sourceRow: 3,
        }),
      ])
    );
    expect((caught as Error).message).toMatch(/Row 2[\s\S]*Row 3/);
  });

  it("keeps status feedback bounded while preserving all diagnostics for a large invalid file", () => {
    let caught: unknown;
    try {
      parseCertificateImportCsv([
        "certId,fullName,type,eventName,issueDate",
        ...Array.from({ length: 30 }, (_, i) => `CERT-${i},Sample Recipient,Event,Sample Event,bad-date`),
      ].join("\n"));
    } catch (error) { caught = error; }

    expect(caught).toBeInstanceOf(CertificateImportInputError);
    expect((caught as CertificateImportInputError).issues).toHaveLength(30);
    expect((caught as Error).message.length).toBeLessThan(1_000);
    expect((caught as Error).message).toMatch(/30.*issue/i);
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
