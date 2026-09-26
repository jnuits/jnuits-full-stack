import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/admin/onboarding/intake-workspace", () => ({
  IntakeWorkspace: (props: Record<string, unknown>) => (
    <div
      data-operation-type={String(props.operationType)}
      data-target-term-id={String(props.targetTermId)}
      data-target-term-label={String(props.targetTermLabel)}
    >
      Draft workspace
    </div>
  ),
}));

import { CommitteeOnboardingPanel } from "./committee-onboarding-panel";

const terms = [
  { id: "11111111-1111-4111-8111-111111111111", title: "6th Executive Committee" },
  { id: "22222222-2222-4222-8222-222222222222", title: "5th Executive Committee" },
];

describe("committee onboarding draft handoff", () => {
  it("binds the shared draft workspace to the explicitly selected term", async () => {
    const user = userEvent.setup();
    render(<CommitteeOnboardingPanel initialTermId={terms[0].id} terms={terms} />);

    const workspace = screen.getByText("Draft workspace");
    expect(workspace).toHaveAttribute("data-operation-type", "committee_roster_import");
    expect(workspace).toHaveAttribute("data-target-term-id", terms[0].id);
    expect(workspace).toHaveAttribute("data-target-term-label", terms[0].title);

    await user.selectOptions(screen.getByRole("combobox", { name: "Target committee term" }), terms[1].id);

    const nextWorkspace = screen.getByText("Draft workspace");
    expect(nextWorkspace).toHaveAttribute("data-target-term-id", terms[1].id);
    expect(nextWorkspace).toHaveAttribute("data-target-term-label", terms[1].title);
  });
});
