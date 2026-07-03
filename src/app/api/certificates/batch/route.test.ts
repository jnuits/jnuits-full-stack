import { describe, expect, it } from "vitest";
import {
  MAX_BATCH_IDS,
  normalizeIds,
  toPublicCertificate,
} from "@/lib/certificates/public-batch";

describe("certificate batch route helpers", () => {
  it("normalizes, deduplicates, and caps batch IDs", () => {
    const ids = Array.from({ length: MAX_BATCH_IDS + 10 }, (_, index) =>
      index === 1 ? " cert-0 " : ` cert-${index} `
    );

    expect(normalizeIds(ids)).toHaveLength(MAX_BATCH_IDS);
    expect(normalizeIds([" cert-1 ", "CERT-1", "", 123])).toEqual(["CERT-1"]);
  });

  it("returns only public certificate fields", () => {
    const publicCertificate = toPublicCertificate({
      asset_url: "https://example.test/cert.pdf",
      certificate_id: "CERT-1",
      created_at: "2026-01-01T00:00:00Z",
      details: "Completed",
      exam_or_event: "Event",
      exam_or_event_name: "Workshop",
      full_name: "Ayesha Rahman",
      id: "internal-id",
      issue_date: "2026-01-02",
      source_document_id: "private-doc",
      source_migrated_at: "2026-01-03T00:00:00Z",
      source_record_id: "private-row",
      updated_at: "2026-01-04T00:00:00Z",
    });

    expect(Object.keys(publicCertificate).sort()).toEqual([
      "asset_url",
      "certificate_id",
      "details",
      "exam_or_event",
      "exam_or_event_name",
      "full_name",
      "issue_date",
    ]);
    expect(publicCertificate).not.toHaveProperty("source_document_id");
  });
});
