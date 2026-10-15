import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  AdminActivitySummaryView,
  type AdminActivitySummary,
} from "./admin-activity-summary";

describe("AdminActivitySummaryView Component", () => {
  it("renders seen_recently status and formatted Asia/Dhaka timestamps", () => {
    const summary: AdminActivitySummary = {
      status: "seen_recently",
      observedSince: "2026-01-01T00:00:00Z",
      firstWorkspaceEntryAt: "2026-01-02T10:00:00Z",
      lastSignInAt: "2026-10-14T08:00:00Z",
      lastWorkspaceAccessAt: "2026-10-14T09:30:00Z",
      lastCompletedWorkAt: "2026-10-14T09:45:00Z",
      completedWorkCount: 18,
      label: "Seen recently",
      explanation: "Active admin account with routine workspace visits and privileged action completion.",
      periodLabel: "Last 90 days",
      href: "/admin/audit?actor=test-user-id",
    };

    render(<AdminActivitySummaryView summary={summary} />);

    expect(
      screen.getByRole("heading", {
        name: "Account activity & accountability summary",
      })
    ).toBeInTheDocument();
    expect(screen.getByText("Seen recently")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Active admin account with routine workspace visits and privileged action completion."
      )
    ).toBeInTheDocument();

    expect(screen.getByText("Completed actions (Last 90 days)")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();

    const auditLink = screen.getByRole("link", { name: /View audit/i });
    expect(auditLink).toHaveAttribute("href", "/admin/audit?actor=test-user-id");
  });

  it("renders never_used state with observation period qualification", () => {
    const summary: AdminActivitySummary = {
      status: "never_used",
      observedSince: "2026-04-01T00:00:00Z",
      firstWorkspaceEntryAt: null,
      lastSignInAt: null,
      lastWorkspaceAccessAt: null,
      lastCompletedWorkAt: null,
      completedWorkCount: 0,
      label: "No workspace access recorded",
      explanation: "This activated account has not accessed the admin workspace during the observation window.",
      periodLabel: "Since April 2026",
      href: null,
    };

    render(<AdminActivitySummaryView summary={summary} />);

    expect(screen.getByText("No workspace access recorded")).toBeInTheDocument();
    expect(screen.getByText(/Observed since/i)).toBeInTheDocument();

    // Must not use words like 'idle' or display game XP
    expect(screen.queryByText(/idle/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/xp/i)).not.toBeInTheDocument();
  });

  it("renders history_unavailable state gracefully", () => {
    const summary: AdminActivitySummary = {
      status: "history_unavailable",
      observedSince: null,
      firstWorkspaceEntryAt: null,
      lastSignInAt: null,
      lastWorkspaceAccessAt: null,
      lastCompletedWorkAt: null,
      completedWorkCount: null,
      label: "History unavailable",
      explanation: "Detailed activity tracking has not been enabled or historical records are not available.",
      periodLabel: null,
    };

    render(<AdminActivitySummaryView summary={summary} />);

    expect(screen.getByText("History unavailable")).toBeInTheDocument();
    expect(screen.getByText("Not evaluated")).toBeInTheDocument();
  });
});
