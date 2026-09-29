import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { findAccessibilityViolations } from "../../../../test/setup/axe";

const mocks = vi.hoisted(() => ({
  createDraft: vi.fn(),
  editRow: vi.fn(),
  excludeRow: vi.fn(),
  getDraft: vi.fn(),
  inspectSource: vi.fn(),
  publishDraft: vi.fn(),
  validateDraft: vi.fn(),
}));

vi.mock("@/app/admin/onboarding/actions", () => ({
  createOnboardingDraftAction: (...args: unknown[]) => mocks.createDraft(...args),
  editOnboardingDraftRowAction: (...args: unknown[]) => mocks.editRow(...args),
  getOnboardingDraftAction: (...args: unknown[]) => mocks.getDraft(...args),
  inspectOnboardingSourceAction: (...args: unknown[]) => mocks.inspectSource(...args),
  publishOnboardingDraftAction: (...args: unknown[]) => mocks.publishDraft(...args),
  setOnboardingDraftRowExcludedAction: (...args: unknown[]) => mocks.excludeRow(...args),
  validateOnboardingDraftAction: (...args: unknown[]) => mocks.validateDraft(...args),
}));

import {
  IntakeWorkspace,
  type IntakeWorkspaceDraft,
} from "@/components/admin/onboarding/intake-workspace";

const operationId = "11111111-1111-4111-8111-111111111111";
const rowId = "22222222-2222-4222-8222-222222222222";

const inspected = {
  data: {
    availableSheets: [],
    headers: [
      { columnIndex: 0, key: "full_name", label: "Full name" },
      { columnIndex: 1, key: "jnuits_id", label: "JnUITS ID" },
      { columnIndex: 2, key: "email", label: "Email" },
      { columnIndex: 3, key: "classification", label: "Classification" },
    ],
    inferredMapping: {
      classification: "classification",
      email: "email",
      fullName: "full_name",
      jnuitsId: "jnuits_id",
    },
    originalFilename: null,
    previewRows: [
      {
        sourceRowNumber: 2,
        values: {
          classification: "current",
          email: "member@example.com",
          full_name: "Member One",
          jnuits_id: "JNUITS-2026001",
        },
      },
    ],
    rowCount: 1,
    selectedSheet: null,
    sourceSha256: "a".repeat(64),
  },
  message: "1 source row inspected.",
  ok: true,
};

function draft(overrides: Partial<IntakeWorkspaceDraft> = {}): IntakeWorkspaceDraft {
  return {
    draftRevision: 3,
    id: operationId,
    metadata: {
      columnMapping: {
        classification: "classification",
        email: "email",
        fullName: "full_name",
        jnuitsId: "jnuits_id",
      },
    },
    operationType: "committee_roster_import",
    originalFilename: "roster.csv",
    rows: [
      {
        errors: [],
        id: rowId,
        isExcluded: false,
        normalizedData: {},
        rawData: {
          classification: "current",
          email: "member@example.com",
          full_name: "Member One",
          jnuits_id: "JNUITS-2026001",
          position: "President",
        },
        rowNumber: 2,
        status: "valid",
      },
    ],
    sourceKind: "csv",
    sourceSha256: "a".repeat(64),
    status: "draft",
    targetTermId: "33333333-3333-4333-8333-333333333333",
    validatedRevision: null,
    ...overrides,
  };
}

function renderWorkspace(props: Partial<React.ComponentProps<typeof IntakeWorkspace>> = {}) {
  const user = userEvent.setup();
  const rendered = render(
    <IntakeWorkspace
      operationType="committee_roster_import"
      targetTermId="33333333-3333-4333-8333-333333333333"
      targetTermLabel="6th Executive Committee"
      {...props}
    />
  );
  return { ...rendered, user };
}

