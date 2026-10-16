import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  AdminActivityPanel,
  type ActivityCoverage,
  type ActivityItem,
} from "./admin-activity-panel";

describe("AdminActivityPanel Component", () => {
  const coverage: ActivityCoverage = {
    state: "current",
    observedSince: "2026-01-01T00:00:00Z",
    lastCollectedAt: "2026-10-14T03:00:00Z",
    message: "Continuous verified event ingestion active.",
  };

  const sampleItems: ActivityItem[] = [
    {
      id: "act-1",
      actionLabel: "admin_role.grant",
      sourceLabel: "application",
      provenanceLabel: "Admin Accounts Console",
      occurredAt: "2026-10-14T10:30:00Z",
      recordedAt: "2026-10-14T10:30:01Z",
      actorLabel: "Super Admin (Redwan)",
      targetLabel: "Rafiqul Islam",
      outcome: "succeeded",
      href: "/admin/admin-profiles/target-1",
      context: {
        ipDisplay: "103.100.x.x",
        countryDisplay: "BD",
        browser: "Chrome 130",
        os: "Windows 11",
        deviceClass: "desktop",
      },
      canRequestFullNetwork: true,
    },
    {
      id: "act-2",
      actionLabel: "auth.password_change_denied",
      sourceLabel: "supabase_auth",
      provenanceLabel: "Native Auth Provider",
      occurredAt: "2026-10-14T11:00:00Z",
      recordedAt: "2026-10-14T11:00:05Z",
      actorLabel: "Unknown Actor",
      targetLabel: "Target User",
      outcome: "denied",
      context: {
        ipDisplay: "192.168.x.x",
        countryDisplay: null,
        browser: "Firefox 131",
        os: "Linux",
        deviceClass: "desktop",
      },
      canRequestFullNetwork: false,
    },
  ];

  it("uses server-supplied actor options without asking operators to guess UUIDs", async () => {
    const onFilterChange = vi.fn();
    const user = userEvent.setup();
    render(<AdminActivityPanel items={[]} coverage={coverage} page={1} totalItems={0} filterOptions={{ actors: [{ value: "fixture-actor-id", label: "Fixture operator" }] }} onFilterChange={onFilterChange} />);
    await user.selectOptions(screen.getByRole("combobox", { name: "Actor" }), "fixture-actor-id");
    await user.click(screen.getByRole("button", { name: "Apply filters" }));
    expect(onFilterChange).toHaveBeenCalledWith(expect.objectContaining({ actor: "fixture-actor-id" }));
  });

  it("renders coverage banner, event table, and distinct outcome badges", () => {
    render(
      <AdminActivityPanel
        items={sampleItems}
        coverage={coverage}
        page={1}
        pageSize={25}
        totalItems={2}
      />
    );

    expect(screen.getByTestId("activity-coverage-banner")).toBeInTheDocument();
    for (const cell of document.querySelectorAll("tbody td")) {
      expect(cell.getAttribute("data-label")).toBeTruthy();
    }
    expect(screen.getByText(/Coverage: current/i)).toBeInTheDocument();

    const actors = screen.getAllByText("Super Admin (Redwan)");
    expect(actors.length).toBeGreaterThan(0);

    const actions = screen.getAllByText("admin_role.grant");
    expect(actions.length).toBeGreaterThan(0);

    const succeededBadges = screen.getAllByText("Succeeded");
    expect(succeededBadges.length).toBeGreaterThan(0);

    const deniedBadges = screen.getAllByText("Denied");
    expect(deniedBadges.length).toBeGreaterThan(0);
  });

  it("handles filter changes and resets accurately", async () => {
    const onFilterChange = vi.fn();
    const user = userEvent.setup();

    render(
      <AdminActivityPanel
        items={sampleItems}
        coverage={coverage}
        page={1}
        pageSize={25}
        totalItems={2}
        onFilterChange={onFilterChange}
      />
    );

    const actorInput = screen.getByLabelText(/^Actor/i);
    await user.type(actorInput, "Redwan");

    const submitBtn = screen.getByRole("button", { name: "Apply filters" });
    await user.click(submitBtn);

    expect(onFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({ actor: "Redwan" })
    );

    const resetBtn = screen.getByRole("button", { name: "Reset" });
    await user.click(resetBtn);
    expect(onFilterChange).toHaveBeenCalledWith({});
  });

  it("triggers onRequestFullNetwork callback when network detail button clicked", async () => {
    const onRequestFullNetwork = vi.fn();
    const user = userEvent.setup();

    render(
      <AdminActivityPanel
        items={sampleItems}
        coverage={coverage}
        page={1}
        pageSize={25}
        totalItems={2}
        onRequestFullNetwork={onRequestFullNetwork}
      />
    );

    const networkBtns = screen.getAllByRole("button", { name: /network/i });
    expect(networkBtns.length).toBeGreaterThan(0);
    await user.click(networkBtns[0]);

    expect(onRequestFullNetwork).toHaveBeenCalledWith("act-1");
  });

  it("renders truthful pagination controls and responds to page change", async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();

    render(
      <AdminActivityPanel
        items={sampleItems}
        coverage={coverage}
        page={1}
        pageSize={1}
        totalItems={2}
        onPageChange={onPageChange}
      />
    );

    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    const nextBtn = screen.getByRole("button", { name: "Next" });
    await user.click(nextBtn);

    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});
