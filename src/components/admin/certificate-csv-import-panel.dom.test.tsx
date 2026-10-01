import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ inspect: vi.fn() }));
vi.mock("@/app/admin/certificates/actions", () => ({
  bulkImportCertificatesAction: vi.fn(),
  inspectCertificateImportAction: mocks.inspect,
}));

import { CertificateCsvImportPanel } from "./certificate-csv-import-panel";

describe("CertificateCsvImportPanel", () => {
  it("links separate generated blank and fictional sample artifacts", () => {
    render(<CertificateCsvImportPanel />);

    const expected = [
      ["Blank CSV", "kind=blank&format=csv"],
      ["Blank XLSX", "kind=blank&format=xlsx"],
      ["Fictional sample CSV", "kind=sample&format=csv"],
      ["Fictional sample XLSX", "kind=sample&format=xlsx"],
    ] as const;

    for (const [name, query] of expected) {
      expect(screen.getByRole("link", { name })).toHaveAttribute(
        "href",
        `/api/admin/certificates/import-template?${query}`
      );
    }

    expect(screen.getByText("Field requirements")).toBeInTheDocument();
    expect(screen.queryByText(/replace or add to the three sample rows/i)).not.toBeInTheDocument();
    expect(document.querySelector('a[href^="/templates/"]')).toBeNull();
  });

  it("checks data without submitting an import and displays actionable row errors", async () => {
    mocks.inspect.mockResolvedValueOnce({ ok: false, message: "1 validation issue.", issues: [{
      sourceRow: 2, field: "type", receivedValue: "mystery", explanation: "Choose a supported type.",
      acceptedFormat: "Event, Exam, or Course", example: "Event", code: "type_invalid",
    }] });
    render(<CertificateCsvImportPanel />);
    fireEvent.change(screen.getByLabelText("CSV data"), { target: { value: "fictional CSV" } });
    const check = screen.getByRole("button", { name: "Check data" });
    expect(check).toHaveAttribute("type", "button");
    fireEvent.click(check);
    expect(await screen.findByText(/Row 2.*Type/)).toBeInTheDocument();
    expect(screen.getByText(/mystery/)).toBeInTheDocument();
    expect(screen.getByText(/Accepted: Event, Exam, or Course/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download error report" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("CSV data"), { target: { value: "corrected CSV" } });
    expect(screen.queryByRole("button", { name: "Download error report" })).not.toBeInTheDocument();
  });
});