describe("shared onboarding intake workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.inspectSource.mockResolvedValue(inspected);
    mocks.createDraft.mockResolvedValue({
      data: {
        draftRevision: 1,
        errorRows: 0,
        operationId,
        totalRows: 1,
        validRows: 1,
      },
      message: "Draft saved.",
      ok: true,
    });
    mocks.getDraft.mockResolvedValue({ data: draft(), message: "Draft loaded.", ok: true });
    mocks.editRow.mockResolvedValue({
      data: { draftRevision: 4, operationId },
      message: "Draft row updated.",
      ok: true,
    });
    mocks.excludeRow.mockResolvedValue({
      data: { draftRevision: 4, operationId },
      message: "Draft row excluded.",
      ok: true,
    });
    mocks.validateDraft.mockResolvedValue({
      data: { draftRevision: 3, operationId, status: "previewed", validRows: 1 },
      message: "Draft validation passed.",
      ok: true,
    });
    mocks.publishDraft.mockResolvedValue({
      data: { operationId, status: "committed" },
      message: "Onboarding draft published.",
      ok: true,
    });
  });

  it("offers manual, CSV, XLSX, and pasted TSV inputs and maps inspected headings", async () => {
    const { user } = renderWorkspace();

    expect(screen.getByRole("radio", { name: "Manual entry" })).toBeChecked();
    expect(screen.getByLabelText("Full name")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "CSV file" }));
    expect(screen.getByLabelText("Upload CSV file")).toHaveAttribute(
      "accept",
      expect.stringContaining(".csv")
    );

    await user.click(screen.getByRole("radio", { name: "Excel workbook" }));
    expect(screen.getByLabelText("Upload Excel workbook")).toHaveAttribute(
      "accept",
      expect.stringContaining(".xlsx")
    );

    await user.click(screen.getByRole("radio", { name: "Paste TSV" }));
    await user.type(
      screen.getByLabelText("Paste tab-separated rows"),
      "Full name\tJnUITS ID\tEmail\tClassification\nMember One\tJNUITS-2026001\tmember@example.com\tcurrent"
    );
    await user.click(screen.getByRole("button", { name: "Inspect source" }));

    expect(await screen.findByText("1 source row inspected.")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Map Full name" })).toHaveValue(
      "full_name"
    );
    await user.selectOptions(screen.getByRole("combobox", { name: "Map Email" }), "");
    expect(screen.getByText("1 row ready for draft validation")).toBeInTheDocument();
    expect(mocks.inspectSource).toHaveBeenCalledWith(expect.any(FormData));
    expect(mocks.inspectSource.mock.calls[0][0].get("sourceKind")).toBe("pasted_tsv");
  });

  it("re-inspects a workbook using the selected sheet", async () => {
    mocks.inspectSource
      .mockResolvedValueOnce({
        ...inspected,
        data: {
          ...inspected.data,
          availableSheets: ["Roster", "Notes"],
          selectedSheet: "Roster",
        },
      })
      .mockResolvedValueOnce({
        ...inspected,
        data: {
          ...inspected.data,
          availableSheets: ["Roster", "Notes"],
          selectedSheet: "Notes",
        },
      });
    const { user } = renderWorkspace();
    await user.click(screen.getByRole("radio", { name: "Excel workbook" }));
    await user.upload(
      screen.getByLabelText("Upload Excel workbook"),
      new File(["xlsx"], "committee.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
    );
    await user.click(screen.getByRole("button", { name: "Inspect source" }));

    await user.selectOptions(await screen.findByRole("combobox", { name: "Workbook sheet" }), "Notes");
    await user.click(screen.getByRole("button", { name: "Load selected sheet" }));

    await waitFor(() => expect(mocks.inspectSource).toHaveBeenCalledTimes(2));
    expect(mocks.inspectSource.mock.calls[1][0].get("sheetName")).toBe("Notes");
  });

  it("saves a mapped draft and displays its validation summary", async () => {
    const { user } = renderWorkspace();
    await user.type(screen.getByLabelText("Full name"), "Member One");
    await user.type(screen.getByLabelText("JnUITS ID"), "JNUITS-2026001");
    await user.type(screen.getByLabelText("Email"), "member@example.com");
    await user.selectOptions(screen.getByLabelText("Classification"), "current");
    await user.type(screen.getByLabelText("Position"), "President");
    await user.click(screen.getByRole("button", { name: "Inspect source" }));
    await user.click(await screen.findByRole("button", { name: "Save draft" }));

    expect(await screen.findByText("1 valid")).toBeInTheDocument();
    expect(screen.getByText("0 need correction")).toBeInTheDocument();
    expect(mocks.createDraft).toHaveBeenCalledWith(expect.any(FormData));
    expect(mocks.createDraft.mock.calls[0][0].get("targetTermId")).toBe(
      "33333333-3333-4333-8333-333333333333"
    );
  });

  it("supports row correction, exclusion, and reinclusion", async () => {
    const corrected = draft({
      draftRevision: 4,
      rows: [{ ...draft().rows[0], rawData: { ...draft().rows[0].rawData, full_name: "Corrected Member" } }],
    });
    const excluded = draft({
      draftRevision: 5,
      rows: [{ ...corrected.rows[0], isExcluded: true }],
    });
    const reincluded = draft({ draftRevision: 6, rows: corrected.rows });
    mocks.getDraft
      .mockResolvedValueOnce({ data: corrected, message: "Draft loaded.", ok: true })
      .mockResolvedValueOnce({ data: excluded, message: "Draft loaded.", ok: true })
      .mockResolvedValueOnce({ data: reincluded, message: "Draft loaded.", ok: true });
    const initial = draft({
      rows: [
        {
          ...draft().rows[0],
          errors: [
            {
              acceptedFormat: "Plain text",
              code: "required",
              example: "Sample Member",
              explanation: "Full name is required.",
              field: "fullName",
              receivedValue: "",
              sourceRow: 2,
            },
          ],
          status: "error",
        },
      ],
    });
    const { user } = renderWorkspace({ initialDraft: initial });
    let row = screen.getByRole("group", { name: "Draft row 2" });

    await user.clear(within(row).getByLabelText("Row 2 Full name"));
    await user.type(within(row).getByLabelText("Row 2 Full name"), "Corrected Member");
    await user.click(within(row).getByRole("button", { name: "Save correction for row 2" }));

    await waitFor(() => expect(mocks.editRow).toHaveBeenCalled());
    expect(mocks.editRow.mock.calls[0][0].rawData.full_name).toBe("Corrected Member");
    expect(await screen.findByText("1 valid")).toBeInTheDocument();

    row = screen.getByRole("group", { name: "Draft row 2" });
    await user.type(within(row).getByLabelText("Exclusion reason for row 2"), "Duplicate row");
    await user.click(within(row).getByRole("button", { name: "Exclude row 2" }));
    await waitFor(() =>
      expect(mocks.excludeRow).toHaveBeenCalledWith(
        expect.objectContaining({ excluded: true, reason: "Duplicate row" })
      )
    );

    row = await screen.findByRole("group", { name: "Draft row 2" });
    await user.click(within(row).getByRole("button", { name: "Reinclude row 2" }));
    await waitFor(() =>
      expect(mocks.excludeRow).toHaveBeenLastCalledWith(
        expect.objectContaining({ excluded: false, reason: null })
      )
    );
  });

  it("requires a current validation and explicit confirmation before publish", async () => {
    const validated = draft({ status: "previewed", validatedRevision: 3 });
    const { user } = renderWorkspace({ initialDraft: validated });
    const publish = screen.getByRole("button", { name: "Publish draft" });

    expect(publish).toBeDisabled();
    await user.click(
      screen.getByRole("checkbox", {
        name: "I confirm that I reviewed every active row and want to publish this draft",
      })
    );
    expect(publish).toBeEnabled();
    await user.click(screen.getByRole("checkbox", { name: "Make this the current committee" }));
    await user.click(publish);

    expect(mocks.publishDraft).toHaveBeenCalledWith({
      expectedRevision: 3,
      makeCurrent: true,
      operationId,
    });
  });

  it("has no axe violations in the populated draft workspace", async () => {
    const { container } = renderWorkspace({ initialDraft: draft() });
    const violations = await findAccessibilityViolations(container);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
});
