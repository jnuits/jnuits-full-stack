import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { findAccessibilityViolations } from "../../../test/setup/axe";

vi.mock("@/app/admin/committee/actions", () => ({
  saveCommitteeTermPosition: vi.fn(),
}));

import { CommitteePositionEditor } from "./committee-position-editor";

const term = {
  id: "33333333-3333-4333-8333-333333333333",
  title: "6th Executive Committee",
};
const roles = [
  {
    code: "president",
    defaultSlots: 1,
    id: "11111111-1111-4111-8111-111111111111",
    maxSlots: 1,
    minSlots: 1,
    roleGroup: "executive",
    sortOrder: 10,
    title: "President",
    titleBn: null,
  },
  {
    code: "treasurer",
    defaultSlots: 1,
    id: "22222222-2222-4222-8222-222222222222",
    maxSlots: 2,
    minSlots: 0,
    roleGroup: "executive",
    sortOrder: 80,
    title: "Treasurer",
    titleBn: null,
  },
  {
    code: "secretary",
    defaultSlots: 2,
    id: "44444444-4444-4444-8444-444444444444",
    maxSlots: 2,
    minSlots: 1,
    roleGroup: "executive",
    sortOrder: 20,
    title: "Secretary",
    titleBn: null,
  },
];
const positions = [
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    isPublic: true,
    maxSlots: 2,
    minSlots: 1,
    priority: 50,
    publicLabel: "General Secretary",
    publicLabelBn: null,
    roleCode: "secretary",
    roleGroup: "executive",
    roleId: roles[2].id,
    targetSlots: 2,
    termId: term.id,
  },
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    isPublic: true,
    maxSlots: 1,
    minSlots: 1,
    priority: 5,
    publicLabel: "Chair",
    publicLabelBn: "সভাপতি",
    roleCode: "president",
    roleGroup: "executive",
    roleId: roles[0].id,
    targetSlots: 1,
    termId: term.id,
  },
];

describe("committee term position editor", () => {
  it("orders configured positions by priority and exposes every editable field", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <CommitteePositionEditor positions={positions} roles={roles} term={term} />
    );

    const summaries = Array.from(container.querySelectorAll("summary"));
    expect(summaries.map((summary) => summary.textContent)).toEqual([
      expect.stringContaining("Chair"),
      expect.stringContaining("General Secretary"),
    ]);

    await user.click(summaries[0]);
    const form = screen.getByRole("group", { name: "Edit Chair position" });
    expect(within(form).getByLabelText("Public label")).toHaveValue("Chair");
    expect(within(form).getByLabelText("Bengali label")).toHaveValue("সভাপতি");
    expect(within(form).getByLabelText("Group")).toHaveValue("executive");
    expect(within(form).getByLabelText("Priority")).toHaveValue(5);
    expect(within(form).getByLabelText("Visibility")).toHaveValue("true");
    expect(within(form).getByLabelText("Minimum seats")).toHaveValue(1);
    expect(within(form).getByLabelText("Target seats")).toHaveValue(1);
    expect(within(form).getByLabelText("Maximum seats")).toHaveValue(1);
  });

  it("offers unconfigured canonical roles with safe role defaults", async () => {
    const user = userEvent.setup();
    render(<CommitteePositionEditor positions={positions} roles={roles} term={term} />);

    await user.selectOptions(screen.getByRole("combobox", { name: "Canonical role" }), roles[1].id);
    const form = screen.getByRole("group", { name: "Add Treasurer position" });
    expect(within(form).getByLabelText("Public label")).toHaveValue("Treasurer");
    expect(within(form).getByLabelText("Minimum seats")).toHaveValue(0);
    expect(within(form).getByLabelText("Target seats")).toHaveValue(1);
    expect(within(form).getByLabelText("Maximum seats")).toHaveValue(2);
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <CommitteePositionEditor positions={positions} roles={roles} term={term} />
    );
    const violations = await findAccessibilityViolations(container);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
});
